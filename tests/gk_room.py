"""gk_room: 房号加入 + 悔棋只退一手 + 穿模复查"""
import asyncio, re
src = open("gk_v2.py").read()
src = src.split("asyncio.run(")[0]
ns = {}
exec(compile(src, "gk_v2_lib", "exec"), ns)
PG = ns["PG"]

async def main():
    boy = PG(); girl = PG()
    await boy.open("boy@local.test", "<BOY_PW>")
    await boy.to_gmk()
    await boy.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入棋室'));b&&b.click();return 1")
    await asyncio.sleep(2.5)
    code = await boy.js("""const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const rs=await (await fetch('/api/collections/gmk/records?filter=winner%3D%22%22&perPage=3',{headers:{Authorization:j.token}})).json();
      const g=rs.items[0];
      return (g&&g.code)?g.code:'NONE'""")
    print("男孩房号:", code)
    await girl.open("girl@local.test", "<GIRL_PW>")
    await girl.to_gmk()
    # 输错房号
    await girl.js("const i=[...document.querySelectorAll('input')].find(x=>x.placeholder.includes('房号'));return !!i")
    await girl.js("const i=[...document.querySelectorAll('input')].find(x=>x.placeholder.includes('房号'));"
                 "const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;st.call(i,'0000');i.dispatchEvent(new Event('input',{bubbles:true}));return 1")
    await girl.js("const b=[...document.querySelectorAll('button')].filter(x=>x.textContent==='加入').pop();b&&b.click();return 1")
    await asyncio.sleep(1.6)
    t1 = await girl.js("const el=document.getElementById('errtoast');return el&&el.classList.contains('show')?el.textContent:'(无提示)'")
    print("错号提示:", t1)
    # 输对房号
    await girl.js("const i=[...document.querySelectorAll('input')].find(x=>x.placeholder.includes('房号'));"
                 "const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;"
                 "st.call(i,'" + code + "');"
                 "i.dispatchEvent(new Event('input',{bubbles:true}));return 1")
    await girl.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='加入');b&&b.click();return 1")
    await asyncio.sleep(2.5)
    inb = await girl.js("return String(!!document.querySelector('.goban'))")
    same = await girl.js("return String(document.body.innerText.indexOf('" + code + "') >= 0)")
    print("女孩经房号进席:", inb, "| 页面上见房号:", same)
    # 男孩页面刷新拿最新对局态（跳过 lobby 残留），再落两手
    await boy.js("location.reload();return 1"); await asyncio.sleep(4)
    await boy.to_gmk()
    await boy.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入棋室')||x.textContent.includes('继续对局'));b&&b.click();return !!b")
    await asyncio.sleep(2.5)
    await boy.js("document.querySelectorAll('.gc')[112].click();return 1"); await asyncio.sleep(1.8)
    await girl.js("document.querySelectorAll('.gc')[113].click();return 1"); await asyncio.sleep(1.8)
    st = await boy.js("return (document.body.innerText.match(/第 \\d+ 手/g)||[])[0]")
    print("两手后:", st)
    # 男孩发起悔棋 → 女孩同意
    await boy.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='悔棋');b&&b.click();return !!b")
    await asyncio.sleep(1.8)
    okb = await girl.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='同意');return !!b")
    await girl.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='同意');b&&b.click();return 1")
    await asyncio.sleep(2.2)
    mv = await boy.js("""const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const rs=await (await fetch('/api/collections/gmk/records?filter=winner%3D%22%22&perPage=3',{headers:{Authorization:j.token}})).json();
      return 'moves=['+(rs.items[0].moves||'')+']'""")
    print("悔棋发起方:", okb, "|", mv, "→ 期望 moves=['113:2'] 只退男孩那颗")
    nxt = await boy.js("return (document.body.innerText.match(/第 \\d+ 手 · [^\\n]*/g)||[])[0]")
    print("悔棋后状态行:", nxt)
    err = await boy.js("const el=document.getElementById('errtoast');return el&&el.classList.contains('show')?el.textContent:'无报错'")
    print("报错胶囊:", err)
    # 穿模检查截图
    await boy.shot("room_board")
    await boy.close(); await girl.close()
    print("ROOM DONE")
asyncio.run(main())
