// ai-couple 备份接口（PocketBase v0.40 JSVM；逻辑统一在 backup.py）
// 注意此环境 goja 限制：const+function 声明闭包引用会 ReferenceError，
// 故全部用 var + 处理器内联实现（对照官方 examples 风格）。
routerAdd("POST", "/api/ai/backup/run", (e) => {
  if (!e.auth) { e.json(401, { code: 401, message: "需要登录" }); return }
  var cmd = $os.cmd("/vol1/@apphome/hermes-webui/data/venv/bin/python",
    "/vol1/@apphome/hermes-webui/data/workspace/ai-couple/backup.py", "--force")
  var out = toString(cmd.output())
  e.json(200, { output: out })
})

routerAdd("POST", "/api/ai/backup/test-dav", (e) => {
  if (!e.auth) { e.json(401, { code: 401, message: "需要登录" }); return }
  var cmd2 = $os.cmd("/vol1/@apphome/hermes-webui/data/venv/bin/python",
    "/vol1/@apphome/hermes-webui/data/workspace/ai-couple/backup.py", "--test-dav")
  var text = toString(cmd2.output())
  var parsed = null
  try {
    var lines = text.trim().split("\n")
    parsed = JSON.parse(lines[lines.length - 1])
  } catch (err) {
    parsed = { ok: false, detail: "脚本无 JSON 输出：" + text.slice(0, 300) }
  }
  e.json(200, parsed)
})

routerAdd("GET", "/api/ai/backup/list", (e) => {
  if (!e.auth) { e.json(401, { code: 401, message: "需要登录" }); return }
  var cmd3 = $os.cmd("/vol1/@apphome/hermes-webui/data/venv/bin/python",
    "/vol1/@apphome/hermes-webui/data/workspace/ai-couple/backup.py", "--list-json")
  var text3 = toString(cmd3.output())
  var out3
  try { out3 = JSON.parse(text3.trim().split("\n").pop()) }
  catch (err3) { out3 = { items: [], lastRun: "", lastResult: "列表读取失败：" + text3.slice(0, 200), auto: true } }
  e.json(200, out3)
})
