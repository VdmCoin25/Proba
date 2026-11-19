import asyncio
import logging
import os
import time
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message
from aiohttp import ClientSession, web
from dotenv import load_dotenv
from telethon import errors

from sender import AccountPool, Mailer, normalize_chat
from storage import DATA_DIR, Storage

load_dotenv()
API_ID = int(os.environ["API_ID"])
API_HASH = os.environ["API_HASH"]
BOT_TOKEN = os.environ["BOT_TOKEN"]
ADMIN_ID = int(os.environ["ADMIN_ID"])

router = Router()
router.message.filter(F.from_user.id == ADMIN_ID)  # бот слушается только вас

HELP = """Управление рассылкой

Аккаунты
/accounts — список аккаунтов
/addaccount — добавить аккаунт (вход по номеру)
/delaccount acc1 — удалить аккаунт
/reload — переподключить все аккаунты

Чаты
/chats — список чатов
/addchats — добавить (ссылки или @юзернеймы)
/delchat 1 3 — удалить по номерам
/clearchats — очистить список
/join — вступить всеми аккаунтами во все чаты

Пост
/setpost — задать пост (текст, фото, видео, GIF, файл)
/preview — посмотреть пост

Рассылка
/send — один круг прямо сейчас
/run — авто-рассылка по интервалу
/stop — остановить
/interval 60 — пауза между кругами, мин
/delay 15 30 — пауза между чатами, сек
/status — состояние"""


class S(StatesGroup):
    post = State()
    chats = State()
    phone = State()
    code = State()
    password = State()


@router.message(Command("cancel"))
async def cmd_cancel(m: Message, state: FSMContext):
    await _drop_pending()
    await state.clear()
    await m.answer("Отменено.")


@router.message(Command("start", "help"))
async def cmd_help(m: Message):
    await m.answer(HELP)


# ---------- аккаунты ----------
@router.message(Command("accounts"))
async def cmd_accounts(m: Message, pool: AccountPool):
    if not pool.accounts:
        await m.answer("Аккаунтов нет. Добавьте: /addaccount")
        return
    now = time.time()
    lines = []
    for i, a in enumerate(pool.accounts, 1):
        pause = "" if a.available else f" — ⏸ пауза ещё {int(a.busy_until - now)} с"
        lines.append(f"{i}. {a.name}: {a.title}{pause}")
    await m.answer("\n".join(lines))


PENDING: dict[str, object] = {}  # незавершённый вход: client, phone, hash, name


async def _drop_pending():
    """Отменяет незавершённый вход."""
    client = PENDING.get("client")
    PENDING.clear()
    if client:
        await client.disconnect()


async def _safe_delete(m: Message):
    try:
        await m.delete()
    except Exception:  # noqa: BLE001
        pass


@router.message(Command("addaccount"))
async def cmd_addaccount(m: Message, state: FSMContext):
    await _drop_pending()
    await state.set_state(S.phone)
    await m.answer("Пришлите номер телефона аккаунта в международном формате, например +491701234567.\n"
                   "/cancel — отмена.")


@router.message(S.phone, F.text)
async def got_phone(m: Message, state: FSMContext, pool: AccountPool):
    phone = m.text.strip().replace(" ", "")
    name = pool.free_name()
    client = pool.new_client()
    try:
        await client.connect()
        sent = await client.send_code_request(phone)
    except Exception as e:  # noqa: BLE001
        await client.disconnect()
        await m.answer(f"Не удалось отправить код: {type(e).__name__}: {e}\nПопробуйте снова /addaccount")
        await state.clear()
        return
    PENDING.update(client=client, phone=phone, hash=sent.phone_code_hash, name=name)
    await state.set_state(S.code)
    await m.answer("Код отправлен в Telegram этого аккаунта.\n\n"
                   "⚠️ Пришлите его С ПРОБЕЛАМИ между цифрами, например: 1 2 3 4 5\n"
                   "Если отправить код слитно, Telegram посчитает, что его переслали, и заблокирует вход.")


@router.message(S.code, F.text)
async def got_code(m: Message, state: FSMContext, pool: AccountPool):
    await _safe_delete(m)
    code = "".join(ch for ch in m.text if ch.isdigit())
    client = PENDING.get("client")
    if not client:
        await state.clear()
        await m.answer("Сессия входа потерялась, начните заново: /addaccount")
        return
    try:
        await client.sign_in(phone=PENDING["phone"], code=code, phone_code_hash=PENDING["hash"])
    except errors.SessionPasswordNeededError:
        await state.set_state(S.password)
        await m.answer("На аккаунте включён облачный пароль (2FA). Пришлите его — сообщение сразу удалю.")
        return
    except (errors.PhoneCodeInvalidError, errors.PhoneCodeEmptyError):
        await m.answer("Неверный код, пришлите ещё раз (с пробелами).")
        return
    except Exception as e:  # noqa: BLE001
        await _drop_pending()
        await state.clear()
        await m.answer(f"Вход не удался: {type(e).__name__}: {e}\nПопробуйте снова /addaccount")
        return
    await _finish_login(m, state, pool)


