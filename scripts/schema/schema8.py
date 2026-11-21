import json, re, urllib.request
txt = open("/vol1/@apphome/hermes-webui/data/workspace/ai-couple/CREDENTIALS.txt").read()
em = re.search(r"超管 (\S+)", txt).group(1); pw = re.search(r"超管 \S+\s+(\S+)", txt).group(1)
req = urllib.request.Request("http://127.0.0.1:8094/api/collections/_superusers/auth-with-password", method="POST")
req.add_header("Content-Type", "application/json")
TOK = json.loads(urllib.request.urlopen(req, json.dumps({"identity": em, "password": pw}).encode()).read())["token"]
def api(p, m="GET", b=None):
    r = urllib.request.Request("http://127.0.0.1:8094" + p, method=m)
    r.add_header("Content-Type", "application/json"); r.add_header("Authorization", TOK)
    try:
        with urllib.request.urlopen(r, json.dumps(b).encode() if b is not None else None, timeout=30) as f:
            return json.loads(f.read() or b"{}")
    except urllib.error.HTTPError as e:
        return {"_err": e.code, "_b": e.read().decode()[:300]}
c = api("/api/collections/gmk")
names = {f["name"] for f in c["fields"]}
if "code" not in names:
    mk = {"name": "code", "type": "text", "system": False, "max": 4, "min": 4}
    out = api("/api/collections/gmk", "PATCH", {"fields": c["fields"] + [mk]})
    print("code field:", "ok" if out.get("id") else out)
else:
    print("code 已存在")
