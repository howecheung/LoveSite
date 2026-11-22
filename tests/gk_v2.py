"""gk_v2: 每步 dump，串行推进"""
import asyncio, json, base64, urllib.request, websockets, os
B = "http://127.0.0.1:9333"
OUT = os.environ.get("PB_OUT_DIR", ".")

class PG:
    def __init__(self): self.n = 0
    async def open(self, ident, pw):
        t = json.loads(urllib.request.urlopen(urllib.request.Request(B + "/json/new?about:blank", method="PUT")).read())
        self.t = t
        self.ws = await websockets.connect(t["webSocketDebuggerUrl"], max_size=64*1024*1024)
        await self.c("Page.enable"); await self.c("Runtime.enable")
        await self.c("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
        await self.c("Page.navigate", url="http://127.0.0.1:8094/")
        await asyncio.sleep(2.5)
        await self.rawjs(f"""const r=await fetch('/api/collections/members/auth-with-password',{{method:'POST',headers:{{'Content-Type':'application/json'}},
          body:JSON.stringify({{identity:'{ident}',password:'{pw}'}})}});
          const j=await r.json();localStorage.setItem('pocketbase_auth',JSON.stringify(j));setTimeout(()=>location.reload(),50);return 1""")
        await asyncio.sleep(4)
    async def c(self, m, **p):
        self.n += 1
        await self.ws.send(json.dumps({"id": self.n, "method": m, "params": p}))
        while True:
            try: r = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=20))
            except asyncio.TimeoutError: return {}
            if r.get("id") == self.n: return r
    async def rawjs(self, e):
        r = await self.c("Runtime.evaluate", expression="(async()=>{" + e + "})()", awaitPromise=True)
        rr = r.get("result", {})
        if rr.get("exceptionDetails"): print("   EXC", str(rr["exceptionDetails"])[:140])
        return rr.get("result", {}).get("value")
    async def js(self, e):
        await self.c("Target.activateTarget", targetId=self.t["id"])
        await asyncio.sleep(0.35)
        return await self.rawjs(e)
    async def dump(self, tag):
        txt = await self.js("return document.body.innerText.slice(0,110).replace(/\\n/g,'|')")
        print(f"   [{tag}] {txt}")
    async def until(self, expr, tries=14):
        for _ in range(tries):
            if await self.js("return " + expr) == "true": return True
            await asyncio.sleep(1)
        return False
    async def shot(self, name):
        await self.c("Target.activateTarget", targetId=self.t["id"])
        s = await self.c("Page.captureScreenshot", format="png")
        if "result" in s: open(f"{OUT}/{name}.png", "wb").write(base64.b64decode(s["result"]["data"]))
    async def to_gmk(self):
        for kw, sel in [("首页", ".tabbar button"), ("小游戏", ".tile"), ("五子棋", ".li")]:
            await self.js(f"const b=[...document.querySelectorAll('{sel}')].find(x=>x.textContent.includes('{kw}'));b&&b.click();return 1")
            await asyncio.sleep(2)
    async def close(self):
        await self.c("Target.closeTarget", targetId=self.t["id"]); await self.ws.close()