@router.message(S.password, F.text)
async def got_password(m: Message, state: FSMContext, pool: AccountPool):
    await _safe_delete(m)
    client = PENDING.get("client")
    if not client:
        await state.clear()
        await m.answer("Сессия входа потерялась, начните заново: /addaccount")
        return
    try:
        await client.sign_in(password=m.text.strip())
    except errors.PasswordHashInvalidError:
        await m.answer("Неверный пароль, попробуйте ещё раз.")
        return
    except Exception as e:  # noqa: BLE001
        await _drop_pending()
        await state.clear()
        await m.answer(f"Вход не удался: {type(e).__name__}: {e}")
        return
    await _finish_login(m, state, pool)


async def _finish_login(m: Message, state: FSMContext, pool: AccountPool):
    acc = await pool.add(PENDING["name"], PENDING["client"])
    PENDING.clear()
    await state.clear()
    await m.answer(f"✅ Аккаунт добавлен: {acc.name} — {acc.title}\nВсего аккаунтов: {len(pool.accounts)}")


@router.message(Command("delaccount"))
async def cmd_delaccount(m: Message, command: CommandObject, pool: AccountPool, mailer: Mailer):
    name = (command.args or "").strip()
    if not name:
        await m.answer("Пример: /delaccount acc1 (имена — в /accounts)")
        return
    if mailer.lock.locked():
        await m.answer("Сейчас идёт рассылка, попробуйте после отчёта.")
        return
    ok = await pool.remove(name)
    await m.answer(f"Аккаунт {name} удалён, сессия завершена." if ok else "Такого аккаунта нет.")


@router.message(Command("reload"))
async def cmd_reload(m: Message, pool: AccountPool, mailer: Mailer):
    if mailer.running or mailer.lock.locked():
        await m.answer("Сначала остановите рассылку: /stop и дождитесь конца круга.")
        return
    report = await pool.load()
    await m.answer("\n".join(report) or "Аккаунтов нет. /addaccount")


# ---------- чаты ----------
@router.message(Command("chats"))
async def cmd_chats(m: Message, db: Storage):
    chats = db.data["chats"]
    if not chats:
        await m.answer("Список пуст. /addchats")
        return
    text = "\n".join(f"{i}. {c}" for i, c in enumerate(chats, 1))
    for i in range(0, len(text), 4000):
        await m.answer(text[i:i + 4000])


@router.message(Command("addchats"))
async def cmd_addchats(m: Message, state: FSMContext):
    await state.set_state(S.chats)
    await m.answer("Пришлите ссылки t.me/... или @юзернеймы — по одному в строке. /cancel — отмена.")


@router.message(S.chats, F.text)
async def got_chats(m: Message, state: FSMContext, db: Storage):
    existing = {c.lower() for c in db.data["chats"]}
    added, bad = 0, []
    for token in m.text.split():
        chat = normalize_chat(token)
        if chat is None:
            bad.append(token)
            continue
        if chat.lower() not in existing:
            db.data["chats"].append(chat)
            existing.add(chat.lower())
            added += 1
    db.save()
    await state.clear()
    text = f"Добавлено: {added}. Всего чатов: {len(db.data['chats'])}."
    if bad:
        text += "\nПропущены (приватные инвайт-ссылки не поддерживаются):\n" + "\n".join(bad)
    await m.answer(text)


@router.message(Command("delchat"))
async def cmd_delchat(m: Message, command: CommandObject, db: Storage):
    try:
        nums = sorted({int(x) for x in (command.args or "").split()}, reverse=True)
    except ValueError:
        nums = []
    if not nums:
        await m.answer("Пример: /delchat 2 5")
        return
    removed = []
    for n in nums:
        if 1 <= n <= len(db.data["chats"]):
            removed.append(db.data["chats"].pop(n - 1))
    db.save()
    await m.answer("Удалено: " + (", ".join(removed) or "ничего"))


@router.message(Command("clearchats"))
async def cmd_clearchats(m: Message, db: Storage):
    db.data["chats"] = []
    db.save()
    await m.answer("Список чатов очищен.")


@router.message(Command("join"))
async def cmd_join(m: Message, mailer: Mailer):
    mailer.background(mailer.join_all())


# ---------- пост ----------
@router.message(Command("setpost"))
async def cmd_setpost(m: Message, state: FSMContext):
    await state.set_state(S.post)
    await m.answer("Пришлите пост одним сообщением (текст или одно фото/видео/GIF/файл с подписью). "
                   "Форматирование сохранится. /cancel — отмена.")


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

    if file and getattr(file, "file_size", 0) and file.file_size > 20 * 1024 * 1024:
        await m.answer("Файл больше 20 МБ — бот не сможет его скачать. Сожмите или пришлите другой.")
        return
    db.data["message"] = {"html": m.html_text or "", "type": mtype, "ext": ext,
                          "file_id": file.file_id if file else None}
    db.save()
    await state.clear()
    await m.answer("Пост сохранён. /preview — проверить, /send — разослать.")


