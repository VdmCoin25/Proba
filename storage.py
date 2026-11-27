"""Хранилище настроек.

На бесплатном Render диск стирается при каждом перезапуске, поэтому всё состояние
(чаты, пост, сессии аккаунтов) хранится в JSON-файле, закреплённом в вашем чате с ботом.
При старте бот скачивает закреплённый файл, при каждом изменении — отправляет и закрепляет новый.
"""
import asyncio
import copy
import json
import logging
import os
from pathlib import Path

from aiogram import Bot
from aiogram.types import BufferedInputFile

DATA_DIR = Path(os.environ.get("DATA_DIR", "data"))
BACKUP_NAME = "telegrand_backup.json"

DEFAULTS = {
    "chats": [],              # [{"link": "@chat", "enabled": True, "last": {...}}]
    "posts": [],              # [{"id", "html", "file_id", "type", "ext", "enabled"}]
    "post_mode": "rotate",    # rotate — по очереди каждый круг, random — случайный пост в каждый чат
    "post_idx": 0,
    "interval_min": 60,       # пауза между кругами рассылки, минут
    "delay_sec": [15, 30],    # случайная пауза между чатами, секунд
    "join_delay": [30, 60],   # пауза между вступлениями, секунд
    "running": False,         # авто-рассылка включена (восстанавливается после перезапуска)
    "notify": True,           # присылать отчёты в бота
    "sessions": {},           # {"acc1": "<Telethon StringSession>"}
    "disabled_accounts": [],
    "acc_sent": {},           # {"acc1": 123}
    "stats": {},              # {"sent", "failed", "cycles", "last_cycle"}
    "parse_variants": True,    # парс: расширять каждое слово вариантами (чат/chat/группа)
    "parse_min_members": 100,  # парс: минимум участников
    "parse_active_days": 90,   # парс: последнее сообщение не старше N дней
    "parse_rejected": [],      # группы, отсеянные парсом (чтобы не проверять повторно)
    "parsed": [],
    "leads": [],              # воронка клиентов: [{id, source, chat, url, author, text, score, temp, niche, lang, status}]
    "radar": {                # настройки радара клиентов
        "enabled": False, "niches": ["ads", "dev", "de_help"],
        "langs": ["ru", "uk", "en", "de", "es", "pt", "fr", "it", "pl"],
        "watch_mailing": True, "watch_folders": [], "folder_rules": {}, "poll_min": 15, "max_chats": 600,
        "notify": ["hot"], "custom_words": "",
    },
    "radar_state": {},        # по чатам: аккаунт, access_hash, последний прочитанный id
    "admins": [],             # доп. пользователи с доступом к боту (кроме владельца из ADMIN_ID)
    "access_requests": [],    # заявки на доступ: [{id, name, username, ts}]             # найденные парсом группы: [{"link", "title", "members", "query", "ts"}]
}


def migrate(data: dict) -> None:
    """Обновляет копию от старой версии бота."""
    data["chats"] = [c if isinstance(c, dict) else {"link": c, "enabled": True} for c in data["chats"]]
    for k, v in copy.deepcopy(DEFAULTS["radar"]).items():
        data["radar"].setdefault(k, v)
    uniq, seen = [], set()
    for p in data.get("parsed", []):  # убираем повторы в парсе
        if p["link"].lower() not in seen:
            seen.add(p["link"].lower())
            uniq.append(p)
    data["parsed"] = uniq
    old = data.pop("message", None)
    if old and not data["posts"]:
        data["posts"].append({"id": "post1", "html": old.get("html", ""), "file_id": old.get("file_id"),
                              "type": old.get("type"), "ext": old.get("ext"), "enabled": True})


log = logging.getLogger("storage")


class Storage:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.data = copy.deepcopy(DEFAULTS)
        self.bot: Bot | None = None
        self.chat_id: int | None = None
        self._backup_msg_id: int | None = None
        self._flush_task: asyncio.Task | None = None

    async def restore(self, bot: Bot, chat_id: int) -> str:
        """Загружает состояние из закреплённого файла в чате с ботом."""
        self.bot, self.chat_id = bot, chat_id
        try:
            chat = await bot.get_chat(chat_id)
            pm = chat.pinned_message
            if pm and pm.document and pm.document.file_name == BACKUP_NAME:
                buf = await bot.download(pm.document)
                self.data.update(json.loads(buf.read().decode("utf-8")))
                migrate(self.data)
                self._backup_msg_id = pm.message_id
                return "настройки восстановлены из резервной копии"
            return "резервной копии нет — начинаем с чистого листа"
        except Exception as e:  # noqa: BLE001
            log.exception("restore failed")
            return f"не удалось прочитать резервную копию: {e}"

    def save(self) -> None:
        """Сохраняет состояние (с задержкой 3 с, чтобы склеить серию изменений)."""
        if self._flush_task is None or self._flush_task.done():
            try:
                self._flush_task = asyncio.get_running_loop().create_task(self._flush())
            except RuntimeError:
                pass

    async def _flush(self) -> None:
        await asyncio.sleep(3)
        if not self.bot:
            return
        raw = json.dumps(self.data, ensure_ascii=False, indent=1).encode("utf-8")
        try:
            sent = await self.bot.send_document(
                self.chat_id,
                BufferedInputFile(raw, BACKUP_NAME),
                caption="💾 Резервная копия настроек и аккаунтов. Не удаляйте и не открепляйте. "
                        "Никому не пересылайте — в ней доступ к аккаунтам.",
                disable_notification=True,
            )
            await self.bot.pin_chat_message(self.chat_id, sent.message_id, disable_notification=True)
            old, self._backup_msg_id = self._backup_msg_id, sent.message_id
            if old:
                try:
                    await self.bot.delete_message(self.chat_id, old)
                except Exception:  # noqa: BLE001
                    pass
        except Exception:  # noqa: BLE001
            log.exception("backup failed")
