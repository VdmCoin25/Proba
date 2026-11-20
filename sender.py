import asyncio
import logging
import random
import time
import uuid
from collections import deque
from dataclasses import dataclass

from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.tl.functions.channels import JoinChannelRequest

log = logging.getLogger("mailer")


def normalize_chat(raw: str) -> str | None:
    """Приводит ссылку/юзернейм к виду @username. Приватные инвайт-ссылки не поддерживаются."""
    s = raw.strip().strip(",;")
    for prefix in ("https://", "http://"):
        if s.startswith(prefix):
            s = s[len(prefix):]
    if s.startswith("t.me/") or s.startswith("telegram.me/"):
        s = s.split("/", 1)[1]
    s = s.split("/")[0].split("?")[0].lstrip("@")
    if not s or s.startswith("+") or s.lower() == "joinchat" or len(s) < 4:
        return None
    return "@" + s


class LoginError(Exception):
    """Ошибка входа, текст которой можно показать пользователю."""


@dataclass
class Account:
    name: str
    client: TelegramClient
    title: str = ""
    busy_until: float = 0.0
    note: str = ""

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

    def is_enabled(self, name: str) -> bool:
        return name not in self.db.data["disabled_accounts"]

    async def load(self) -> list[str]:
        await self.close()
        report = []
        for name, session in self.db.data["sessions"].items():
            client = self.new_client(session)
            try:
                await client.connect()
                if not await client.is_user_authorized():
                    report.append(f"✖ {name}: сессия недействительна — удалите и добавьте заново")
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
        if name in self.db.data["disabled_accounts"]:
            self.db.data["disabled_accounts"].remove(name)
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

    def active(self) -> list[Account]:
        return [a for a in self.accounts if self.is_enabled(a.name)]

    def next_available(self, exclude: set[str] = frozenset()) -> Account | None:
        n = len(self.accounts)
        for i in range(n):
            acc = self.accounts[(self._rr + i) % n]
            if acc.available and acc.name not in exclude and self.is_enabled(acc.name):
                self._rr = (self._rr + i + 1) % n
                return acc
        return None


class LoginFlow:
    """Пошаговый вход в аккаунт: телефон → код → (пароль 2FA). Общий для бота и мини-аппа."""

    def __init__(self, pool: AccountPool):
        self.pool = pool
        self.client: TelegramClient | None = None
        self.phone = self.hash = self.name = None
        self.step = "idle"  # idle | code | password

    async def cancel(self) -> None:
        if self.client:
            await self.client.disconnect()
        self.client = self.phone = self.hash = self.name = None
        self.step = "idle"

    async def start(self, phone: str) -> str:
        await self.cancel()
        phone = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
        if not phone.startswith("+"):
            phone = "+" + phone
        if any(n == phone for n in self._phones()):
            raise LoginError("Этот номер уже добавлен.")
        self.client = self.pool.new_client()
        try:
            await self.client.connect()
            sent = await self.client.send_code_request(phone)
        except errors.PhoneNumberInvalidError:
            await self.cancel()
            raise LoginError("Неверный номер телефона.")
        except errors.FloodWaitError as e:
            await self.cancel()
            raise LoginError(f"Telegram просит подождать {e.seconds} с перед новой попыткой.")
        except Exception as e:  # noqa: BLE001
            await self.cancel()
            raise LoginError(f"Не удалось отправить код: {type(e).__name__}: {e}")
        self.phone, self.hash, self.name = phone, sent.phone_code_hash, self.pool.free_name()
        self.step = "code"
        return self.step

    def _phones(self) -> list[str]:
        return [a.title.split()[-1] for a in self.pool.accounts]

    async def code(self, code: str) -> str:
        if self.step != "code":
            raise LoginError("Сначала введите номер телефона.")
        code = "".join(ch for ch in code if ch.isdigit())
        try:
            await self.client.sign_in(phone=self.phone, code=code, phone_code_hash=self.hash)
        except errors.SessionPasswordNeededError:
            self.step = "password"
            return self.step
        except (errors.PhoneCodeInvalidError, errors.PhoneCodeEmptyError):
            raise LoginError("Неверный код, попробуйте ещё раз.")
        except errors.PhoneCodeExpiredError:
            await self.cancel()
            raise LoginError("Код устарел. Начните вход заново.")
        except Exception as e:  # noqa: BLE001
            await self.cancel()
            raise LoginError(f"Вход не удался: {type(e).__name__}: {e}")
        return await self._finish()

    async def password(self, password: str) -> str:
        if self.step != "password":
            raise LoginError("Пароль сейчас не требуется.")
        try:
            await self.client.sign_in(password=password.strip())
        except errors.PasswordHashInvalidError:
            raise LoginError("Неверный пароль 2FA.")
        except Exception as e:  # noqa: BLE001
            await self.cancel()
            raise LoginError(f"Вход не удался: {type(e).__name__}: {e}")
        return await self._finish()

    async def _finish(self) -> str:
        acc = await self.pool.add(self.name, self.client)
        self.client = None  # клиент теперь принадлежит пулу
        await self.cancel()
        self.last_added = acc
        return "done"


