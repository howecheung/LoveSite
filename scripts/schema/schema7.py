import json, re, urllib.request
W = "/vol1/@apphome/hermes-webui/data/workspace/ai-couple"
txt = open(W + "/CREDENTIALS.txt").read()
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
        return {"_err": e.code, "_body": e.read().decode()[:400]}

# checkins：kind/per/limit/reward；现有字段必须随全量 PATCH 带上
c = api("/api/collections/checkins")
names = {f["name"] for f in c["fields"]}
add = []
def mk(name, ftype, **kw): return {"name": name, "type": ftype, "system": False, **kw}
if "kind" not in names: add.append(mk("kind", "select", values=["good", "bad"], maxSelect=1))
if "per" not in names: add.append(mk("per", "select", values=["day", "week"], maxSelect=1))
if "limit" not in names: add.append({"name": "limit", "type": "number", "system": False})
if "reward" not in names: add.append({"name": "reward", "type": "number", "system": False})
if "startD" not in names: add.append({"name": "startD", "type": "text", "system": False, "max": 10})
if add:
    out = api("/api/collections/checkins", "PATCH", {"fields": c["fields"] + add})
    print("checkins:", out.get("id") or out)
else:
    print("checkins 字段已齐")
r = api("/api/collections/ckrecords")
rn = {f["name"] for f in r["fields"]}
print("ckrecords days唯一?", [f for f in r["fields"] if f.get("unique")])
# ckrecords 需要允许同天多条（坏计数）：查现有 unique 约束
if rn:
    print("ckrecords fields:", sorted(rn))

# 给现有计划补默认值（kind=good per=day reward=1）
items = api("/api/collections/checkins/records?perPage=50")["items"]
for it in items:
    if not it.get("kind"):
        api("/api/collections/checkins/records/" + it["id"], "PATCH",
            {"kind": "good", "per": "day", "limit": 1, "reward": 1, "startD": it["created"][:10]})
print("默认值补齐", len(items), "条")
