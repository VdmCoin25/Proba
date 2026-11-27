"""Радар клиентов: ищет в Telegram-чатах сообщения, где люди ищут услугу, и оценивает их.

Источники сообщений:
  1. события — новые сообщения в чатах, где состоят аккаунты (бесплатно, мгновенно);
  2. опрос — раз в N минут читает новые сообщения выбранных публичных групп без вступления
     (папки парса и «Чаты для рассылок»).
Каждое сообщение проходит через правила (radar_rules.json): нужна фраза-запрос («ищу», «busco»,
«looking for»…) и тема ниши; предложения услуг отсекаются. Оценка 0–100 → 🔥/🌤/❄️.
Лиды хранятся в db.data["leads"] (общая воронка для всех источников: telegram, reddit, threads…).
"""
import asyncio
import hashlib
import json
import logging
import random
import re
import time
from collections import deque
from pathlib import Path

from telethon import errors, events
from telethon.tl.types import Channel, InputPeerChannel

log = logging.getLogger("radar")

RULES_PATH = Path(__file__).with_name("radar_rules.json")
LANG_ORDER = ["uk", "ru", "de", "es", "pt", "fr", "it", "pl", "en"]
TEMPS = (("hot", 70), ("warm", 50), ("cold", 0))
MIN_SCORE = 35          # ниже — не сохраняем
MAX_LEADS = 2000        # сколько лидов держим в воронке
SAVE_EVERY = 300        # секунд между сохранениями резервной копии из-за новых лидов


def _rx(words: list[str]) -> re.Pattern | None:
    """Регулярка «начало слова»; слово с ! на конце — только целиком."""
    parts = []
    for w in {w.lower().strip() for w in words if w and w.strip()}:
        whole = w.endswith("!")
        w = w.rstrip("!")
        if not w:
            continue
        p = re.escape(w)
        if w[0].isalnum():
            p = r"(?<!\w)" + p
        if whole and w[-1].isalnum():
            p += r"(?!\w)"
        parts.append((len(w), p))
    if not parts:
        return None
    parts.sort(reverse=True)
    return re.compile("(" + "|".join(p for _, p in parts) + ")", re.IGNORECASE)


class Rules:
    def __init__(self, extra_words: list[str] | None = None):
        r = json.loads(RULES_PATH.read_text("utf-8"))
        self.intent = {lang: _rx(r["intent"][lang]) for lang in LANG_ORDER if lang in r["intent"]}
        self.niche_names = {k: v["name"] for k, v in r["niches"].items()}
        self.niches = {k: _rx(v["words"]) for k, v in r["niches"].items()}
        if extra_words:
            self.niche_names["custom"] = "Свои слова"
            self.niches["custom"] = _rx(extra_words)
        self.exclude = _rx(r["exclude"])
        self.budget = _rx(r["budget"])
        self.urgent = _rx(r["urgent"])

    def analyze(self, text: str, niches: list[str], langs: list[str]) -> dict | None:
        if not text:
            return None
        t = text.lower()
        if len(t) < 12 or len(t) > 2000:
            return None
        if self.exclude and self.exclude.search(t):
            return None
        lang = intent = None
        for code, rx in self.intent.items():
            if code in langs and rx:
                m = rx.search(t)
                if m:
                    lang, intent = code, m.group(1)
                    break
        if not lang:
            return None
        best = None
        for nid, rx in self.niches.items():
            if (nid not in niches and nid != "custom") or not rx:
                continue
            found = {m.group(1) for m in rx.finditer(t)}
            if found and (best is None or len(found) > len(best[1])):
                best = (nid, found)
        if not best:
            return None

        score = 45 + min(15, 5 * (len(best[1]) - 1))
        reasons = [f"запрос «{intent}»", "тема: " + ", ".join(sorted(best[1])[:4])]
        if "?" in t:
            score += 10
        if self.budget and self.budget.search(t):
            score += 20
            reasons.append("есть бюджет/оплата")
        if self.urgent and self.urgent.search(t):
            score += 10
            reasons.append("срочно")
        if len(t) < 300:
            score += 5
        elif len(t) > 700:
            score -= 15
        if len(re.findall(r"https?://|t\.me/", t)) >= 2:
            score -= 25
            reasons.append("много ссылок")
        if sum(1 for ch in text if ord(ch) >= 0x1F300) > 6:
            score -= 15
            reasons.append("много эмодзи")
        score = max(0, min(100, score))
        temp = next(name for name, lo in TEMPS if score >= lo)
        return {"niche": best[0], "lang": lang, "score": score, "temp": temp,
                "matched": sorted(best[1])[:6], "reasons": reasons}


def _norm(text: str) -> str:
    return re.sub(r"\W+", " ", text.lower()).strip()


