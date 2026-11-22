import json, re, urllib.request, os
W = os.environ.get("PBSITE_DIR", ".")
txt = os.environ.get("PB_CREDENTIALS", "")  # 超管邮箱与口令两行，自行注入
em = re.search(r"超管 (\S+)", txt).group(1)
pw = re.search(r"超管 \S+\s+(\S+)", txt).group(1)
req = urllib.request.Request("http://127.0.0.1:8094/api/collections/_superusers/auth-with-password", method="POST")
req.add_header("Content-Type", "application/json")
TOK = json.loads(urllib.request.urlopen(req, json.dumps({"identity": em, "password": pw}).encode()).read())["token"]

def api(p, m="GET", b=None):
    r2 = urllib.request.Request("http://127.0.0.1:8094" + p, method=m)
    r2.add_header("Content-Type", "application/json")
    r2.add_header("Authorization", TOK)
    d = json.dumps(b).encode() if b is not None else None
    try:
        with urllib.request.urlopen(r2, d, timeout=60) as f:
            return json.loads(f.read() or b"{}")
    except urllib.error.HTTPError as e:
        return {"_err": e.code, "_body": e.read().decode()[:300]}

AUTH = '@request.auth.id != ""'
mem = api("/api/collections/members")["id"]

def field(name, ftype, **kw): return {"name": name, "type": ftype, **kw}
AD_C = {"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False}
AD_U = {"name": "updated", "type": "autodate", "onCreate": False, "onUpdate": True}

def ensure(coll, schema):
    got = api("/api/collections/" + coll)
    out = api("/api/collections/" + coll, "PATCH", schema) if got.get("id") else api("/api/collections", "POST", schema)
    print(coll, "->", out.get("id") or out)

ensure("gmk", {
    "name": "gmk", "type": "base",
    "listRule": AUTH, "viewRule": AUTH, "createRule": AUTH,
    "updateRule": 'winner = "" && (@request.auth.id = black || @request.auth.id = white || black = "" || white = "")',
    "deleteRule": None,
    "fields": [
        field("black", "relation", maxSelect=1, cascadeDelete=False, collectionId=mem),
        field("white", "relation", maxSelect=1, cascadeDelete=False, collectionId=mem),
        field("moves", "text", max=2000),
        field("state", "select", values=["lobby", "live", "done"], maxSelect=1),
        field("winner", "text", max=6),
        field("prop", "text", max=6),
        field("propBy", "text", max=6),
        field("start", "number"),
        field("dur", "number"),
        field("bSeen", "number"), field("wSeen", "number"),
        field("bnm", "text", max=24), field("wnm", "text", max=24),
        AD_C, AD_U,
    ]})

ensure("gmkr", {
    "name": "gmkr", "type": "base",
    "listRule": AUTH, "viewRule": AUTH, "createRule": AUTH,
    "updateRule": None, "deleteRule": None,
    "fields": [
        field("game", "text", max=32),
        field("winner", "text", max=6),
        field("bn", "text", max=24), field("wn", "text", max=24),
        field("mv", "number"), field("dur", "number"),
        AD_C, AD_U,
    ]})
