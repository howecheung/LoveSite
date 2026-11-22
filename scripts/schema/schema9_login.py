import json, re, urllib.request, os
W = os.environ.get("PBSITE_DIR", ".")
txt = os.environ.get("PB_CREDENTIALS", "")  # 超管邮箱与口令两行，自行注入
em = re.search(r"超管 (\S+)", txt).group(1); pw = re.search(r"超管 \S+\s+(\S+)", txt).group(1)
TOK = None
def req(p, m="GET", b=None):
    r = urllib.request.Request("http://127.0.0.1:8094" + p, method=m)
    r.add_header("Content-Type", "application/json")
    if TOK: r.add_header("Authorization", TOK)
    try:
        with urllib.request.urlopen(r, json.dumps(b).encode() if b is not None else None, timeout=30) as f:
            return json.loads(f.read() or b"{}")
    except urllib.error.HTTPError as e:
        return {"_err": e.code, "_b": e.read().decode()[:250]}
TOK = req("/api/collections/_superusers/auth-with-password", "POST", {"identity": em, "password": pw}).get("token")

# 1) members 加 username 字段（唯一）+ 登录身份允许 username
c = req("/api/collections/members")
fields = c["fields"]
if not any(f.get("name") == "username" for f in fields):
    uf = {"type": "text", "name": "username", "system": False, "presentable": True, "unique": True,
          "options": {"min": 1, "max": 30, "pattern": ""}}
    out = req("/api/collections/members", "PATCH", {"fields": fields + [uf]})
    print("加 username 字段:", "ok" if out.get("id") or "username" in json.dumps(out) else str(out)[:180])
c = req("/api/collections/members")
idxs = list(c.get("indexes") or [])
uidx = "CREATE UNIQUE INDEX idx_username ON members (username)"
if not any("username" in i for i in idxs):
    idxs.append(uidx)
    out = req("/api/collections/members", "PATCH", {"indexes": idxs})
    print("唯一索引:", "ok" if not out.get("_err") else str(out)[:150])
c = req("/api/collections/members")
pa = dict(c.get("passwordAuth") or {})
if "username" not in (pa.get("identityFields") or []):
    pa["identityFields"] = list(pa.get("identityFields") or ["email"]) + ["username"]
    out = req("/api/collections/members", "PATCH", {"passwordAuth": pa})
    print("identityFields:", pa["identityFields"], "→", "ok" if not out.get("_err") else str(out)[:150])

# 2) 设账号
for mail, uname, upw in [("boy@local.test", "zwh", "123"), ("girl@local.test", "mm", "123")]:
    rid = req(f"/api/collections/members/records?filter=email='{mail}'")["items"][0]["id"]
    t = req(f"/api/collections/members/records/{rid}", "PATCH", {"username": uname, "password": upw, "passwordConfirm": upw})
    print(f"{mail} → {uname}/{upw}:", "成功" if t.get("id") else str(t)[:150])

# 3) 实测登录（用用户名 + 短密码）
for u in ["zwh", "mm"]:
    ok = req("/api/collections/members/auth-with-password", "POST", {"identity": u, "password": "123"})
    print(f"用 {u} / 123 登录:", "✓ 成功" if ok.get("token") else str(ok)[:130])
# 旧邮箱登录仍可用？
ok = req("/api/collections/members/auth-with-password", "POST", {"identity": "boy@local.test", "password": "123"})
print("邮箱+新密码登录:", "✓ 可用" if ok.get("token") else "不可用")
