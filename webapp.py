"""Веб-сервер: health-check для Render, мини-апп и его API.

Каждый запрос к /api/ подписан Telegram (initData) — проверяем подпись токеном бота
и что открыл именно владелец (ADMIN_ID). Чужой человек по ссылке ничего не увидит.
"""
import contextvars
import hashlib
import hmac
import html as htmllib
import json
import logging
import os
import re
import time
from pathlib import Path
from urllib.parse import parse_qsl

from aiohttp import web

from sender import LoginError, new_post, normalize_chat

APP_HTML = Path(__file__).with_name("app.html")
CURRENT_REQ: contextvars.ContextVar = contextvars.ContextVar("current_req")


def check_init_data(init_data: str, token: str, allowed) -> bool:
    try:
        pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError:
        return False
    received = pairs.pop("hash", None)
    if not received:
        return False
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        return False
    if time.time() - int(pairs.get("auth_date", 0)) > 7 * 86400:
        return False
    try:
        uid = json.loads(pairs.get("user", "{}")).get("id")
        return uid in allowed if not callable(allowed) else allowed(uid)
    except ValueError:
        return False


BASES = {"de": "keywords.json", "nft": "keywords_nft.json", "eu": "keywords_eu.json"}


def load_sections(base: str = "de") -> list[dict]:
    """Готовые темы с ключевыми словами из выбранной базы."""
    path = Path(__file__).with_name(BASES.get(base, BASES["de"]))
    return json.loads(path.read_text("utf-8")) if path.exists() else []


def caller_id(request) -> int | None:
    try:
        pairs = dict(parse_qsl(request.headers.get("X-Init-Data", ""), keep_blank_values=True))
        return json.loads(pairs.get("user", "{}")).get("id")
    except Exception:  # noqa: BLE001
        return None


def radar_summary(ctx: dict) -> dict:
    d = ctx["db"].data
    radar = ctx.get("radar")
    counts = {"hot": 0, "warm": 0, "cold": 0}
    statuses = {"new": 0, "contacted": 0, "client": 0, "ignored": 0}
    for l in d["leads"]:
        statuses[l["status"]] = statuses.get(l["status"], 0) + 1
        if l["status"] == "new":
            counts[l["temp"]] += 1
    return {"cfg": d["radar"], "new_by_temp": counts, "by_status": statuses, "total": len(d["leads"]),
            "stats": radar.stats if radar else {}, "niche_names": radar.rules.niche_names if radar else {},
            "folders": sorted({p.get("topic") or "Без темы" for p in d["parsed"]})}


def plain(text: str, limit: int = 300) -> str:
    s = htmllib.unescape(re.sub(r"<[^>]+>", "", text or ""))
    return s if len(s) <= limit else s[:limit] + "…"


def build_state(ctx: dict, full_parsed: bool = False) -> dict:
    db, pool, mailer, login = ctx["db"], ctx["pool"], ctx["mailer"], ctx["login"]
    d = db.data
    now = time.time()
    return {
        "running": mailer.running,
        "busy": mailer.lock.locked(),
        "progress": mailer.progress,
        "next_run": int(mailer.next_run) if mailer.next_run and mailer.running else None,
        "stats": d["stats"],
        "settings": {
            "interval_min": d["interval_min"], "delay_sec": d["delay_sec"], "join_delay": d["join_delay"],
            "post_mode": d.get("post_mode", "rotate"), "notify": d.get("notify", True),
            "parse_min_members": d["parse_min_members"], "parse_active_days": d["parse_active_days"],
            "parse_variants": d.get("parse_variants", True),
        },
        "accounts": [{
            "name": a.name, "title": a.title, "enabled": pool.is_enabled(a.name),
            "pause": max(0, int(a.busy_until - now)), "note": a.note, "sent": d["acc_sent"].get(a.name, 0),
        } for a in pool.accounts],
        "broken_accounts": [n for n in d["sessions"] if n not in {a.name for a in pool.accounts}],
        "chats": d["chats"],
        "posts": [{"id": p["id"], "text": plain(p.get("html", "")), "html": p.get("html", ""),
                   "type": p.get("type"), "enabled": p.get("enabled", True)} for p in d["posts"]],
        "login_step": login.step,
        "login_where": login.where,
        "login_resend": login.can_resend,
        "parsed": d["parsed"] if full_parsed else [],
        "parsed_count": len(d["parsed"]),
        "radar": radar_summary(ctx),
        "parsing": ctx["parser"].progress,
        "logs": list(mailer.logs)[:120],
        "now": int(now),
    }


