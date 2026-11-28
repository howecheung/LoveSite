// 备份辅助函数（PocketBase 0.40 JSVM）
// 注意：pb_hooks 里每个文件是独立作用域，顶层函数在 routerAdd 的 handler 里不可见，
// 所以统一放这里，用 require(`${__hooks}/lib.js`) 在 handler 内引入。

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function b64(s) {
  const bytes = []
  for (let k = 0; k < s.length; k++) {
    const c = s.charCodeAt(k)
    if (c < 128) bytes.push(c)
    else if (c < 2048) bytes.push(192 | (c >> 6), 128 | (c & 63))
    else bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63))
  }
  let out = ""
  let i = 0
  while (i < bytes.length) {
    const a = bytes[i++]
    const b = bytes[i++]
    const c = bytes[i++]
    out += B64[a >> 2]
    out += B64[((a & 3) << 4) | ((b || 0) >> 4)]
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c || 0) >> 6)]
    out += c === undefined ? "=" : B64[c & 63]
  }
  return out
}

function stampName() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return "lovesite-backup-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".zip"
}

function bkPath(name) {
  return $filepath.join($app.dataDir(), "backups", name)
}

function fileSize(name) {
  try {
    return $os.stat(bkPath(name)).size()
  } catch (e) {
    return 0
  }
}

function listBackups() {
  let names = []
  try {
    // $os.readDir 的条目字符串化后是 "- name"（文件）或 "d name"（目录）
    names = $os.readDir($filepath.join($app.dataDir(), "backups"))
      .map((e) => String(e))
      .filter((s) => s.slice(0, 2) === "- ")
      .map((s) => s.slice(2))
  } catch (e) {
    return []
  }
  return names
    .filter((n) => n.slice(-4) === ".zip")
    .map((n) => ({ name: n, size: fileSize(n), at: prettyAt(n) }))
    .sort((a, b) => (a.name < b.name ? 1 : -1))
}

// lovesite-backup-20261124-222617.zip → 2026-11-24 22:26:17（兼容旧 ai- 前缀与 PB 面板默认名 pb_backup_*）
function prettyAt(name) {
  let m = /^(?:lovesite-backup-|ai-)(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.zip$/.exec(name)
  if (!m) m = /^pb_backup_[A-Za-z0-9_-]*?(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.zip$/.exec(name)
  if (!m) return ""
  return m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + m[6]
}

function davCfg() {
  let url = ""
  let user = ""
  let pass = ""
  let dir = ""
  let auto = false
  try {
    const rows = $app.findRecordsByFilter("bkcfg", "", "", 1, 0)
    if (rows && rows.length) {
      url = String(rows[0].get("webdavUrl") || "")
      user = String(rows[0].get("webdavUser") || "")
      pass = String(rows[0].get("webdavPass") || "")
      dir = String(rows[0].get("webdavDir") || "")
      auto = !!rows[0].get("auto")
    }
  } catch (e) {}
  const base = (url + (dir ? "/" + dir.replace(/^\/+|\/+$/g, "") : "")).replace(/\/+$/, "")
  return { url: base, user: user, pass: pass, auto: auto }
}

function davCall(cfg, method, name, headers, body) {
  if (!cfg.url) return { status: 0, ok: false, error: "未配置 WebDAV" }
  const h = {}
  const src = headers || {}
  for (const k in src) h[k] = src[k]
  if (cfg.user) h["Authorization"] = "Basic " + b64(cfg.user + ":" + cfg.pass)
  const req = { url: name ? cfg.url + "/" + encodeURIComponent(name) : cfg.url + "/", method: method, headers: h, timeout: 180 }
  if (body) req.body = body
  try {
    const r = $http.send(req)
    const st = typeof r.status === "number" ? r.status : 0
    return { status: st, ok: st >= 200 && st < 300, error: r.error ? String(r.error) : "" }
  } catch (e) {
    return { status: 0, ok: false, error: String(e) }
  }
}

function makeBackup(name, ctx) {
  try {
    $app.createBackup(ctx, name)
    return { ok: true, size: fileSize(name) }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// 只允许删除本程序生成或 PocketBase 面板生成的备份名，挡掉 ../ 之类的路径穿越。
// pb_backup_* 是 PB 面板 /api/backups 不传 name 时的默认命名（历史残留、外部工具生成），
// 只允许字母数字下划线连字符，不含点与斜杠。
const BK_NAME = /^(?:lovesite-backup-\d{8}-\d{6}|ai-\d{8}-\d{6}|ai-\d{14}|pb_backup_[A-Za-z0-9_-]+)\.zip$/

function removeBackup(name) {
  if (!BK_NAME.test(name)) return { ok: false, error: "备份文件名不合法" }
  const p = bkPath(name)
  try {
    $os.stat(p)
  } catch (e) {
    return { ok: false, error: "备份不存在" }
  }
  try {
    $os.remove(p)
  } catch (e) {
    return { ok: false, error: String(e) }
  }
  try {
    const meta = p + ".attrs"
    $os.stat(meta)
    $os.remove(meta)
  } catch (e) {}
  return { ok: true }
}

function isBackupName(name) {
  return typeof name === "string" && BK_NAME.test(name)
}

module.exports = { b64, stampName, bkPath, fileSize, listBackups, removeBackup, davCfg, davCall, makeBackup, isBackupName }
