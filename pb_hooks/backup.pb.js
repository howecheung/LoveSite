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

routerAdd("POST", "/api/ai/backup/upload", (c) => {
  try {
    const L = require(`${__hooks}/lib.js`)
    const name = String(c.queryParam("name") || "")
    if (!name || name.indexOf("..") >= 0) return c.json(400, { message: "备份文件名不合法" })
    const cfg = L.davCfg()
    if (!cfg.url) return c.json(400, { message: "还没配置 WebDAV 地址" })
    const r = L.davCall(cfg, "PUT", name, { "Content-Type": "application/zip" }, $os.readFile(L.bkPath(name)))
    return c.json(200, { ok: r.ok, status: r.status, error: r.error })
  } catch (e) {
    return c.json(500, { message: String(e) })
  }
}, auth())

// 说明：不做 cron 自动备份。PB 0.40 的 JSVM 里 createBackup 必须传 request context，
// cron 场景没有 ctx（传 null 会 panic），所以定时备份改由外部计划任务跑 scripts/backup-webdav.mjs。