class Mailer:
    def __init__(self, pool: AccountPool, db, notify, fetch_media):
        self.pool = pool
        self.db = db
        self.notify = notify            # async fn(text) — сообщение админу в бота
        self.fetch_media = fetch_media  # async fn(post) -> путь к локальному файлу медиа
        self.lock = asyncio.Lock()      # не даёт двум рассылкам идти одновременно
        self.task: asyncio.Task | None = None
        self.next_run: float | None = None
        self.progress: dict | None = None   # {"what": "send"|"join", "done": i, "total": n}
        self.logs: deque = deque(maxlen=200)
        self._bg: set[asyncio.Task] = set()

    # ---------- журнал ----------
    def log(self, text: str, level: str = "info") -> None:
        self.logs.appendleft({"ts": int(time.time()), "text": text, "level": level})
        log.info(text)

    async def report(self, text: str) -> None:
        if self.db.data.get("notify", True):
            await self.notify(text)

    # ---------- авто-рассылка ----------
    @property
    def running(self) -> bool:
        return self.task is not None and not self.task.done()

    def start(self) -> None:
        if not self.running:
            self.task = asyncio.create_task(self._loop())
            self.log("▶️ Авто-рассылка включена")
        self.db.data["running"] = True
        self.db.save()

    def stop(self) -> None:
        if self.running:
            self.task.cancel()
            self.log("⏹ Авто-рассылка остановлена")
        self.task = None
        self.next_run = None
        self.db.data["running"] = False
        self.db.save()

    async def _loop(self) -> None:
        while True:
            try:
                text = await self.run_cycle()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                log.exception("cycle failed")
                text = f"Ошибка цикла: {type(e).__name__}: {e}"
                self.log(text, "error")
            await self.report(text)
            wait = self.db.data["interval_min"] * 60
            self.next_run = time.time() + wait
            await asyncio.sleep(wait)

    def background(self, coro) -> None:
        t = asyncio.create_task(coro)
        self._bg.add(t)
        t.add_done_callback(self._bg.discard)

    async def send_once(self) -> None:
        if self.lock.locked():
            self.log("Круг уже идёт", "warn")
            return
        await self.report(await self.run_cycle())

    # ---------- посты ----------
    def _pick_posts(self) -> list[dict]:
        posts = [p for p in self.db.data["posts"] if p.get("enabled", True)]
        if not posts:
            return []
        if self.db.data.get("post_mode") == "random":
            return posts
        idx = self.db.data.get("post_idx", 0) % len(posts)
        self.db.data["post_idx"] = idx + 1
        return [posts[idx]]

    # ---------- один круг ----------
    async def run_cycle(self) -> str:
        async with self.lock:
            posts = self._pick_posts()
            chats = [c for c in self.db.data["chats"] if c.get("enabled", True)]
            if not posts:
                self.log("⚠ Нет включённых постов", "warn")
                return "⚠ Нет включённых постов — добавьте в разделе «Посты»"
            if not chats:
                self.log("⚠ Нет включённых чатов", "warn")
                return "⚠ Нет включённых чатов"
            if not self.pool.active():
                self.log("⚠ Нет включённых аккаунтов", "warn")
                return "⚠ Нет включённых аккаунтов"

            ready = []
            for p in posts:
                if p.get("file_id"):
                    p = {**p, "media": await self.fetch_media(p)}
                ready.append(p)

            lo, hi = self.db.data["delay_sec"]
            stats = self.db.data["stats"]
            ok, problems = 0, []
            self.progress = {"what": "send", "done": 0, "total": len(chats)}
            self.log(f"🚀 Круг начат: {len(chats)} чатов")
            try:
                for i, chat in enumerate(chats):
                    post = random.choice(ready)
                    err, acc = await self._send_to_chat(chat["link"], post)
                    chat["last"] = {"ok": err is None, "text": err or "отправлено", "ts": int(time.time()), "acc": acc}
                    if err is None:
                        ok += 1
                        stats["sent"] = stats.get("sent", 0) + 1
                        self.db.data["acc_sent"][acc] = self.db.data["acc_sent"].get(acc, 0) + 1
                    else:
                        stats["failed"] = stats.get("failed", 0) + 1
                        problems.append(f"• {chat['link']}: {err}")
                        self.log(f"✖ {chat['link']}: {err}", "error")
                    self.progress["done"] = i + 1
                    if i < len(chats) - 1:
                        await asyncio.sleep(random.uniform(lo, hi))
            finally:
                self.progress = None
                stats["cycles"] = stats.get("cycles", 0) + 1
                stats["last_cycle"] = {"ts": int(time.time()), "ok": ok, "total": len(chats)}
                self.db.save()

            self.log(f"✅ Круг завершён: {ok}/{len(chats)}")
            text = f"✅ Круг завершён: отправлено {ok}/{len(chats)}."
            if problems:
                text += "\n\nПроблемы:\n" + "\n".join(problems)
            return text

    async def _send_to_chat(self, chat: str, post: dict) -> tuple[str | None, str | None]:
        tried: set[str] = set()
        last = "все аккаунты на паузе или выключены"
        last_acc = None
        while True:
            acc = self.pool.next_available(exclude=tried)
            if acc is None:
                return last, last_acc
            tried.add(acc.name)
            last_acc = acc.name
            try:
                await self._send(acc, chat, post)
                return None, acc.name
            except errors.FloodWaitError as e:
                # лимит Telegram на аккаунт — ставим его на паузу и берём следующий
                acc.busy_until = time.time() + e.seconds
                acc.note = f"FloodWait {e.seconds} с"
                last = f"{acc.name}: FloodWait {e.seconds} с"
            except errors.SlowModeWaitError as e:
                return f"slow mode, ещё {e.seconds} с — увеличьте интервал", acc.name
            except errors.UserBannedInChannelError:
                acc.busy_until = time.time() + 6 * 3600
                acc.note = "спам-блок (проверьте @SpamBot)"
                return f"{acc.name}: аккаунт ограничен Telegram (спам-блок), пауза 6 ч", acc.name
            except (errors.ChatWriteForbiddenError, errors.ChannelPrivateError, errors.UserNotParticipantError):
                return f"{acc.name}: нет права писать (не вступил или бан в чате)", acc.name
            except (errors.UsernameNotOccupiedError, errors.UsernameInvalidError, ValueError):
                return "чат не найден", acc.name
            except Exception as e:  # noqa: BLE001
                return f"{acc.name}: {type(e).__name__}: {e}", acc.name

    @staticmethod
    async def _send(acc: Account, chat: str, post: dict) -> None:
        if post.get("media"):
            await acc.client.send_file(
                chat,
                post["media"],
                caption=post.get("html") or None,
                parse_mode="html",
                force_document=post.get("type") == "document",
            )
        else:
            await acc.client.send_message(chat, post["html"], parse_mode="html")

    # ---------- вступление в чаты ----------
    async def join_all(self, names: list[str] | None = None) -> None:
        if self.lock.locked():
            self.log("Дождитесь конца текущей задачи", "warn")
            return
        async with self.lock:
            chats = [c["link"] for c in self.db.data["chats"] if c.get("enabled", True)]
            accounts = [a for a in self.pool.active() if names is None or a.name in names]
            if not chats or not accounts:
                self.log("⚠ Для вступления нужны и чаты, и аккаунты", "warn")
                return
            lo, hi = self.db.data["join_delay"]
            self.log(f"🚪 Вступление: {len(accounts)} акк. × {len(chats)} чатов")
            self.progress = {"what": "join", "done": 0, "total": len(accounts) * len(chats)}
            lines = []
            try:
                for acc in accounts:
                    joined = 0
                    try:
                        dialogs = await acc.client.get_dialogs()
                    except Exception as e:  # noqa: BLE001
                        lines.append(f"{acc.name}: не удалось получить диалоги — {e}")
                        self.progress["done"] += len(chats)
                        continue
                    have = {("@" + d.entity.username).lower() for d in dialogs
                            if getattr(d.entity, "username", None)}
                    for chat in chats:
                        self.progress["done"] += 1
                        if chat.lower() in have:
                            continue
                        try:
                            await acc.client(JoinChannelRequest(chat))
                            joined += 1
                            self.log(f"➕ {acc.name} вступил в {chat}")
                        except errors.FloodWaitError as e:
                            acc.busy_until = time.time() + e.seconds
                            lines.append(f"{acc.name}: FloodWait {e.seconds} с — остановлено")
                            self.log(f"{acc.name}: FloodWait {e.seconds} с при вступлении", "warn")
                            break
                        except errors.ChannelsTooMuchError:
                            lines.append(f"{acc.name}: достигнут лимит 500 чатов")
                            break
                        except Exception as e:  # noqa: BLE001
                            lines.append(f"{acc.name} → {chat}: {type(e).__name__}")
                            self.log(f"{acc.name} → {chat}: {type(e).__name__}", "error")
                        await asyncio.sleep(random.uniform(lo, hi))
                    lines.append(f"{acc.name}: новых вступлений {joined}")
            finally:
                self.progress = None
        self.log("🚪 Вступление завершено")
        await self.report("Вступление завершено:\n" + "\n".join(lines))