@router.message(Command("preview"))
async def cmd_preview(m: Message, db: Storage):
    msg = db.data.get("message")
    if not msg:
        await m.answer("Пост не задан. /setpost")
        return
    if not msg.get("file_id"):
        await m.answer(msg["html"], parse_mode="HTML")
        return
    f = msg["file_id"]
    cap = msg["html"] or None
    send = {"photo": m.answer_photo, "video": m.answer_video,
            "animation": m.answer_animation}.get(msg["type"], m.answer_document)
    await send(f, caption=cap, parse_mode="HTML")


# ---------- рассылка ----------
@router.message(Command("send"))
async def cmd_send(m: Message, mailer: Mailer):
    await m.answer("Запускаю один круг, отчёт придёт по завершении.")
    mailer.background(mailer.send_once())


@router.message(Command("run"))
async def cmd_run(m: Message, mailer: Mailer, db: Storage):
    mailer.start()
    await m.answer(f"Авто-рассылка включена: круг каждые {db.data['interval_min']} мин.")


@router.message(Command("stop"))
async def cmd_stop(m: Message, mailer: Mailer):
    mailer.stop()
    await m.answer("Авто-рассылка остановлена.")


@router.message(Command("interval"))
async def cmd_interval(m: Message, command: CommandObject, db: Storage):
    try:
        v = int(command.args)
        assert v >= 5
    except (TypeError, ValueError, AssertionError):
        await m.answer("Пример: /interval 60 (минимум 5 минут)")
        return
    db.data["interval_min"] = v
    db.save()
    await m.answer(f"Интервал: {v} мин. Применится со следующего круга.")


@router.message(Command("delay"))
async def cmd_delay(m: Message, command: CommandObject, db: Storage):
    try:
        lo, hi = map(int, (command.args or "").split())
        assert 3 <= lo <= hi
    except (ValueError, AssertionError):
        await m.answer("Пример: /delay 15 30 (минимум 3 секунды)")
        return
    db.data["delay_sec"] = [lo, hi]
    db.save()
    await m.answer(f"Пауза между чатами: {lo}–{hi} с.")


@router.message(Command("status"))
async def cmd_status(m: Message, mailer: Mailer, pool: AccountPool, db: Storage):
    d = db.data
    await m.answer(
        f"Авто-рассылка: {'включена' if mailer.running else 'выключена'}\n"
        f"Сейчас идёт круг: {'да' if mailer.lock.locked() else 'нет'}\n"
        f"Аккаунтов: {len(pool.accounts)} (доступно {sum(a.available for a in pool.accounts)})\n"
        f"Чатов: {len(d['chats'])}\n"
        f"Пост: {'задан' if d.get('message') else 'не задан'}\n"
        f"Интервал: {d['interval_min']} мин, пауза между чатами {d['delay_sec'][0]}–{d['delay_sec'][1]} с"
    )


async def start_web_server() -> None:
    """Render (Web Service) требует открытый порт — отдаём простую страницу «ok»."""
    async def ok(_):
        return web.Response(text="ok")

    app = web.Application()
    app.router.add_get("/", ok)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 10000))).start()


async def keep_alive() -> None:
    """Пингует свой же адрес каждые 10 минут, чтобы бесплатный Render не усыплял сервис."""
    url = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("KEEPALIVE_URL")
    if not url:
        return
    async with ClientSession() as s:
        while True:
            await asyncio.sleep(600)
            try:
                async with s.get(url, timeout=30) as r:
                    logging.info("keep-alive %s -> %s", url, r.status)
            except Exception as e:  # noqa: BLE001
                logging.warning("keep-alive failed: %s", e)


async def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    await start_web_server()
    bot = Bot(BOT_TOKEN)

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

    async def notify(text: str):
        try:
            for i in range(0, len(text), 4000):
                await bot.send_message(ADMIN_ID, text[i:i + 4000])
        except Exception:  # noqa: BLE001
            logging.exception("notify failed")

    async def fetch_media(msg: dict) -> str:
        """Скачивает медиа поста по file_id (диск на Render временный, поэтому храним только file_id)."""
        path = DATA_DIR / "media" / f"{msg['file_id'][-24:]}{msg.get('ext') or ''}"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            await bot.download(msg["file_id"], destination=path)
        return str(path)

    mailer = Mailer(pool, db, notify, fetch_media)
    await notify(f"🤖 Бот запущен ({restored}).\n"
                 + ("\n".join(report) or "Аккаунтов нет — /addaccount") + "\n\n/help — команды")
    if db.data.get("running"):
        mailer.start()
    mailer.background(keep_alive())

    dp = Dispatcher()
    dp.include_router(router)
    try:
        await dp.start_polling(bot, pool=pool, mailer=mailer, db=db)
    finally:
        if db._flush_task and not db._flush_task.done():
            await db._flush_task  # успеть сохранить последнее изменение
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
