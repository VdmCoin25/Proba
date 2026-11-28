"""Поиск свободных Telegram-юзернеймов: короткие (5–6 знаков) и тематические.

Проверка идёт через account.checkUsername от лица аккаунта — отвечает, свободен ли @username.
Жёсткие лимиты Telegram, поэтому между проверками паузы и распределение по аккаунтам.
Статусы: free (свободен), fragment (только через Fragment за TON), taken (занят), invalid (нельзя).
"""
import asyncio
import logging
import random
import re
import time

from telethon import errors
from telethon.tl.functions.account import CheckUsernameRequest

log = logging.getLogger("unames")

VOWELS = "aeiou"
CONS = "bcdfghjklmnprstvwz"
VALID = re.compile(r"^[a-z][a-z0-9_]{3,30}[a-z0-9]$")
PREFIXES = ["", "the", "neo", "meta", "astro", "real", "its", "my", "go", "get"]
SUFFIXES = ["", "way", "verse", "star", "light", "core", "flow", "lab", "labs", "wave", "soul", "mind",
            "sky", "void", "aura", "space", "world", "zone", "era", "hub", "pro", "x", "io", "hq"]


def valid_username(u: str) -> bool:
    u = u.lower()
    return bool(VALID.match(u)) and "__" not in u and 5 <= len(u) <= 32


def gen_short(length: int, style: str, limit: int) -> list[str]:
    """Случайная выборка коротких юзернеймов заданной длины."""
    out, seen = [], set()
    tries = 0
    while len(out) < limit and tries < limit * 40:
        tries += 1
        if style == "pronounceable":
            u = "".join((random.choice(CONS) if i % 2 == 0 else random.choice(VOWELS)) for i in range(length))
        elif style == "digits":
            u = random.choice(CONS) + "".join(random.choice("aeiou0123456789") for _ in range(length - 1))
        else:  # letters
            u = "".join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(length))
        if u not in seen and valid_username(u):
            seen.add(u)
            out.append(u)
    return out


def gen_thematic(words: list[str], limit: int) -> list[str]:
    """Комбинации слова с приставками/суффиксами и цифрами."""
    out, seen = [], set()
    bases = [re.sub(r"[^a-z0-9]", "", w.lower()) for w in words if w.strip()]
    combos = []
    for b in bases:
        if not b:
            continue
        for pre in PREFIXES:
            for suf in SUFFIXES:
                combos.append(pre + b + suf)
        for d in ("", "1", "7", "24", "01", "x"):
            combos.append(b + d)
    random.shuffle(combos)
    for u in combos:
        if len(out) >= limit:
            break
        if u not in seen and valid_username(u):
            seen.add(u)
            out.append(u)
    return out


class UsernameFinder:
    def __init__(self, pool, db, log_fn):
        self.pool = pool
        self.db = db
        self.log = log_fn
        self.progress: dict | None = None
        self._stop = False

    @property
    def busy(self) -> bool:
        return self.progress is not None

    def stop(self) -> None:
        self._stop = True

    async def run(self, mode: str, words: list[str], length: int, style: str, limit: int) -> None:
        if self.busy:
            return
        if not self.pool.active():
            self.log("⚠ Для поиска юзернеймов нужен включённый аккаунт", "warn")
            return
        limit = max(10, min(1000, limit))
        if mode == "thematic":
            cands = gen_thematic(words, limit)
            if not cands:
                self.log("⚠ Введите тематические слова (латиницей)", "warn")
                return
        else:
            cands = gen_short(length, style, limit)
        d = self.db.data
        known = {u["name"] for u in d["usernames"]}
        self._stop = False
        self.progress = {"done": 0, "total": len(cands), "free": 0, "fragment": 0, "mode": mode}
        pr = self.progress
        self.log(f"🔤 Поиск юзернеймов начат: {len(cands)} кандидатов ({mode})")
        try:
            for u in cands:
                if self._stop:
                    break
                if u in known:
                    pr["done"] += 1
                    continue
                acc = self.pool.next_available()
                if acc is None:
                    soon = min((a.busy_until for a in self.pool.active()), default=0)
                    if soon - time.time() > 600:
                        self.log("🔤 Все аккаунты на паузе — поиск остановлен, продолжите позже", "warn")
                        break
                    await asyncio.sleep(5)
                    continue
                status = await self._check(acc, u)
                if status == "flood":
                    continue  # аккаунт ушёл на паузу, кандидат возьмёт другой
                known.add(u)
                pr["done"] += 1
                if status in ("free", "fragment"):
                    d["usernames"].append({"name": u, "status": status, "ts": int(time.time())})
                    pr[status] += 1
                    self.log(f"🔤 @{u} — {'свободен' if status == 'free' else 'Fragment'}")
                if pr["done"] % 25 == 0:
                    self.db.save()
                await asyncio.sleep(random.uniform(2, 4))
        finally:
            self.progress = None
            self.db.save()
        self.log(f"🔤 Поиск завершён: свободных {pr['free']}, Fragment {pr['fragment']} из {pr['done']}")

    async def _check(self, acc, username: str) -> str:
        try:
            free = await acc.client(CheckUsernameRequest(username))
            return "free" if free else "taken"
        except errors.UsernamePurchaseAvailableError:
            return "fragment"
        except errors.UsernameInvalidError:
            return "invalid"
        except errors.FloodWaitError as e:
            acc.busy_until = time.time() + e.seconds
            acc.note = f"FloodWait {e.seconds} с (юзернеймы)"
            return "flood"
        except Exception as e:  # noqa: BLE001
            log.info("check %s: %s", username, e)
            return "taken"
