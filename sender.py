import asyncio
import logging
import random
import time
from dataclasses import dataclass
from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.tl.functions.channels import JoinChannelRequest

log = logging.getLogger("mailer")


def normalize_chat(raw: str) -> str | None:
    """Приводит ссылку/юзернейм к виду @username. Приватные инвайт-ссылки не поддерживаются."""
    s = raw.strip()
    for prefix in ("https://", "http://"):
        if s.startswith(prefix):
            s = s[len(prefix):]
    if s.startswith("t.me/") or s.startswith("telegram.me/"):
        s = s.split("/", 1)[1]
    s = s.split("/")[0].split("?")[0].lstrip("@")
    if not s or s.startswith("+") or s.lower() == "joinchat":
        return None
    return "@" + s


@dataclass
class Account:
    name: str
    client: TelegramClient
    title: str = ""
    busy_until: float = 0.0

    @property
    def available(self) -> bool:
        return time.time() >= self.busy_until


class AccountPool:
    """Держит подключёнными все аккаунты из db.data["sessions"] и раздаёт их по кругу."""

    def __init__(self, api_id: int, api_hash: str, db):
        self.api_id = api_id
        self.api_hash = api_hash
        self.db = db
        self.accounts: list[Account] = []
        self._rr = 0

    def new_client(self, session: str = "") -> TelegramClient:
        return TelegramClient(StringSession(session), self.api_id, self.api_hash,
                              device_model="Telegrand Bot", system_version="1.0", app_version="1.0")

    @staticmethod
    async def _title(client: TelegramClient) -> str:
        me = await client.get_me()
        return (f"{me.first_name or ''} " + (f"@{me.username}" if me.username else f"+{me.phone}")).strip()

    async def load(self) -> list[str]:
        await self.close()
        report = []
        for name, session in self.db.data["sessions"].items():
            client = self.new_client(session)
            try:
                await client.connect()
                if not await client.is_user_authorized():
                    report.append(f"✖ {name}: сессия недействительна — /delaccount {name} и добавьте заново")
                    await client.disconnect()
                    continue
                title = await self._title(client)
                self.accounts.append(Account(name, client, title))
                report.append(f"✔ {name}: {title}")
            except Exception as e:  # noqa: BLE001
                report.append(f"✖ {name}: {type(e).__name__}: {e}")
                await client.disconnect()
        return report

    async def add(self, name: str, client: TelegramClient) -> Account:
        acc = Account(name, client, await self._title(client))
        self.accounts.append(acc)
        self.db.data["sessions"][name] = client.session.save()
        self.db.save()
        return acc

    async def remove(self, name: str) -> bool:
        if name not in self.db.data["sessions"]:
            return False
        for acc in list(self.accounts):
            if acc.name == name:
                try:
                    await acc.client.log_out()  # завершает сессию в Telegram
                except Exception:  # noqa: BLE001
                    await acc.client.disconnect()
                self.accounts.remove(acc)
        self._rr = 0
        del self.db.data["sessions"][name]
        self.db.save()
        return True

    def free_name(self) -> str:
        i = 1
        while f"acc{i}" in self.db.data["sessions"]:
            i += 1
        return f"acc{i}"

    async def close(self) -> None:
        for acc in self.accounts:
            await acc.client.disconnect()
        self.accounts = []
        self._rr = 0

    def next_available(self, exclude: set[str] = frozenset()) -> Account | None:
        n = len(self.accounts)
        for i in range(n):
            acc = self.accounts[(self._rr + i) % n]
            if acc.available and acc.name not in exclude:
                self._rr = (self._rr + i + 1) % n
                return acc
        return None


