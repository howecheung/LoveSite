"""C4 双浏览器联机 E2E"""
import asyncio, json, os, urllib.request, websockets, base64
# 联调测试需环境变量：BASE(站点默认 http://127.0.0.1:8094)、E2E_BOY/E2E_GIRL/E2E_PW、
# PB_ADMIN/PB_ADMIN_PW(清理用)、CDP/CDP2(测试浏览器调试口)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "shots")
BOY = os.environ.get("E2E_BOY", "boy"); GIRL = os.environ.get("E2E_GIRL", "girl"); E2E_PW = os.environ.get("E2E_PW", "")

B = os.environ.get("CDP", "http://127.0.0.1:9333")
B2 = "http://127.0.0.1:9334"
def newtag():
    return json.loads(urllib.request.urlopen(urllib.request.Request(B+"/json/new?about:blank", method="PUT")).read())
class Tab:
    def __init__(s, name, base=None): s.name=name; s.t=None; s.ws=None; s.n=0; s.errs=[]; s.base=base or B
    async def open(s):
        s.t = json.loads(urllib.request.urlopen(urllib.request.Request(s.base+"/json/new?about:blank", method="PUT")).read())
        s.ws = await websockets.connect(s.t["webSocketDebuggerUrl"], max_size=64*1024*1024)
    async def c(s, mm, **p):
        s.n+=1
        await s.ws.send(json.dumps({"id":s.n,"method":mm,"params":p}))
        while True:
            try: r=json.loads(await asyncio.wait_for(s.ws.recv(),timeout=25))
            except asyncio.TimeoutError: return {}
            if r.get("method")=="Runtime.exceptionThrown": s.errs.append(s.name+":"+str(r["params"]["exceptionDetails"].get("exception",{}).get("description") or "")[:120])
            if r.get("method")=="Runtime.consoleAPICalled":
                m=" ".join(str(a.get("value","")) for a in r["params"].get("args",[]))
                if m.startswith("C4"): s.errs.append("LOG "+s.name+":"+m[:150])
            if r.get("id")==s.n: return r
    async def js(s, e, act=True):
        if act: await s.c("Target.activateTarget", targetId=s.t["id"])
        r = await s.c("Runtime.evaluate", expression="(async()=>{"+e+"})()", awaitPromise=True)
        rr=r.get("result",{})
        if rr.get("exceptionDetails"): return "EXC:"+str(rr["exceptionDetails"].get("exception",{}).get("description") or "")[:150]
        return rr.get("result",{}).get("value")
    async def shot(s, name):
        r = await s.c("Page.captureScreenshot", format="png")
        open(f"{SHOTS}/{name}.png","wb").write(base64.b64decode(r["result"]["data"]))
    async def close(s):
        await s.c("Target.closeTarget", targetId=s.t["id"]); await s.ws.close()