class Radar:
    def __init__(self, pool, db, log_fn, notify_lead):
        self.pool = pool
        self.db = db
        self.log = log_fn
        self.notify_lead = notify_lead      # async fn(lead)
        self.rules = self._build_rules()
        self._attached: set[int] = set()
        self._seen_msgs: deque = deque(maxlen=20000)
        self._seen_set: set = set()
        self._fps = {l["id"] for l in self.d["leads"]}
        self._dirty = False
        self._last_save = time.time()
        self.stats = {"checked": 0, "leads": 0, "polled": 0, "cycle_ts": None, "cycle_chats": 0,
                      "listening": 0, "started": int(time.time())}
        self._tasks: list[asyncio.Task] = []

    # ---------- настройки ----------
    @property
    def d(self) -> dict:
        return self.db.data

    @property
    def cfg(self) -> dict:
        return self.d["radar"]

    def _build_rules(self) -> Rules:
        extra = [w.strip() for w in re.split(r"[,\n;]+", self.d["radar"].get("custom_words", "")) if w.strip()]
        return Rules(extra)

    def reload_rules(self) -> None:
        self.rules = self._build_rules()

    @property
    def enabled(self) -> bool:
        return self.cfg.get("enabled", False)

    # ---------- запуск ----------
    def start(self) -> None:
        self.attach()
        self._tasks.append(asyncio.create_task(self._poll_loop()))
        self._tasks.append(asyncio.create_task(self._housekeeping()))

    def attach(self) -> None:
        """Вешает обработчик новых сообщений на каждый аккаунт (новые аккаунты — при следующем вызове)."""
        for acc in self.pool.accounts:
            key = id(acc.client)
            if key in self._attached:
                continue
            acc.client.add_event_handler(self._make_handler(acc), events.NewMessage(incoming=True))
            self._attached.add(key)
        self.stats["listening"] = len(self.pool.accounts)

    def _make_handler(self, acc):
        async def handler(event):
            if not self.enabled or event.is_private:
                return
            try:
                chat = await event.get_chat()
                if isinstance(chat, Channel) and chat.broadcast and not chat.megagroup:
                    return
                sender = await event.get_sender()
                await self.process(chat.id, getattr(chat, "title", ""), getattr(chat, "username", None),
                                   event.message, sender)
            except Exception:  # noqa: BLE001
                log.exception("radar handler")
        return handler

    async def _housekeeping(self) -> None:
        while True:
            await asyncio.sleep(60)
            self.attach()
            if self._dirty and time.time() - self._last_save > SAVE_EVERY:
                self._dirty = False
                self._last_save = time.time()
                self.db.save()

    # ---------- обработка сообщения ----------
    async def process(self, chat_id, chat_title, chat_username, msg, sender) -> dict | None:
        key = (chat_id, msg.id)
        if key in self._seen_set:
            return None
        if len(self._seen_msgs) == self._seen_msgs.maxlen:
            self._seen_set.discard(self._seen_msgs[0])
        self._seen_msgs.append(key)
        self._seen_set.add(key)
        self.stats["checked"] += 1

        if sender is not None and (getattr(sender, "bot", False)
                                   or getattr(sender, "id", None) in {a.uid for a in self.pool.accounts}):
            return None
        text = msg.message or ""
        cfg = self.cfg
        res = self.rules.analyze(text, cfg["niches"], cfg["langs"])
        if not res or res["score"] < MIN_SCORE:
            return None

        author_id = getattr(sender, "id", None)
        fp = hashlib.sha1(f"{author_id}|{_norm(text)[:200]}".encode()).hexdigest()[:16]
        if fp in self._fps:
            return None
        now = time.time()
        for l in reversed(self.d["leads"][-300:]):  # тот же автор и ниша за сутки — не дублируем
            if (l.get("author", {}).get("id") == author_id and author_id and l["niche"] == res["niche"]
                    and now - l["found"] < 86400):
                return None

        uname = getattr(sender, "username", None)
        name = " ".join(filter(None, [getattr(sender, "first_name", None), getattr(sender, "last_name", None)]))
        url = (f"https://t.me/{chat_username}/{msg.id}" if chat_username
               else f"https://t.me/c/{str(chat_id).removeprefix('-100')}/{msg.id}")
        lead = {
            "id": fp, "source": "telegram", "chat": chat_title or "", "chat_link": f"@{chat_username}" if chat_username else None,
            "url": url, "author": {"id": author_id, "username": uname, "name": name or getattr(sender, "title", "") or ""},
            "text": text[:1200], "ts": int(msg.date.timestamp()) if msg.date else int(now), "found": int(now),
            "status": "new", **res,
        }
        self._fps.add(fp)
        leads = self.d["leads"]
        leads.append(lead)
        if len(leads) > MAX_LEADS:  # выкидываем самые старые не-клиентские
            drop = len(leads) - MAX_LEADS
            keep = []
            for l in leads:
                if drop and l["status"] in ("new", "ignored"):
                    drop -= 1
                    self._fps.discard(l["id"])
                    continue
                keep.append(l)
            self.d["leads"] = keep
        self.stats["leads"] += 1
        self._dirty = True
        log.info("lead %s %s %s: %s", lead["temp"], lead["score"], lead["niche"], text[:80].replace("\n", " "))
        if lead["temp"] in cfg.get("notify", ["hot"]):
            try:
                await self.notify_lead(lead)
            except Exception:  # noqa: BLE001
                log.exception("lead notify failed")
        return lead

    # ---------- опрос публичных групп ----------
    def _poll_targets(self) -> list[dict]:
        cfg, d = self.cfg, self.d
        first_acc = next(iter(d["sessions"]), None)
        out, seen = [], set()
        if cfg.get("watch_mailing", True):
            for c in d["chats"]:
                if c.get("enabled", True):
                    out.append({"link": c["link"], "title": c.get("title")})
        folders = set(cfg.get("watch_folders", []))
        if folders:
            for p in d["parsed"]:
                if (p.get("topic") or "Без темы") in folders or "*" in folders:
                    out.append({"link": p["link"], "title": p.get("title"), "cid": p.get("cid"),
                                "ah": p.get("ah"), "acc": p.get("acc") or first_acc})
        res = []
        for t in out:
            k = t["link"].lower()
            if k not in seen:
                seen.add(k)
                res.append(t)
        return res[: cfg.get("max_chats", 600)]

    async def _peer(self, t: dict):
        """Возвращает (аккаунт, peer) для чата; access_hash привязан к аккаунту, поэтому кешируем пару."""
        st = self.d["radar_state"].setdefault(t["link"].lower(), {})
        accs = {a.name: a for a in self.pool.active()}
        name = st.get("acc") or t.get("acc")
        cid, ah = st.get("cid") or t.get("cid"), st.get("ah") or t.get("ah")
        if name in accs and cid and ah:
            acc = accs[name]
            if not acc.available:
                return None, None
            return acc, InputPeerChannel(cid, ah)
        acc = self.pool.next_available()
        if acc is None:
            return None, None
        ent = await acc.client.get_input_entity(t["link"])  # один раз на чат (лимитированный запрос)
        st.update(acc=acc.name, cid=getattr(ent, "channel_id", None), ah=getattr(ent, "access_hash", None))
        await asyncio.sleep(random.uniform(2, 4))
        return acc, ent

    async def _poll_loop(self) -> None:
        await asyncio.sleep(30)
        while True:
            if not self.enabled or not self.pool.active():
                await asyncio.sleep(30)
                continue
            started = time.time()
            targets = self._poll_targets()
            self.stats["cycle_chats"] = len(targets)
            fresh = time.time() - 86400
            for t in targets:
                if not self.enabled:
                    break
                st = self.d["radar_state"].setdefault(t["link"].lower(), {})
                if st.get("bad", 0) >= 3:
                    continue
                try:
                    acc, peer = await self._peer(t)
                    if acc is None:
                        await asyncio.sleep(10)
                        continue
                    msgs = await acc.client.get_messages(peer, limit=40, min_id=st.get("last_id", 0))
                    self.stats["polled"] += 1
                    for m in reversed(msgs):
                        if not m.message or (m.date and m.date.timestamp() < fresh):
                            continue
                        sender = await m.get_sender()
                        await self.process(st.get("cid") or getattr(peer, "channel_id", 0),
                                           t.get("title") or "", t["link"][1:], m, sender)
                    if msgs:
                        st["last_id"] = max(st.get("last_id", 0), max(m.id for m in msgs))
                    st["bad"] = 0
                except errors.FloodWaitError as e:
                    acc.busy_until = time.time() + e.seconds
                    acc.note = f"FloodWait {e.seconds} с (радар)"
                except (errors.ChannelPrivateError, errors.UsernameNotOccupiedError, errors.UsernameInvalidError,
                        ValueError):
                    st["bad"] = st.get("bad", 0) + 1
                except Exception as e:  # noqa: BLE001
                    log.info("radar poll %s: %s", t["link"], e)
                    st["bad"] = st.get("bad", 0) + 1
                await asyncio.sleep(random.uniform(4, 7))
            self.stats["cycle_ts"] = int(time.time())
            self._dirty = True
            wait = self.cfg.get("poll_min", 15) * 60 - (time.time() - started)
            await asyncio.sleep(max(60, wait))
