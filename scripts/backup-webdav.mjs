// 手动/定时把 PocketBase 完整备份推到 WebDAV
// 用法：node scripts/backup-webdav.mjs
// 环境变量（全都有本地默认值，生产请覆盖）：
//   PB_URL         默认 http://127.0.0.1:8094
//   PB_ADMIN_EMAIL / PB_ADMIN_PASS   超级管理员账号（调用 /api/backups 需要）
//   DAV_URL / DAV_USER / DAV_PASS     WebDAV 目录地址与账号
//   KEEP             保留最近几份（默认 7）
//
// 说明：这里走 PocketBase 官方的 /api/backups（生成的 zip 与面板 Backups 一致，
// 内含 data.db + storage/），而不是直接拷 pb_data 目录 —— 运行中的 SQLite 直接复制可能拿到不一致快照。

const PB = process.env.PB_URL || 'http://127.0.0.1:8094'
const EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@local.test'
const PASS = process.env.PB_ADMIN_PASS || 'pbadmin123456'
const DAV = (process.env.DAV_URL || '').replace(/\/+$/, '')
const DAV_USER = process.env.DAV_USER || ''
const DAV_PASS = process.env.DAV_PASS || ''
const KEEP = Number(process.env.KEEP || 7)

const die = (m) => {
  console.error('✗ ' + m)
  process.exit(1)
}

async function main() {
  if (!DAV) die('没有配置 DAV_URL')
  // 1) 超管登录
  const ar = await fetch(PB + '/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASS }),
  })
  if (!ar.ok) die('超管登录失败 ' + ar.status)
  const token = (await ar.json()).token

  // 2) 生成备份（本地时间，与 pb_hooks 的命名一致）
  const t = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  const stamp = '' + t.getFullYear() + p2(t.getMonth() + 1) + p2(t.getDate()) + '-' + p2(t.getHours()) + p2(t.getMinutes()) + p2(t.getSeconds())
  const name = 'lovesite-backup-' + stamp + '.zip'
  const br = await fetch(PB + '/api/backups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ name }),
  })
  if (!br.ok) die('创建备份失败 ' + br.status + ' ' + (await br.text()).slice(0, 200))

  // 3) 下载
  const dr = await fetch(PB + '/api/backups/' + encodeURIComponent(name), { headers: { Authorization: token } })
  if (!dr.ok) die('下载备份失败 ' + dr.status)
  const buf = Buffer.from(await dr.arrayBuffer())

  // 4) 上传 WebDAV
  const auth = DAV_USER ? 'Basic ' + Buffer.from(DAV_USER + ':' + DAV_PASS).toString('base64') : ''
  const ur = await fetch(DAV + '/' + encodeURIComponent(name), {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/zip' }, auth ? { Authorization: auth } : {}),
    body: buf,
  })
  if (!ur.ok) die('上传 WebDAV 失败 ' + ur.status)

  // 5) 清理远端旧备份（只动本项目的备份，兼容旧的 ai- 前缀）
  let removed = 0
  try {
    const lr = await fetch(DAV + '/', {
      method: 'PROPFIND',
      headers: Object.assign({ Depth: '1', 'Content-Type': 'application/xml' }, auth ? { Authorization: auth } : {}),
      body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><getcontentlength/></prop></propfind>',
    })
    if (lr.ok) {
      const xml = await lr.text()
      const names = [...xml.matchAll(/<[^>]*href[^>]*>([^<]*)<\/[^>]*href>/gi)]
        .map((m) => decodeURIComponent(m[1].split('/').filter(Boolean).pop() || ''))
        .filter((n) => /^(?:lovesite-backup-|ai-)\d{8}-\d{6}\.zip$/.test(n))
        .sort()
      for (const old of names.slice(0, Math.max(0, names.length - KEEP))) {
        const rr = await fetch(DAV + '/' + encodeURIComponent(old), { method: 'DELETE', headers: auth ? { Authorization: auth } : {} })
        if (rr.ok) removed++
      }
    }
  } catch (e) {
    console.warn('清理旧备份跳过：' + e.message)
  }

  console.log(`✓ ${name}  ${(buf.length / 1024 / 1024).toFixed(2)} MB  上传成功，清理旧备份 ${removed} 个`)
}

main().catch((e) => die(e.message))