async def login(tab, ident):
    await tab.c("Page.enable"); await tab.c("Runtime.enable")
    await tab.c("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
    await tab.c("Page.navigate", url="http://127.0.0.1:8094/")
    await asyncio.sleep(2.2)
    await tab.js(f"""const r=await fetch('/api/collections/members/auth-with-password',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{identity:'{ident}',password:'{E2E_PW}'}})}});const j=await r.json();localStorage.setItem('pocketbase_auth',JSON.stringify(j));location.reload();return 1""")
    await asyncio.sleep(3.8)

async def main():
    a, bb = Tab("boy"), Tab("girl", B2)
    await a.open(); await bb.open()
    await login(a, "zwh")
    await login(bb, "mm")  # 必须串行：同源 localStorage，并行会串号
    # A 进小游戏 → 四子棋 → 建房
    await a.js("const b=[...document.querySelectorAll('.tabbar button')].find(x=>x.textContent.includes('首页'));b&&b.click();return 1")
    await asyncio.sleep(1.0)
    await a.js("const b=[...document.querySelectorAll('.tile .t')].find(x=>x.textContent.trim()==='小游戏');b&&b.click();return 1")
    await asyncio.sleep(1.3)
    print("A 游戏厅:", await a.js("const a=[...document.querySelectorAll('div,span,b')].filter(x=>x.textContent.trim()==='四子棋').pop();a&&a.click();return String(!!a)"))
    await asyncio.sleep(1.4)
    await a.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入对局室'));b&&b.click();return 1")
    await asyncio.sleep(2.2)
    code = await a.js("const m=document.body.innerText.match(/(\\d{4}) 号房/);return m?m[1]:'?'; ")
    print("A 房号:", code)
    # B 报号加入
    await bb.js("const b=[...document.querySelectorAll('.tabbar button')].find(x=>x.textContent.includes('首页'));b&&b.click();return 1")
    await asyncio.sleep(1.0)
    await bb.js("const b=[...document.querySelectorAll('.tile .t')].find(x=>x.textContent.trim()==='小游戏');b&&b.click();return 1")
    await asyncio.sleep(1.3)
    await bb.js("const a=[...document.querySelectorAll('div,span,b')].filter(x=>x.textContent.trim()==='四子棋').pop();a&&a.click();return 1")
    await asyncio.sleep(1.4)
    print("B 加入:", await bb.js(f"""const setV=(el,v)=>{{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{{bubbles:true}}))}};
      const i=document.querySelector('input[placeholder*=\"房号\"]');setV(i,'{code}');
      const b=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='加入');b&&b.click();return 'sent'"""))
    await asyncio.sleep(2.6)
    print("B 入座后状态:", (await bb.js("return document.body.innerText.slice(0,200)")).replace(chr(10),' / ')[:150])
    print("A 见双方:", '在线' in str(await a.js("return document.body.innerText")))
    # 落子：A红 col0 ×4，B黄 col1 ×3 交错
    async def drop(tab, col, wait=1.1):
        await tab.js(f"""const cs=[...document.querySelectorAll('.c4col')];cs[{col}]&&cs[{col}].click();return 'drop{col}'""")
        await asyncio.sleep(wait)
    seq = [(a,0),(bb,1),(a,0),(bb,1),(a,0),(bb,1)]
    for tab, col in seq: await drop(tab, col)
    await a.js("return 1"); await asyncio.sleep(0.8)
    await a.shot("c4_mid")
    # 盘面校验：col0 应有3红叠起
    print("盘面试样:", await a.js("""const b=[...document.querySelectorAll('.c4col')][0];return [...b.querySelectorAll('.ch')].map(h=>h.className.includes('x1')?'R':h.className.includes('x2')?'Y':'.').reverse().join('')"""))
    await drop(a, 0, 2.0)   # 第四颗 → 红胜
    await a.shot("c4_win")
    await asyncio.sleep(0.6)
    print("特效:", await a.js("return String(!!document.querySelector('.winfx'))"))
    print("胜局文案:", await a.js("const w=document.querySelector('.wtxt');return w?w.textContent:'-'"))
    await asyncio.sleep(1.5)
    # API 校验 winner + 战绩
    st = await a.js("""const tk=JSON.parse(localStorage.getItem('pocketbase_auth')).token;const r=await fetch('/api/collections/c4/records?perPage=5&sort=-created',{headers:{Authorization:tk}});const j=await r.json();const g=j.items.find(x=>x.winner);return g?g.code+'|'+g.winner+'|'+g.moves:'none'""")
    print("服务器局:", st)
    print("战绩条:", await a.js("""const tk=JSON.parse(localStorage.getItem('pocketbase_auth')).token;const r=await fetch('/api/collections/c4r/records?perPage=1&sort=-created',{headers:{Authorization:tk}});const j=await r.json();return j.totalItems+' 条 '+ (j.items[0]?j.items[0].winner+' '+j.items[0].mv+'手':'')"""))
    # 再来一局
    print("再来一局:", await bb.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='再来一局');b&&b.click();return b?'clicked':'notfound'"))
    await asyncio.sleep(2.0)
    print("B 清盘:", await bb.js("return String(!document.querySelector('.ch.x1'))"))
    # 悔棋提案冒烟：A 落一子，B 悔棋，A 同意
    await drop(a, 2)
    await drop(bb, 3)
    print("B 悔棋提案:", await bb.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='悔棋');b&&b.click();return b?'ask':'no'"))
    await asyncio.sleep(1.6)
    print("A 见横幅:", await a.js("return String(document.body.innerText.includes('请求悔棋'))"))
    await a.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s/g,'')==='同意');b&&b.click();return 1")
    await asyncio.sleep(1.8)
    print("悔棋后手:", await a.js("const m=document.body.innerText.match(/第 (\\d+) 手/);return m?m[1]:'?'"))
    print("异常:", a.errs + bb.errs or "无")
    await a.close(); await bb.close()
    TABLES = ["c4", "c4r", "gmk", "gmkr"]
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
