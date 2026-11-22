"""v83-84 对局记录体系迁移（已在线上执行，留档可重放）：
gmk/c4/fly + round 字段；gmkr/c4r/flyr + bId/wId 字段、deleteRule 登录可删；
game 唯一索引走 collection.indexes（v0.40 text 字段没有 options.unique，静默无效）。"""
import json, urllib.request, re
import os
txt = os.environ.get("PB_CREDENTIALS", "")  # 超管邮箱与口令两行，自行注入
em = re.search(r"超管 (\S+)", txt).group(1); pw = re.search(r"超管 \S+\s+(\S+)", txt).group(1)
def adm():
    r = urllib.request.Request("http://127.0.0.1:8094/api/collections/_superusers/auth-with-password", method="POST")
    r.add_header("Content-Type", "application/json")
    return json.loads(urllib.request.urlopen(r, json.dumps({"identity": em, "password": pw}).encode()).read())["token"]
def call(p, m="GET", b=None):
    rq = urllib.request.Request("http://127.0.0.1:8094" + p, method=m)
    rq.add_header("Content-Type", "application/json"); rq.add_header("Authorization", adm())
    try:
        with urllib.request.urlopen(rq, json.dumps(b).encode() if b is not None else None, timeout=30) as f:
            return json.loads(f.read() or b"{}")
    except Exception as e:
        return {"e": str(e)[:120]}
for cn in ("gmk", "c4", "fly"):
    c = call("/api/collections/" + cn)
    if not any(f["name"] == "round" for f in c["fields"]):
        c["fields"].append({"type": "number", "name": "round", "presentable": True,
                            "options": {"min": 0, "max": 999999, "noDecimal": True}})
        print(cn, call("/api/collections/" + cn, "PATCH", {"fields": c["fields"]}).get("name", "e"))
for cn in ("gmkr", "c4r", "flyr"):
    c = call("/api/collections/" + cn)
    names = [f["name"] for f in c["fields"]]
    for add in ("bId", "wId"):
        if add not in names:
            c["fields"].append({"type": "text", "name": add})
    call("/api/collections/" + cn, "PATCH", {"fields": c["fields"], "deleteRule": '@request.auth.id != ""',
         "indexes": [f"CREATE UNIQUE INDEX `{cn}_game_uniq` ON `{cn}` (`game`)"]})
    print(cn, "ok")