def writes_closed(ch) -> bool:
    """True, если обычным участникам группы запрещено писать (пишут только админы)."""
    r = getattr(ch, "default_banned_rights", None)
    return bool(r and (r.send_messages or getattr(r, "send_plain", False)))


class Parser:
    """Поиск публичных групп по ключевым словам (без вступления).

    Отбирает только группы (не каналы) с числом участников не меньше parse_min_members
    и с последним сообщением не старше parse_active_days дней.
    """

    def __init__(self, pool: AccountPool, db, log_fn, on_finish=None):
        self.pool = pool
        self.db = db
        self.log = log_fn
        self.on_finish = on_finish  # async fn(entries, summary) — отправка .txt в бота
        self.progress: dict | None = None
        self._stop = False

    @property
    def busy(self) -> bool:
        return self.progress is not None

    def stop(self) -> None:
        self._stop = True

    async def _last_message_ts(self, acc: Account, ch) -> int | None:
        msgs = await acc.client.get_messages(ch, limit=1)
        return int(msgs[0].date.timestamp()) if msgs else None

    async def _members(self, acc: Account, ch) -> int | None:
        from telethon.tl.functions.channels import GetFullChannelRequest
        full = await acc.client(GetFullChannelRequest(ch))
        return full.full_chat.participants_count

    async def run(self, jobs: list[tuple[str, list[str]]]) -> None:
        """jobs — список (тема, запросы). Найденные группы сохраняются с названием темы."""
        from telethon.tl.functions.contacts import SearchRequest
        from telethon.tl.types import Channel

        acc = self.pool.next_available()
        if acc is None:
            self.log("⚠ Для парса нужен хотя бы один включённый аккаунт", "warn")
            return
        d = self.db.data
        min_members = d["parse_min_members"]
        cutoff = time.time() - d["parse_active_days"] * 86400
        parsed = d["parsed"]
        seen = ({p["link"].lower() for p in parsed} | {c.lower() for c in d["parse_rejected"]}
                | {c["link"].lower() for c in d["chats"]})  # повторы и уже добавленные в рассылку пропускаем
        self._stop = False
        total = sum(len(q) for _, q in jobs)
        self.progress = {"done": 0, "total": total, "found": 0, "checked": 0,
                         "small": 0, "inactive": 0, "channels": 0, "closed": 0,
                         "topic": jobs[0][0] if jobs else "", "mode": "search"}
        pr = self.progress
        found_now: list[dict] = []
        self.log(f"🔎 Парс начат: {len(jobs)} тем, {total} запросов, от {min_members} уч., "
                 f"активность за {d['parse_active_days']} дн. (аккаунт {acc.name})")

        async def guarded(coro):
            """Выполняет запрос; на коротком FloodWait ждёт, на длинном — останавливает парс."""
            for _ in range(3):
                try:
                    return await coro()
                except errors.FloodWaitError as e:
                    if e.seconds > 300:
                        self.log(f"🔎 FloodWait {e.seconds} с — парс остановлен, продолжите позже", "warn")
                        self._stop = True
                        return None
                    self.log(f"🔎 FloodWait {e.seconds} с — жду", "warn")
                    await asyncio.sleep(e.seconds + 2)
            return None

        try:
            for topic, q in [(t, q) for t, qs in jobs for q in qs]:
                if self._stop:
                    break
                pr["topic"] = topic
                try:
                    res = await guarded(lambda: acc.client(SearchRequest(q=q, limit=100)))
                except Exception as e:  # noqa: BLE001
                    self.log(f"🔎 «{q}»: {type(e).__name__}", "error")
                    res = None
                new = 0
                chats_ = res.chats if res else []
                log.info("parse q=%r: chats=%d groups=%d channels=%d no_username=%d", q, len(chats_),
                         sum(isinstance(c, Channel) and bool(c.megagroup) for c in chats_),
                         sum(isinstance(c, Channel) and bool(c.broadcast) for c in chats_),
                         sum(not getattr(c, "username", None) for c in chats_))
                for ch in chats_:
                    if self._stop:
                        break
                    if not isinstance(ch, Channel) or not getattr(ch, "username", None):
                        continue
                    link = "@" + ch.username
                    if link.lower() in seen:
                        continue
                    seen.add(link.lower())
                    if ch.broadcast and not ch.megagroup:
                        pr["channels"] += 1
                        continue
                    pr["checked"] += 1
                    if writes_closed(ch):
                        pr["closed"] += 1
                        d["parse_rejected"].append(link)
                        continue
                    try:
                        members = ch.participants_count
                        if members is None:
                            members = await guarded(lambda: self._members(acc, ch))
                        if (members or 0) < min_members:
                            pr["small"] += 1
                            d["parse_rejected"].append(link)
                            continue
                        last = await guarded(lambda: self._last_message_ts(acc, ch))
                        await asyncio.sleep(random.uniform(1, 2))
                    except Exception as e:  # noqa: BLE001
                        self.log(f"🔎 {link}: не удалось проверить ({type(e).__name__})", "warn")
                        continue
                    if not last or last < cutoff:
                        pr["inactive"] += 1
                        d["parse_rejected"].append(link)
                        continue
                    entry = {"link": link, "title": ch.title, "members": members, "last_ts": last,
                             "query": q, "topic": topic, "ts": int(time.time()),
                             "cid": ch.id, "ah": ch.access_hash, "rights_ok": True}
                    parsed.append(entry)
                    found_now.append(entry)
                    new += 1
                    pr["found"] += 1
                pr["done"] += 1
                if new:
                    self.log(f"🔎 [{topic}] «{q}»: подходящих групп {new}")
                self.db.save()
                await asyncio.sleep(random.uniform(3, 6))
        finally:
            self.progress = None
            self.db.save()
        summary = (f"🔎 Парс {'остановлен' if self._stop else 'завершён'}: найдено {pr['found']}; "
                   f"отсеяно — меньше {min_members} уч.: {pr['small']}, неактивных: {pr['inactive']}, "
                   f"каналов: {pr['channels']}, только для админов: {pr['closed']}")
        self.log(summary)
        if self.on_finish:
            try:
                await self.on_finish(found_now, summary)
            except Exception:  # noqa: BLE001
                log.exception("parse report failed")


