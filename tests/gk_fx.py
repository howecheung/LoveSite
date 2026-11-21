"""gk_fx: 终局特效 + 再来一局/换色 200 验证"""
import asyncio
src = open("/vol1/@apphome/hermes-webui/data/workspace/ai-couple//vol1/@apphome/hermes-webui/data/workspace/ai-couple/tests/gk_v2.py").read()
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
    await girl.open("girl@local.test", "<GIRL_PW>")
    await girl.to_gmk()
    await girl.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入棋室'));b&&b.click();return 1")
    await asyncio.sleep(2.5)
    gid = await boy.js("return [...document.querySelectorAll('.gc')].length>0 ? (window.__gid||(document.querySelector('.goban')?'in':'no')):'no'")
    # 男孩直接把棋盘做成黑五连并终局（模拟正常打完）
    fin = await boy.js("""
      const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const rs=await (await fetch('/api/collections/gmk/records?filter=winner%3D%22%22&perPage=5',{headers:{Authorization:j.token}})).json();
      const g=rs.items[0]; if(!g) return 'nogame';
      const r=await fetch('/api/collections/gmk/records/'+g.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:j.token},
        body:JSON.stringify({moves:'168,0,169,15,170,30,171,45,172',winner:'black',state:'done',dur:64})});
      return g.id+' -> HTTP '+r.status""")
    print("终局写入:", fin)
    await asyncio.sleep(2.2)
    f_g = await girl.js("return String(!!document.querySelector('.winfx'))")
    f_b = await boy.js("return String(!!document.querySelector('.winfx'))")
    print("特效出现 女孩端:", f_g, "| 男孩端:", f_b)
    winc = await girl.js("return String(document.querySelectorAll('.gc.win').length)")
    print("五连金环格数:", winc)
    await girl.shot("fx_girl"); await boy.shot("fx_boy")
    # 特效期间/之后 点再来一局（等自动收起，直接点小按钮）
    await asyncio.sleep(4.5)
    await boy.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('再来一局'));b&&b.click();return 1")
    await asyncio.sleep(2.0)
    st1 = await boy.js("""const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const g=await (await fetch('/api/collections/gmk/records?filter=winner%3D%22%22&perPage=5',{headers:{Authorization:j.token}})).json();
      return g.items.length?('winner=['+g.items[0].winner+'] moves='+(g.items[0].moves||'')):'none'""")
    print("再来一局后:", st1)
    # 换色
    await boy.js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('换色'));b&&b.click();return 1")
    await asyncio.sleep(2.0)
    st2 = await boy.js("""const j=JSON.parse(localStorage.getItem('pocketbase_auth'));
      const rs=await (await fetch('/api/collections/gmk/records?filter=winner%3D%22%22&perPage=5',{headers:{Authorization:j.token}})).json();
      const g=rs.items[0];
      const me=JSON.parse(localStorage.getItem('pocketbase_auth')).record.id;
      return 'black='+(g.black===me?'boy':'girl')+' white='+(g.white===me?'boy(我)':'girl')+' err='+g.code""")
    print("换色后座位:", st2)
    err_toast = await boy.js("return document.body.innerText.includes('没成功')?'仍有报错':'无报错'")
    print("报错胶囊:", err_toast)
    await boy.close(); await girl.close()
    print("FX DONE")
asyncio.run(main())
