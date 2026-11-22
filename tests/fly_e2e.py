"""飞行棋 E2E：同屏完整一局 + 联机双端同步"""
import asyncio, json, os, urllib.request, websockets, base64
# 联调测试需环境变量：BASE(站点默认 http://127.0.0.1:8094)、E2E_BOY/E2E_GIRL/E2E_PW、
# PB_ADMIN/PB_ADMIN_PW(清理用)、CDP/CDP2(测试浏览器调试口)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "shots")
BOY = os.environ.get("E2E_BOY", "boy"); GIRL = os.environ.get("E2E_GIRL", "girl"); E2E_PW = os.environ.get("E2E_PW", "")

B = os.environ.get("CDP", "http://127.0.0.1:9333")
B2 = os.environ.get("CDP2", "http://127.0.0.1:9334")
class Tab:
    def __init__(s, name, base=B): s.name=name; s.n=0; s.errs=[]; s.base=base
    async def open(s):
        s.t = json.loads(urllib.request.urlopen(urllib.request.Request(s.base+"/json/new?about:blank", method="PUT")).read())
        s.ws = await websockets.connect(s.t["webSocketDebuggerUrl"], max_size=64*1024*1024)
        await s.c("Page.enable"); await s.c("Runtime.enable")
        await s.c("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
    async def c(s, mm, **p):
        s.n+=1
        await s.ws.send(json.dumps({"id":s.n,"method":mm,"params":p}))
        while True:
            try: r=json.loads(await asyncio.wait_for(s.ws.recv(),timeout=25))
            except asyncio.TimeoutError: return {}
            if r.get("method")=="Runtime.exceptionThrown": s.errs.append(s.name+":"+str(r["params"]["exceptionDetails"].get("exception",{}).get("description") or "")[:120])
            if r.get("id")==s.n: return r
    async def js(s, e):
        r = await s.c("Runtime.evaluate", expression="(async()=>{"+e+"})()", awaitPromise=True)
        rr=r.get("result",{})
        if rr.get("exceptionDetails"): return "EXC:"+str(rr["exceptionDetails"].get("exception",{}).get("description") or "")[:160]
        return rr.get("result",{}).get("value")
    async def shot(s, name):
        r = await s.c("Page.captureScreenshot", format="png")
        open(f"{SHOTS}/{name}.png","wb").write(base64.b64decode(r["result"]["data"]))
    async def login(s, ident):
        await s.c("Page.navigate", url="http://127.0.0.1:8094/")
        await asyncio.sleep(2.0)
        await s.js("const r=await fetch('/api/collections/members/auth-with-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:'"+ident+"',password:'{E2E_PW}'})});const j=await r.json();localStorage.setItem('pocketbase_auth',JSON.stringify(j));location.reload();return 1")
        await asyncio.sleep(3.8)
    async def to_games(s):
        await s.js("const b=[...document.querySelectorAll('.tabbar button')].find(x=>x.textContent.includes('首页'));b&&b.click();return 1")
        await asyncio.sleep(1.0)
        await s.js("const t=[...document.querySelectorAll('.tile .t')].find(x=>x.textContent.trim()==='小游戏');t&&t.click();return 1")
        await asyncio.sleep(1.2)
    async def close(s):
        await s.c("Target.closeTarget", targetId=s.t["id"]); await s.ws.close()

async def main():
    # —— 同屏完整一局 ——
    a = Tab("local")
    await a.open()
    await a.login("zwh")
    await a.to_games()
    await a.js("const x=[...document.querySelectorAll('div,span,b')].filter(y=>y.textContent.trim()==='情侣飞行棋').pop();x&&x.click();return 1")
    await asyncio.sleep(1.3)
    print("飞行棋大厅:", await a.js("return String(document.body.innerText.includes('同屏模式'))"))
    await a.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('同屏模式'));b&&b.click();return 1")
    await asyncio.sleep(1.3)
    await a.shot("fly_local_board")
    rounds = 0; saw_task = False
    for _ in range(140):
        st = await a.js("""
          const roll=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='掷骰子');
          const done=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('完成啦'));
          const win=document.body.innerText.includes('先落地');
          if(done){done.click();return 'task-done'}
          if(win)return 'WIN';
          if(roll&&!roll.disabled){roll.click();return 'rolled'}
          return 'wait'""")
        if st == 'task-done': saw_task = True
        if st == 'rolled': rounds += 1
        if st == 'WIN': break
        await asyncio.sleep(0.85 if st == 'rolled' else 0.35)
    print("同屏局:", rounds, "回合，遇到任务卡:", saw_task, "→ 完局:", await a.js("return String(document.body.innerText.includes('先落地'))"))
    await a.shot("fly_local_win")
    await a.close()
    # —— 联机双端同步 ——
    a2, b2 = Tab("boy"), Tab("girl", B2)
    await a2.open(); await b2.open()
    await a2.login("zwh"); await b2.login("mm")
    await a2.to_games()
    await a2.js("const x=[...document.querySelectorAll('div,span,b')].filter(y=>y.textContent.trim()==='情侣飞行棋').pop();x&&x.click();return 1")
    await asyncio.sleep(1.3)
    await a2.js("const btn=[...document.querySelectorAll('button')].find(y=>y.textContent.includes('进入棋室'));btn&&btn.click();return 1")
    await asyncio.sleep(2.2)
    code = await a2.js("const m=document.body.innerText.match(/房间号 (\\d{4})/);return m?m[1]:'?'")
    print("A 房号:", code)
    await b2.to_games()
    await b2.js("const x=[...document.querySelectorAll('div,span,b')].filter(y=>y.textContent.trim()==='情侣飞行棋').pop();x&&x.click();return 1")
    await asyncio.sleep(1.4)
    await b2.js(f"""const setV=(el,v)=>{{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{{bubbles:true}}))}};
      const i=document.querySelector('input[placeholder*="房号"]');setV(i,'{code}');
      const btn=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='加入');btn&&btn.click();return 'sent'""")
    await asyncio.sleep(3.0)
    print("B 入座:", await b2.js("return String(document.body.innerText.includes('掷骰中') || document.body.innerText.includes('轮到你'))"))
    # 各掷一次
    for tab, nm in [(a2,'boy'), (b2,'girl')]:
        st = await tab.js("""
          const roll=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='掷骰子');
          if(roll && !roll.disabled){roll.click();return 'rolled'} return 'notmyturn'""")
        print(nm, "掷:", st)
        await asyncio.sleep(1.6)
        # 若弹任务卡则完成
        st2 = await tab.js("const d=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('完成啦'));if(d){d.click();return 'task'}return 'none'")
        await asyncio.sleep(1.2)
    sync = await a2.js(f"""const tk=JSON.parse(localStorage.getItem('pocketbase_auth')||'{{}}').token;
      const rs=await (await fetch('/api/collections/fly/records?perPage=5&sort=-created',{{headers:{{Authorization:tk}}}})).json();
      const g=rs.items.find(x=>x.code==='{code}');return g?g.moves:'?'""")
    sync2 = await b2.js(f"""const tk=JSON.parse(localStorage.getItem('pocketbase_auth')||'{{}}').token;
      const rs=await (await fetch('/api/collections/fly/records?perPage=5&sort=-created',{{headers:{{Authorization:tk}}}})).json();
      const g=rs.items.find(x=>x.code==='{code}');return g?JSON.parse(g.moves).p.join('-')+' turn'+JSON.parse(g.moves).turn:'?'""")
    print("A 端 bd:", sync)
    print("B 端 p/turn:", sync2)
    await a2.shot("fly_online")
    print("异常:", a.errs + a2.errs + b2.errs or "无")
    await a2.close(); await b2.close()
    # 清理联机测试房
    import subprocess
    TABLES = ["fly", "flyr"]
    def clean_tables():
        """按 PB_ADMIN/PB_ADMIN_PW 环境变量清测试数据；未配置则跳过"""
        admin, apw = os.environ.get("PB_ADMIN", ""), os.environ.get("PB_ADMIN_PW", "")
        if not admin: return
        import urllib.error
        try:
            rq = urllib.request.Request("http://127.0.0.1:8094/api/collections/_superusers/auth-with-password", method="POST")
            rq.add_header("Content-Type", "application/json")
            T = json.loads(urllib.request.urlopen(rq, json.dumps({"identity": admin, "password": apw}).encode()).read())["token"]
            def call(p, m="GET"):
                r = urllib.request.Request("http://127.0.0.1:8094" + p, method=m)
                r.add_header("Authorization", T)
                try:
                    with urllib.request.urlopen(r, timeout=15) as f: return json.loads(f.read() or b"{}")
                except Exception: return {}
            for cn in (TABLES):
                for it in call(f"/api/collections/{cn}/records?perPage=100").get("items", []):
                    call(f"/api/collections/{cn}/records/" + it["id"], "DELETE")
            print("测试数据已清理:", TABLES)
        except Exception as e:
            print("清理跳过:", str(e)[:80])
    clean_tables()