async def _recheck_impl(self) -> None:
    """Проверяет уже найденные группы и чаты рассылки: где писать могут только админы —
    убирает из парса и выключает в рассылке. Без вступления, с паузами."""
    from telethon.tl.functions.channels import GetChannelsRequest
    from telethon.tl.types import InputChannel

    acc = self.pool.next_available()
    if acc is None:
        self.log("⚠ Для проверки нужен хотя бы один включённый аккаунт", "warn")
        return
    d = self.db.data
    targets = [("parsed", p) for p in d["parsed"] if not p.get("rights_ok")]
    targets += [("chat", c) for c in d["chats"] if not c.get("rights_ok")]
    self._stop = False
    self.progress = {"mode": "recheck", "done": 0, "total": len(targets), "closed": 0, "topic": ""}
    pr = self.progress
    self.log(f"🛡 Проверка прав: {len(targets)} групп")
    closed: set[str] = set()
    try:
        for kind, item in targets:
            if self._stop:
                break
            link = item["link"]
            try:
                if item.get("cid") and item.get("ah"):
                    res = await acc.client(GetChannelsRequest([InputChannel(item["cid"], item["ah"])]))
                    ch = res.chats[0]
                else:
                    ch = await acc.client.get_entity(link)
                    await asyncio.sleep(random.uniform(2, 4))  # поиск по @username лимитирован
            except errors.FloodWaitError as e:
                if e.seconds > 300:
                    self.log(f"🛡 FloodWait {e.seconds} с — проверка остановлена, запустите позже "
                             "(уже проверенные повторно не смотрим)", "warn")
                    break
                await asyncio.sleep(e.seconds + 2)
                continue
            except Exception as e:  # noqa: BLE001
                log.info("recheck %s failed: %s", link, e)
                pr["done"] += 1
                continue
            item["cid"], item["ah"] = ch.id, getattr(ch, "access_hash", None)
            if writes_closed(ch) or (getattr(ch, "broadcast", False) and not getattr(ch, "megagroup", False)):
                closed.add(link.lower())
                pr["closed"] += 1
                if kind == "chat":
                    item["enabled"] = False
                    item["last"] = {"ok": False, "text": "писать могут только админы — выключен",
                                    "ts": int(time.time()), "acc": None}
                    item["rights_ok"] = True  # проверен; выключен
            else:
                item["rights_ok"] = True
            pr["done"] += 1
            if pr["done"] % 20 == 0:
                self.db.save()
    finally:
        d["parsed"] = [p for p in d["parsed"] if p["link"].lower() not in closed]
        d["parse_rejected"] += [p for p in closed]
        self.progress = None
        self.db.save()
    self.log(f"🛡 Проверка прав завершена: проверено {pr['done']}, убрано/выключено {pr['closed']}")


