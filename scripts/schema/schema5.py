import json, re, urllib.request, urllib.error
W = os.environ.get("PBSITE_DIR", ".")
import os
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
        with urllib.request.urlopen(r2, d, timeout=30) as f:
            return f.status, json.loads(f.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:400]
st, c = api("/api/collections/members")
print("updateRule:", repr(c.get("updateRule")), "| deleteRule:", repr(c.get("deleteRule")))
fields = c["fields"]
if not any(x["name"] == "avatar" for x in fields):
    fields = fields + [{"type": "file", "name": "avatar", "maxSelect": 1, "maxSize": 4194304,
                        "mimeTypes": ["image/jpeg", "image/png", "image/webp", "image/gif"],
                        "thumbs": [], "original": True, "present": False}]
    st2, r2 = api("/api/collections/members", "PATCH", {"fields": fields})
    print("add avatar ->", st2, r2 if st2 != 200 else "ok")
else:
    print("avatar exists")
