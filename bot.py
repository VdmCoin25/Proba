import asyncio
import logging
import os
import re
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (InlineKeyboardButton, InlineKeyboardMarkup, MenuButtonWebApp, Message,
                           WebAppInfo)
from aiohttp import ClientSession
from dotenv import load_dotenv

from sender import AccountPool, LoginFlow, Mailer, new_post
from storage import DATA_DIR, Storage
from webapp import start_web_server

load_dotenv()
API_ID = int(os.environ.get("API_ID") or 0)
API_HASH = os.environ.get("API_HASH", "")
BOT_TOKEN = os.environ["BOT_TOKEN"]
ADMIN_ID = int(os.environ.get("ADMIN_ID") or 0)
PUBLIC_URL = (os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("PUBLIC_URL") or "").rstrip("/")

router = Router()
router.message.filter(F.from_user.id == ADMIN_ID)  # бот слушается только вас


class S(StatesGroup):
    post = State()


def app_keyboard() -> InlineKeyboardMarkup | None:
    if not PUBLIC_URL:
        return None
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="⚙️ Открыть панель", web_app=WebAppInfo(url=f"{PUBLIC_URL}/app"))]])


HELP = """Всё управление — в панели (кнопка ниже или «Панель» слева от поля ввода).

Команды на всякий случай:
/addpost — добавить пост с фото/видео/файлом
/send — один круг рассылки сейчас
/stop — остановить авто-рассылку
/status — коротко о состоянии
/cancel — отменить ввод"""

POST_PROMPT = ("Пришлите пост одним сообщением: текст или одно фото/видео/GIF/файл с подписью. "
               "Форматирование, ссылки и эмодзи сохранятся. /cancel — отмена.")


@router.message(Command("cancel"))
async def cmd_cancel(m: Message, state: FSMContext):
    await state.clear()
    await m.answer("Отменено.")


@router.message(Command("start", "help", "app"))
async def cmd_start(m: Message):
    await m.answer(HELP, reply_markup=app_keyboard())


@router.message(Command("addpost", "setpost"))
async def cmd_addpost(m: Message, state: FSMContext):
    await state.set_state(S.post)
    await m.answer(POST_PROMPT)


@router.message(S.post)
async def got_post(m: Message, state: FSMContext, db: Storage):
    if m.photo:
        file, mtype, ext = m.photo[-1], "photo", ".jpg"
    elif m.animation:
        file, mtype, ext = m.animation, "animation", ".mp4"
    elif m.video:
        file, mtype, ext = m.video, "video", ".mp4"
    elif m.document:
        file, mtype, ext = m.document, "document", Path(m.document.file_name or "file.bin").suffix
    elif m.text:
        file, mtype, ext = None, None, None
    else:
        await m.answer("Поддерживается текст, фото, видео, GIF или файл.")
        return
    if file and (getattr(file, "file_size", 0) or 0) > 20 * 1024 * 1024:
        await m.answer("Файл больше 20 МБ — бот не сможет его скачать. Сожмите или пришлите другой.")
        return
    db.data["posts"].append(new_post(m.html_text or "", file.file_id if file else None, mtype, ext))
    db.save()
    await state.clear()
    await m.answer(f"✅ Пост добавлен. Всего постов: {len(db.data['posts'])}.", reply_markup=app_keyboard())


@router.message(Command("send"))
async def cmd_send(m: Message, mailer: Mailer):
    await m.answer("Запускаю один круг, отчёт придёт по завершении.")
    mailer.background(mailer.send_once())


@router.message(Command("stop"))
async def cmd_stop(m: Message, mailer: Mailer):
    mailer.stop()
    await m.answer("Авто-рассылка остановлена.")


@router.message(Command("status"))
async def cmd_status(m: Message, mailer: Mailer, pool: AccountPool, db: Storage):
    d = db.data
    await m.answer(
        f"Авто-рассылка: {'включена' if mailer.running else 'выключена'}\n"
        f"Аккаунтов: {len(pool.active())} из {len(pool.accounts)}\n"
        f"Чатов: {sum(c.get('enabled', True) for c in d['chats'])} из {len(d['chats'])}\n"
        f"Постов: {len(d['posts'])}\n"
        f"Отправлено всего: {d['stats'].get('sent', 0)}",
        reply_markup=app_keyboard())


async def keep_alive() -> None:
    """Пингует свой же адрес каждые 10 минут, чтобы бесплатный Render не усыплял сервис."""
    if not PUBLIC_URL:
        return
    async with ClientSession() as s:
        while True:
            await asyncio.sleep(600)
            try:
                async with s.get(PUBLIC_URL + "/health", timeout=30) as r:
                    logging.info("keep-alive -> %s", r.status)
            except Exception as e:  # noqa: BLE001
                logging.warning("keep-alive failed: %s", e)


async def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    bot = Bot(BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    ctx: dict = {"bot": bot, "dp": dp, "admin_id": ADMIN_ID, "token": BOT_TOKEN, "post_state": S.post,
                 "post_prompt": POST_PROMPT}
    await start_web_server(ctx)  # Render ждёт открытый порт

    if not ADMIN_ID or not API_ID or not API_HASH:
        logging.error("Не заданы ADMIN_ID / API_ID / API_HASH — бот ждёт настройки")
        while True:
            await asyncio.sleep(3600)

    # При перезапуске на Render старая копия бота ещё несколько секунд работает.
    # Ждём, пока она отключится, чтобы аккаунты не были подключены дважды.
    delay = int(os.environ.get("STARTUP_DELAY", "45" if os.environ.get("RENDER") else "0"))
    if delay:
        logging.info("waiting %s s for the previous instance to stop", delay)
        await asyncio.sleep(delay)

    db = Storage()
    restored = await db.restore(bot, ADMIN_ID)
    pool = AccountPool(API_ID, API_HASH, db)
    report = await pool.load()

    async def notify(text: str, **kw):
        try:
            for i in range(0, len(text), 4000):
                await bot.send_message(ADMIN_ID, text[i:i + 4000], **kw)
        except Exception:  # noqa: BLE001
            logging.exception("notify failed")

    async def fetch_media(post: dict) -> str:
        """Скачивает медиа поста по file_id (диск на Render временный, поэтому храним только file_id)."""
        safe = re.sub(r"[^A-Za-z0-9_-]", "", post["file_id"][-24:])
        path = DATA_DIR / "media" / f"{safe}{post.get('ext') or ''}"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            await bot.download(post["file_id"], destination=path)
        return str(path)

    mailer = Mailer(pool, db, notify, fetch_media)
    login = LoginFlow(pool)
    ctx.update(db=db, pool=pool, mailer=mailer, login=login, ready=True)
    for line in report:
        mailer.log(line, "info" if line.startswith("✔") else "error")

    if PUBLIC_URL:
        try:
            await bot.set_chat_menu_button(chat_id=ADMIN_ID, menu_button=MenuButtonWebApp(
                text="Панель", web_app=WebAppInfo(url=f"{PUBLIC_URL}/app")))
        except Exception:  # noqa: BLE001
            logging.exception("menu button failed")

    await notify(f"🤖 Бот запущен ({restored}).\n" + ("\n".join(report) or "Аккаунтов пока нет.")
                 + "\n\nНастройки — в панели 👇", reply_markup=app_keyboard())
    if db.data.get("running"):
        mailer.start()
    mailer.background(keep_alive())

    try:
        await dp.start_polling(bot, pool=pool, mailer=mailer, db=db)
    finally:
        if db._flush_task and not db._flush_task.done():
            await db._flush_task  # успеть сохранить последнее изменение
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