async def main():
    boy = PG(); girl = PG()
    await boy.open("boy@local.test", "<BOY_PW>")
    await boy.js("""const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const rs=await (await fetch('/api/collections/gmk/records?perPage=50',{headers:{Authorization:j.token}})).json();
      for(const x of rs.items){await fetch('/api/collections/gmk/records/'+x.id,{method:'DELETE',headers:{Authorization:j.token}}).catch(()=>{})}
      return rs.items.length""")
    await boy.to_gmk()
    print("男孩开房:", await boy.until("String(document.body.innerText.includes('开对局室'))"))
    await boy.js("[...document.querySelectorAll('button')].find(x=>x.textContent.includes('开对局室'))?.click();return 1")
    print("等待席:", await boy.until("String(!!document.querySelector('.goban'))"))
    gid = await boy.js("""const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const d=await (await fetch('/api/collections/gmk/records?filter='+encodeURIComponent("state='lobby'")+'&sort=-created',{headers:{Authorization:j.token}})).json();
      return d.items[0].id""")
    print("房 id:", gid)
    await boy.shot("gv2_wait")
    await girl.open("girl@local.test", "<GIRL_PW>")
    await girl.to_gmk()
    ok = await girl.until("String(document.body.innerText.includes('的棋室'))")
    print("女孩见棋室:", ok)
    if not ok: await girl.dump("girl卡在哪")
    await girl.js("[...document.querySelectorAll('.li')].find(x=>x.textContent.includes('的棋室'))?.click();return 1")
    entered = await girl.until("String(!!document.querySelector('.goban')||document.body.innerText.includes('加入执'))")
    where = await girl.js("return String(!!document.querySelector('.goban'))")
    print("女孩进对局(直落):", where)
    if where != "true":
        # 落在等待席：手动执白加入
        await girl.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('执白')||x.textContent.includes('加入执'));b&&b.click();return 1")
        print("补点后 Goban:", await girl.until("String(!!document.querySelector('.goban'))"))
    await boy.shot("gv2_boy_live")
    print("男孩见女孩:", await boy.js("return String(document.body.innerText.includes('女孩'))"))
    async def mv(pg, i):
        opp = girl if pg is boy else boy
        n0 = await pg.js("return String(document.querySelectorAll('.gc i').length)")
        await pg.js(f"document.querySelectorAll('.gc')[{i}]?.click();return 1")
        for _ in range(10):
            await asyncio.sleep(0.9)
            if await opp.js("return String(document.querySelectorAll('.gc i').length)") != n0: return True
        return False
    okc = 0
    for pg, i in [(boy, 84), (girl, 85), (boy, 99), (girl, 100), (boy, 114), (girl, 115), (boy, 129), (girl, 130), (boy, 144)]:
        if await mv(pg, i): okc += 1
        else: await pg.dump(f"手{i}失败")
    print("互下:", okc, "/9")
    print("男孩判胜:", await boy.until("String(document.body.innerText.includes('赢啦')||document.body.innerText.includes('五连获胜'))"))
    print("女孩终局:", await girl.until("String(document.body.innerText.includes('差一点')||document.body.innerText.includes('五连获胜')||document.body.innerText.includes('再来一局'))"))
    await boy.shot("gv2_win")
    g = await boy.js("""const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const d=await (await fetch('/api/collections/gmkr/records',{headers:{Authorization:j.token}})).json();
      return JSON.stringify(d.items.map(x=>({w:x.winner,mv:x.mv,bn:x.bn,wn:x.wn})))""")
    print("战绩:", g)
    await girl.js("[...document.querySelectorAll('button')].find(x=>x.textContent.includes('再来一局'))?.click();return 1")
    print("双端重开同步:", await boy.until("String(document.querySelectorAll('.gc i').length===0)"), await girl.js("return String(document.querySelectorAll('.gc i').length===0)"))
    await mv(boy, 120)
    await girl.to_gmk()
    print("续战卡:", await girl.until("String(document.body.innerText.includes('继续对局'))"))
    await girl.js("document.querySelector('.gmk-hero')?.click();return 1")
    print("续战回显子数:", await girl.until("String(document.querySelectorAll('.gc i').length>=1)"), await girl.js("return String(document.querySelectorAll('.gc i').length)"))
    await girl.shot("gv2_resume")
    await boy.js("[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='悔棋')?.click();return 1")
    print("女孩收悔棋横幅:", await girl.until("String(document.body.innerText.includes('请求悔棋'))"))
    await girl.js("[...document.querySelectorAll('.propbar button')].find(x=>x.textContent.includes('同意'))?.click();return 1")
    print("悔棋生效(0子):", await boy.until("String(document.querySelectorAll('.gc i').length===0)"))
    await girl.js("[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='认输')?.click();return 1")
    print("认输终局男孩见胜:", await boy.until("String(document.body.innerText.includes('赢啦')||document.body.innerText.includes('五连获胜'))"))
    await boy.shot("gv2_final")
    await boy.close(); await girl.close()
    print("ALL DONE")
asyncio.run(main())
