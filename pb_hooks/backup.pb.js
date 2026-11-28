// 备份接口（PocketBase 0.40 JSVM hooks）
//
// 部署：把整个 pb_hooks/ 放到 pocketbase 可执行文件同级（或用 --hooksDir 指定）。
// 前提：bkcfg 集合存在（迁移 1794923204_created_bkcfg.js 创建），字段 webdavUrl / webdavUser / webdavPass / webdavDir / auto。
//
// 三个 PB JSVM 的坑（踩过，别改回去）：
// 1. handler 是独立编译的，文件顶层 const/function 在 handler 内不可见 → require 写在 handler 里。
// 2. c.request 是 *http.Request 对象本身，不是函数；context 从 c.request.context 取。
// 3. 鉴权用 $apis.requireAuth() 中间件，不要手写 token 校验。

const auth = () => $apis.requireAuth()

routerAdd("POST", "/api/ai/backup/run", (c) => {
  try {
    const L = require(`${__hooks}/lib.js`)
    const name = L.stampName()
    const rq = c.request
    const ctx = typeof rq.context === "function" ? rq.context() : rq.context
    const mk = L.makeBackup(name, ctx)
    if (!mk.ok) return c.json(500, { message: "备份失败：" + mk.error })
    const cfg = L.davCfg()
    let pushed = null
    if (cfg.auto && cfg.url) {
      const up = L.davCall(cfg, "PUT", name, { "Content-Type": "application/zip" }, $os.readFile(L.bkPath(name)))
      pushed = { ok: up.ok, status: up.status, error: up.error }
    }
    return c.json(200, { name: name, size: mk.size, pushed: pushed })
  } catch (e) {
    return c.json(500, { message: String(e) })
  }
}, auth())

routerAdd("GET", "/api/ai/backup/list", (c) => {
  try {
    const L = require(`${__hooks}/lib.js`)
    return c.json(200, { items: L.listBackups() })
  } catch (e) {
    return c.json(500, { message: String(e) })
  }
}, auth())

routerAdd("POST", "/api/ai/backup/test-dav", (c) => {
  try {
    const L = require(`${__hooks}/lib.js`)
    const cfg = L.davCfg()
    if (!cfg.url) return c.json(400, { message: "还没配置 WebDAV 地址" })
    const r = L.davCall(cfg, "PROPFIND", "", { Depth: "0" })
    return c.json(200, { ok: r.ok, status: r.status, url: cfg.url, error: r.error })
  } catch (e) {
    return c.json(500, { message: String(e) })
  }
}, auth())

// 保存 WebDAV 配置。webdavPass 是 hidden 字段：成员直接 PATCH/POST 集合时
// PocketBase 会把它静默丢掉，所以必须由服务端写入。
routerAdd("POST", "/api/ai/backup/save", (c) => {
  let body
  try {
    const info = c.requestInfo()
    body = (info && info.body) || {}
  } catch (e) {
    return c.json(400, { message: "请求体不合法：" + String(e) })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json(400, { message: "请求体不合法" })
  }
  try {
    const rows = $app.findRecordsByFilter("bkcfg", "", "id", 1, 0)
    const rec = rows.length ? rows[0] : new Record($app.findCollectionByNameOrId("bkcfg"))
    if (!rows.length) rec.set("auto", true)
    if (Object.prototype.hasOwnProperty.call(body, "auto")) rec.set("auto", !!body.auto)
    for (const field of ["webdavUrl", "webdavUser", "webdavDir"]) {
      if (Object.prototype.hasOwnProperty.call(body, field)) rec.set(field, String(body[field] || "").trim())
    }
    // 留空表示保留原密码；要清空显式传 clearPass: true
    if (typeof body.webdavPass === "string" && body.webdavPass.trim() !== "") rec.set("webdavPass", body.webdavPass)
    if (body.clearPass === true) rec.set("webdavPass", "")
    try {
      $app.save(rec)
    } catch (e) {
      // 字段校验是用户输入问题，返回 400；保留 PB 自带的 ApiError 状态码
      return c.json(Number(e && (e.statusCode || e.status)) || 400, { message: String(e) })
    }
    return c.json(200, { ok: true, id: rec.id, auto: !!rec.get("auto"), hasPass: !!rec.get("webdavPass") })
  } catch (e) {
    // 查询/创建记录等真正异常才落到 500
    return c.json(Number(e && (e.statusCode || e.status)) || 500, { message: String(e) })
  }
}, auth())

routerAdd("POST", "/api/ai/backup/upload", (c) => {
  try {
    const L = require(`${__hooks}/lib.js`)
    const name = String(c.request.url.query().get("name") || "")
    if (!L.isBackupName(name)) return c.json(400, { message: "备份文件名不合法" })
    const cfg = L.davCfg()
    if (!cfg.url) return c.json(400, { message: "还没配置 WebDAV 地址" })
    const r = L.davCall(cfg, "PUT", name, { "Content-Type": "application/zip" }, $os.readFile(L.bkPath(name)))
    return c.json(200, { ok: r.ok, status: r.status, error: r.error })
  } catch (e) {
    return c.json(500, { message: String(e) })
  }
}, auth())

// 删除本地备份；前端点删除后会先 confirm 一次
routerAdd("POST", "/api/ai/backup/delete", (c) => {
  try {
    const L = require(`${__hooks}/lib.js`)
    const name = String(c.request.url.query().get("name") || "")
    const r = L.removeBackup(name)
    if (!r.ok) return c.json(400, { message: r.error })
    return c.json(200, { ok: true, name: name })
  } catch (e) {
    return c.json(500, { message: String(e) })
  }
}, auth())

// 说明：不做 cron 自动备份。PB 0.40 的 JSVM 里 createBackup 必须传 request context，
// cron 场景没有 ctx（传 null 会 panic），所以定时备份改由外部计划任务跑 scripts/backup-webdav.mjs。