class Mailer:
    def __init__(self, pool: AccountPool, db, notify, fetch_media):
        self.fetch_media = fetch_media  # async fn(msg) -> путь к локальному файлу медиа
        self.pool = pool
        self.db = db
        self.notify = notify          # async fn(text) — отчёт админу
        self.lock = asyncio.Lock()    # не даёт двум рассылкам идти одновременно
        self.task: asyncio.Task | None = None
        self._bg: set[asyncio.Task] = set()

    # ---------- авто-рассылка ----------
    @property
    def running(self) -> bool:
        return self.task is not None and not self.task.done()

    def start(self) -> None:
        if not self.running:
            self.task = asyncio.create_task(self._loop())
        self.db.data["running"] = True
        self.db.save()

    def stop(self) -> None:
        if self.running:
            self.task.cancel()
        self.task = None
        self.db.data["running"] = False
        self.db.save()

    async def _loop(self) -> None:
        while True:
            try:
                report = await self.run_cycle()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                log.exception("cycle failed")
                report = f"Ошибка цикла: {type(e).__name__}: {e}"
            await self.notify(report)
            await asyncio.sleep(self.db.data["interval_min"] * 60)

    def background(self, coro) -> None:
        t = asyncio.create_task(coro)
        self._bg.add(t)
        t.add_done_callback(self._bg.discard)

    async def send_once(self) -> None:
        if self.lock.locked():
            await self.notify("Рассылка уже идёт, дождитесь отчёта.")
            return
        await self.notify(await self.run_cycle())

    # ---------- один круг ----------
    async def run_cycle(self) -> str:
        async with self.lock:
            msg = self.db.data.get("message")
            chats = list(self.db.data["chats"])
            if not msg:
                return "⚠ Пост не задан — /setpost"
            if not chats:
                return "⚠ Список чатов пуст — /addchats"
            if not self.pool.accounts:
                return "⚠ Нет аккаунтов — добавьте сессии и /reload"

            if msg.get("file_id"):
                msg = {**msg, "media": await self.fetch_media(msg)}
            lo, hi = self.db.data["delay_sec"]
            ok, problems = 0, []
            for i, chat in enumerate(chats):
                err = await self._send_to_chat(chat, msg)
                if err is None:
                    ok += 1
                else:
                    problems.append(f"• {chat}: {err}")
                if i < len(chats) - 1:
                    await asyncio.sleep(random.uniform(lo, hi))

            text = f"✅ Круг завершён: отправлено {ok}/{len(chats)}."
            if problems:
                text += "\n\nПроблемы:\n" + "\n".join(problems)
            return text

    async def _send_to_chat(self, chat: str, msg: dict) -> str | None:
        tried: set[str] = set()
        last = "все аккаунты на паузе (FloodWait)"
        while True:
            acc = self.pool.next_available(exclude=tried)
            if acc is None:
                return last
            tried.add(acc.name)
            try:
                await self._send(acc, chat, msg)
                return None
            except errors.FloodWaitError as e:
                # лимит Telegram на аккаунт — ставим его на паузу и берём следующий
                acc.busy_until = time.time() + e.seconds
                last = f"{acc.name}: FloodWait {e.seconds}с"
            except errors.SlowModeWaitError as e:
                return f"slow mode, ещё {e.seconds}с — пропуск (увеличьте /interval)"
            except errors.UserBannedInChannelError:
                acc.busy_until = time.time() + 6 * 3600
                return f"{acc.name}: аккаунт ограничен Telegram (спам-блок), пауза 6 ч — проверьте @SpamBot"
            except (errors.ChatWriteForbiddenError, errors.ChannelPrivateError, errors.UserNotParticipantError):
                return f"{acc.name}: нет права писать (не вступил — /join, или бан в чате)"
            except (errors.UsernameNotOccupiedError, errors.UsernameInvalidError, ValueError):
                return "чат не найден"
            except Exception as e:  # noqa: BLE001
                return f"{acc.name}: {type(e).__name__}: {e}"

    @staticmethod
    async def _send(acc: Account, chat: str, msg: dict) -> None:
        if msg.get("media"):
            await acc.client.send_file(
                chat,
                msg["media"],
                caption=msg.get("html") or None,
                parse_mode="html",
                force_document=msg.get("type") == "document",
            )
        else:
            await acc.client.send_message(chat, msg["html"], parse_mode="html")

    # ---------- вступление в чаты ----------
    async def join_all(self) -> None:
        chats = list(self.db.data["chats"])
        if not chats or not self.pool.accounts:
            await self.notify("Нужны и чаты, и аккаунты.")
            return
        await self.notify(f"Вступаю в {len(chats)} чатов с {len(self.pool.accounts)} аккаунтов. "
                          "Это медленно (30–60 с между вступлениями), отчёт придёт в конце.")
        lines = []
        for acc in self.pool.accounts:
            joined = 0
            try:
                dialogs = await acc.client.get_dialogs()
            except Exception as e:  # noqa: BLE001
                lines.append(f"{acc.name}: не удалось получить диалоги — {e}")
                continue
            have = {("@" + d.entity.username).lower() for d in dialogs if getattr(d.entity, "username", None)}
            for chat in chats:
                if chat.lower() in have:
                    continue
                try:
                    await acc.client(JoinChannelRequest(chat))
                    joined += 1
                except errors.FloodWaitError as e:
                    acc.busy_until = time.time() + e.seconds
                    lines.append(f"{acc.name}: FloodWait {e.seconds}с — остановлено")
                    break
                except errors.ChannelsTooMuchError:
                    lines.append(f"{acc.name}: достигнут лимит 500 чатов")
                    break
                except Exception as e:  # noqa: BLE001
                    lines.append(f"{acc.name} → {chat}: {type(e).__name__}")
                await asyncio.sleep(random.uniform(30, 60))
            lines.append(f"{acc.name}: новых вступлений {joined}")
        await self.notify("Вступление завершено:\n" + "\n".join(lines))