def make_app(ctx: dict) -> web.Application:
    routes = web.RouteTableDef()

    @web.middleware
    async def auth(request: web.Request, handler):
        if request.path.startswith("/api/"):
            allowed = {ctx["admin_id"], *(int(x) for x in ctx["db"].data.get("admins", []))} if ctx.get("db") else {ctx["admin_id"]}
            if not check_init_data(request.headers.get("X-Init-Data", ""), ctx["token"], allowed):
                return web.json_response({"error": "Нет доступа. Откройте панель из своего бота."}, status=401)
            if not ctx.get("ready"):
                return web.json_response({"error": "Бот ещё запускается, подождите минуту."}, status=503)
            try:
                CURRENT_REQ.set(request)
                return await handler(request)
            except LoginError as e:
                return web.json_response({"error": str(e)}, status=400)
            except (KeyError, ValueError, TypeError, StopIteration) as e:
                return web.json_response({"error": f"Неверные данные: {e}"}, status=400)
            except Exception as e:  # noqa: BLE001
                logging.exception("api error")
                return web.json_response({"error": f"{type(e).__name__}: {e}"}, status=500)
        return await handler(request)

    async def body(request) -> dict:
        try:
            return await request.json()
        except Exception:  # noqa: BLE001
            return {}

    def ok(request=None):
        req = request or CURRENT_REQ.get(None)
        full = bool(req and req.headers.get("X-Parsed") == "1")
        return web.json_response(build_state(ctx, full))



    @routes.get("/")
    @routes.get("/health")
    async def health(_):
        return web.Response(text="ok")

    @routes.get("/app")
    async def app_page(_):
        return web.Response(text=APP_HTML.read_text("utf-8"), content_type="text/html",
                            headers={"Cache-Control": "no-cache"})

    @routes.get("/api/state")
    async def state(_):
        return ok()

    # ----- рассылка -----
    @routes.post("/api/run")
    async def run(request):
        action = (await body(request)).get("action")
        m = ctx["mailer"]
        if action == "start":
            m.start()
        elif action == "stop":
            m.stop()
        elif action == "once":
            if m.lock.locked():
                raise LoginError("Уже идёт рассылка или вступление.")
            m.background(m.send_once())
        else:
            raise LoginError("Неизвестное действие")
        return ok()

    @routes.post("/api/settings")
    async def settings(request):
        b = await body(request)
        d = ctx["db"].data
        if "interval_min" in b:
            v = int(b["interval_min"])
            if v < 5:
                raise LoginError("Интервал — минимум 5 минут.")
            d["interval_min"] = v
        for key, minimum in (("delay_sec", 3), ("join_delay", 10)):
            if key in b:
                lo, hi = int(b[key][0]), int(b[key][1])
                if lo < minimum or hi < lo:
                    raise LoginError(f"Пауза: минимум {minimum} с, и «до» не меньше «от».")
                d[key] = [lo, hi]
        if "parse_min_members" in b:
            d["parse_min_members"] = max(0, int(b["parse_min_members"]))
        if "parse_variants" in b:
            d["parse_variants"] = bool(b["parse_variants"])
        if "parse_active_days" in b:
            d["parse_active_days"] = max(1, int(b["parse_active_days"]))
        if b.get("post_mode") in ("rotate", "random"):
            d["post_mode"] = b["post_mode"]
        if "notify" in b:
            d["notify"] = bool(b["notify"])
        ctx["db"].save()
        return ok()

    # ----- чаты -----
    @routes.post("/api/chats/add")
    async def chats_add(request):
        text = (await body(request)).get("text", "")
        d = ctx["db"].data
        have = {c["link"].lower() for c in d["chats"]}
        bad = []
        for token in re.split(r"[\s,;]+", text):
            if not token:
                continue
            link = normalize_chat(token)
            if link is None:
                bad.append(token)
            elif link.lower() not in have:
                d["chats"].append({"link": link, "enabled": True})
                have.add(link.lower())
        ctx["db"].save()
        res = build_state(ctx)
        res["skipped"] = bad
        return web.json_response(res)

    @routes.post("/api/chats/update")
    async def chats_update(request):
        b = await body(request)
        links = {x.lower() for x in b.get("links", [])}
        d = ctx["db"].data
        if b.get("action") == "delete":
            d["chats"] = [c for c in d["chats"] if c["link"].lower() not in links]
        elif b.get("action") in ("enable", "disable"):
            for c in d["chats"]:
                if c["link"].lower() in links:
                    c["enabled"] = b["action"] == "enable"
        ctx["db"].save()
        return ok()

    @routes.post("/api/join")
    async def join(request):
        names = (await body(request)).get("accounts")
        m = ctx["mailer"]
        if m.lock.locked():
            raise LoginError("Уже идёт рассылка или вступление.")
        m.background(m.join_all(names))
        return ok()

    # ----- парс -----
    @routes.post("/api/parse")
    async def parse(request):
        b = await body(request)
        if ctx["parser"].busy:
            raise LoginError("Парс уже идёт.")
        if b.get("all_sections"):
            jobs = [(sec["topic"], sec["queries"]) for sec in load_sections(b.get("base", "de"))]
        else:
            topic = (b.get("topic") or "").strip()[:60] or "Без темы"
            queries = [q.strip() for q in re.split(r"[\n,;]+", b.get("text", "")) if len(q.strip()) >= 3]
            if not queries:
                raise LoginError("Введите ключевые слова (минимум 3 буквы), каждое с новой строки.")
            jobs = [(topic, queries)]
        if sum(len(q) for _, q in jobs) > 5000:
            raise LoginError("Не больше 5000 запросов за раз.")
        ctx["mailer"].background(ctx["parser"].run(jobs))
        return ok()

    @routes.post("/api/parse/recheck")
    async def parse_recheck(_):
        if ctx["parser"].busy:
            raise LoginError("Сейчас идёт парс или проверка.")
        ctx["mailer"].background(ctx["parser"].recheck())
        return ok()

    @routes.post("/api/parse/stop")
    async def parse_stop(_):
        ctx["parser"].stop()
        return ok()

    @routes.get("/api/keywords")
    async def keywords(request):
        return web.json_response({"sections": load_sections(request.query.get("base", "de")),
                                  "bases": {"de": "Германия · работа и жильё", "nft": "NFT · подарки · крипта", "eu": "Европа · бизнес, фриланс, IT"}})

    @routes.post("/api/parsed/export")
    async def parsed_export(request):
        topic = (await body(request)).get("topic", "*")
        entries = [p for p in ctx["db"].data["parsed"] if topic == "*" or (p.get("topic") or "Без темы") == topic]
        if not entries:
            raise LoginError("В папке нет чатов.")
        title = "Все найденные" if topic == "*" else f"Парс тема «{topic}»"
        await ctx["send_parsed"](entries, f"📄 {title}: {len(entries)} групп")
        return ok()

    @routes.post("/api/parsed/update")
    async def parsed_update(request):
        b = await body(request)
        links = {x.lower() for x in b.get("links", [])}
        d = ctx["db"].data
        action = b.get("action")
        if action == "to_mailing":
            have = {c["link"].lower() for c in d["chats"]}
            for p in d["parsed"]:
                if p["link"].lower() in links and p["link"].lower() not in have:
                    d["chats"].append({"link": p["link"], "enabled": True, "title": p.get("title")})
                    have.add(p["link"].lower())
        elif action == "delete":
            d["parsed"] = [p for p in d["parsed"] if p["link"].lower() not in links]
        elif action == "delete_topic":
            topic = b.get("topic")
            d["parsed"] = [p for p in d["parsed"] if (p.get("topic") or "Без темы") != topic]
        elif action == "clear":
            d["parsed"] = []
            d["parse_rejected"] = []
        ctx["db"].save()
        return ok()

    # ----- команда (доступ к боту) -----
    @routes.get("/api/team")
    async def team(request):
        d = ctx["db"].data
        return web.json_response({"owner": ctx["admin_id"], "is_owner": caller_id(request) == ctx["admin_id"],
                                  "admins": d.get("admins", []), "requests": d.get("access_requests", [])})

    @routes.post("/api/team/update")
    async def team_update(request):
        if caller_id(request) != ctx["admin_id"]:
            raise LoginError("Управлять доступом может только владелец бота.")
        b = await body(request)
        action, uid = b.get("action"), int(b.get("id", 0))
        d = ctx["db"].data
        d["access_requests"] = [r for r in d["access_requests"] if r["id"] != uid]
        if action == "grant":
            if uid and uid not in d["admins"]:
                d["admins"].append(uid)
            ctx["admins_set"].add(uid)
            try:
                await ctx["bot"].send_message(uid, "✅ Вам выдан доступ к боту. Нажмите /start.")
            except Exception:  # noqa: BLE001
                pass
        elif action == "remove":
            d["admins"] = [x for x in d["admins"] if x != uid]
            ctx["admins_set"].discard(uid)
        ctx["db"].save()
        return web.json_response({"owner": ctx["admin_id"], "is_owner": True,
                                  "admins": d["admins"], "requests": d["access_requests"]})

    # ----- радар и лиды -----
    @routes.get("/api/leads")
    async def leads(request):
        q = request.query
        items = ctx["db"].data["leads"]
        status = q.get("status", "new")
        if status != "all":
            items = [l for l in items if l["status"] == status]
        if q.get("temp") in ("hot", "warm", "cold"):
            items = [l for l in items if l["temp"] == q["temp"]]
        if q.get("niche"):
            items = [l for l in items if l["niche"] == q["niche"]]
        if q.get("lang"):
            items = [l for l in items if l["lang"] == q["lang"]]
        items = sorted(items, key=lambda l: (-l["found"], -l["score"]))
        return web.json_response({"leads": items[: int(q.get("limit", 100))], "count": len(items)})

    @routes.post("/api/leads/update")
    async def leads_update(request):
        b = await body(request)
        ids, status = set(b.get("ids", [])), b.get("status")
        d = ctx["db"].data
        if b.get("action") == "clear_ignored":
            d["leads"] = [l for l in d["leads"] if l["status"] != "ignored"]
        elif status in ("new", "contacted", "client", "ignored"):
            for l in d["leads"]:
                if l["id"] in ids:
                    l["status"] = status
                    l["status_ts"] = int(time.time())
        ctx["db"].save()
        return ok()

    @routes.post("/api/radar/settings")
    async def radar_settings(request):
        b = await body(request)
        cfg = ctx["db"].data["radar"]
        if "enabled" in b:
            cfg["enabled"] = bool(b["enabled"])
            ctx["mailer"].log("🎯 Радар клиентов " + ("включён" if cfg["enabled"] else "выключен"))
        for key in ("niches", "langs", "watch_folders", "notify"):
            if key in b and isinstance(b[key], list):
                cfg[key] = [str(x) for x in b[key]][:50]
        if "watch_mailing" in b:
            cfg["watch_mailing"] = bool(b["watch_mailing"])
        if "poll_min" in b:
            cfg["poll_min"] = max(5, min(240, int(b["poll_min"])))
        if "custom_words" in b:
            cfg["custom_words"] = str(b["custom_words"])[:3000]
            ctx["radar"].reload_rules()
        ctx["db"].save()
        return ok()

    # ----- аккаунты -----
    @routes.post("/api/login")
    async def login(request):
        b = await body(request)
        flow = ctx["login"]
        step = b.get("step")
        if step == "phone":
            await flow.start(b["value"])
        elif step == "code":
            res = await flow.code(b["value"])
            if res == "done":
                ctx["mailer"].log(f"➕ Добавлен аккаунт {flow.last_added.name}: {flow.last_added.title}")
        elif step == "password":
            await flow.password(b["value"])
            ctx["mailer"].log(f"➕ Добавлен аккаунт {flow.last_added.name}: {flow.last_added.title}")
        elif step == "resend":
            await flow.resend()
        elif step == "cancel":
            await flow.cancel()
        else:
            raise LoginError("Неизвестный шаг")
        return ok()

    @routes.post("/api/accounts/code")
    async def account_code(request):
        name = (await body(request)).get("name", "")
        res = await ctx["pool"].login_code(name)
        if not res.get("ok"):
            raise LoginError(res.get("error", "Не удалось получить код."))
        return web.json_response(res)

    @routes.post("/api/accounts/update")
    async def accounts_update(request):
        b = await body(request)
        name, action = b["name"], b["action"]
        d = ctx["db"].data
        if action == "delete":
            if ctx["mailer"].lock.locked():
                raise LoginError("Дождитесь конца рассылки.")
            await ctx["pool"].remove(name)
            ctx["mailer"].log(f"🗑 Аккаунт {name} удалён")
        elif action == "disable" and name not in d["disabled_accounts"]:
            d["disabled_accounts"].append(name)
        elif action == "enable" and name in d["disabled_accounts"]:
            d["disabled_accounts"].remove(name)
        elif action == "unpause":
            for a in ctx["pool"].accounts:
                if a.name == name:
                    a.busy_until, a.note = 0, ""
        ctx["db"].save()
        return ok()

    # ----- посты -----
    @routes.post("/api/posts/save")
    async def posts_save(request):
        b = await body(request)
        d = ctx["db"].data
        html = (b.get("html") or "").strip()
        if not html:
            raise LoginError("Пустой текст.")
        if len(html) > 4096:
            raise LoginError("Слишком длинный текст (максимум 4096 символов).")
        if b.get("id"):
            for p in d["posts"]:
                if p["id"] == b["id"]:
                    if p.get("file_id") and len(html) > 1024:
                        raise LoginError("Подпись к медиа — максимум 1024 символа.")
                    p["html"] = html
        else:
            d["posts"].append(new_post(html))
        ctx["db"].save()
        return ok()

    @routes.post("/api/posts/update")
    async def posts_update(request):
        b = await body(request)
        d = ctx["db"].data
        pid, action = b["id"], b["action"]
        if action == "delete":
            d["posts"] = [p for p in d["posts"] if p["id"] != pid]
        elif action in ("enable", "disable"):
            for p in d["posts"]:
                if p["id"] == pid:
                    p["enabled"] = action == "enable"
        elif action == "preview":
            post = next(p for p in d["posts"] if p["id"] == pid)
            await send_preview(ctx, post)
        ctx["db"].save()
        return ok()

    @routes.post("/api/posts/media")
    async def posts_media(_):
        """Переводит бота в режим ожидания поста — пользователь пришлёт его в чат."""
        bot, admin = ctx["bot"], ctx["admin_id"]
        state = ctx["dp"].fsm.get_context(bot=bot, chat_id=admin, user_id=admin)
        await state.set_state(ctx["post_state"])
        await bot.send_message(admin, ctx["post_prompt"])
        return ok()

    app = web.Application(middlewares=[auth])
    app.add_routes(routes)
    return app


async def send_preview(ctx: dict, post: dict) -> None:
    bot, admin = ctx["bot"], ctx["admin_id"]
    cap = post.get("html") or None
    if not post.get("file_id"):
        await bot.send_message(admin, post["html"], parse_mode="HTML")
        return
    send = {"photo": bot.send_photo, "video": bot.send_video,
            "animation": bot.send_animation}.get(post.get("type"), bot.send_document)
    await send(admin, post["file_id"], caption=cap, parse_mode="HTML")


async def start_web_server(ctx: dict) -> None:
    runner = web.AppRunner(make_app(ctx))
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", int(os.environ.get("PORT", 10000))).start()