Parser.recheck = _recheck_impl


def parsed_txt(entries: list[dict], title: str) -> str:
    """Текстовый файл с найденными группами, разложенными по папкам-темам."""
    by_topic: dict[str, list[dict]] = {}
    for e in entries:
        by_topic.setdefault(e.get("topic") or "Без темы", []).append(e)
    out = [title, time.strftime("%d.%m.%Y %H:%M"), f"Всего групп: {len(entries)}", ""]
    for topic, items in by_topic.items():
        items = sorted(items, key=lambda e: -(e.get("members") or 0))
        out.append(f"=== Парс тема «{topic}» ({len(items)}) ===")
        for e in items:
            members = f"{e['members']:,}".replace(",", " ") + " уч." if e.get("members") else "? уч."
            out.append(f"https://t.me/{e['link'][1:]} — {e.get('title', '')} — {members}")
        out.append("")
    out.append("=== Только ссылки (для вставки в «Добавить чаты») ===")
    out += [f"https://t.me/{e['link'][1:]}" for e in entries]
    return "\n".join(out) + "\n"


def new_post(html: str, file_id: str | None = None, mtype: str | None = None, ext: str | None = None) -> dict:
    return {"id": uuid.uuid4().hex[:8], "html": html, "file_id": file_id, "type": mtype, "ext": ext,
            "enabled": True}
