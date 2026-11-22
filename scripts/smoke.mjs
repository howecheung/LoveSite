// scripts/smoke.mjs —— LoveSite API 层冒烟自检（会造数据，跑完自动清理并恢复 settings 原值）
//
// 用法：
//   node scripts/smoke.mjs                    # 默认连 http://127.0.0.1:8094，用 zwh/mm 两个测试号
//   PB_URL=http://127.0.0.1:8094 node scripts/smoke.mjs
//
// 环境变量：
//   PB_URL               PocketBase 地址（默认 http://127.0.0.1:8094）
//   SMOKE_USER_1/2       两个测试成员的用户名（默认 zwh / mm）
//   SMOKE_PASS           测试成员密码（默认 12345678）
//   SMOKE_ADMIN_EMAIL    超管账号（可选，用于改密失败兜底复位）
//   SMOKE_ADMIN_PASS     超管密码（可选）
//
// 覆盖：认证、settings、日记/点赞/评论、相册多图与追加、清单 doneDate、纪念日、
//       打卡、留言、备份配置（hidden 字段）、三款游戏建房到删局、权限负例、改密。
// 退出码：有失败项时 1。

const B = process.env.PB_URL || 'http://127.0.0.1:8094'
const U1 = process.env.SMOKE_USER_1 || 'zwh'
const U2 = process.env.SMOKE_USER_2 || 'mm'
const PW = process.env.SMOKE_PASS || '12345678'
const ADMIN = process.env.SMOKE_ADMIN_EMAIL || 'admin@local.test'
const ADMIN_PW = process.env.SMOKE_ADMIN_PASS || 'pbadmin123456'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let pass = 0, fail = 0
const fails = []
async function T(name, fn) {
  try { const r = await fn(); pass++; console.log('  ok   ' + name + (r ? '  ' + r : '')) }
  catch (e) { fail++; fails.push(name + ' :: ' + (e && e.message ? e.message : String(e))); console.log('  FAIL ' + name + '  ' + (e && e.message ? e.message : e)) }
}
async function req(path, { method = 'GET', body, token, form } = {}) {
  const h = {}
  if (token) h.Authorization = token
  let payload
  if (form) payload = form
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const r = await fetch(B + path, { method, headers: h, body: payload })
  const d = (r.headers.get('content-type') || '').includes('json') ? await r.json().catch(() => null) : await r.text()
  if (!r.ok) {
    const msg = d && d.message ? `${d.message} ${JSON.stringify(d.data || {})}` : r.status
    const err = new Error(`${r.status} ${msg}`); err.status = r.status; err.data = d; throw err
  }
  return d
}
const auth = (identity, password) => req('/api/collections/members/auth-with-password', { method: 'POST', body: { identity, password } })
const col = (name) => ({
  list: (q = '', token) => req(`/api/collections/${name}/records?perPage=200${q}`, { token }),
  create: (b, token, form) => req(`/api/collections/${name}/records`, { method: 'POST', body: form ? undefined : b, token, form }),
  update: (id, b, token, form) => req(`/api/collections/${name}/records/${id}`, { method: 'PATCH', body: form ? undefined : b, token, form }),
  del: (id, token) => req(`/api/collections/${name}/records/${id}`, { method: 'DELETE', token }),
  get: (id, token) => req(`/api/collections/${name}/records/${id}`, { token }),
})

console.log(`\n目标 ${B}`)
console.log('\n=== 1. 认证 ===')
const a = await auth(U1, PW)
const A = a.token, meA = a.record
const b = await auth(U2, PW)
const Bt = b.token, meB = b.record
console.log(`  ok   ${U1} 登录  ${meA.nickName || ''}`)
console.log(`  ok   ${U2} 登录`)
await T('错误口令被拒（400）', async () => { try { await auth(U1, 'wrong-pass'); throw new Error('竟然登录成功') } catch (e) { if (e.status !== 400) throw e } })
await T('口令 <8 位被拒（400）', async () => { try { await auth(U1, '123'); throw new Error('竟然登录成功') } catch (e) { if (e.status !== 400) throw e } })

console.log('\n=== 2. settings ===')
const S = col('settings')
const orig = (await S.list('', A)).items[0] || null
let sid = orig && orig.id
await T('读取 settings', async () => (orig ? '已有记录 ' + orig.id : '空库'))
await T('写 siteName + tiles', async () => {
  const body = { siteName: '情侣小站', tiles: [{ k: 'diary' }, { k: 'album' }, { k: 'wishes' }] }
  if (sid) await S.update(sid, body, A); else { const r = await S.create(body, A); sid = r.id }
})
await T('tiles 顺序读回一致', async () => { const r = await S.get(sid, A); const ks = (r.tiles || []).map((x) => x.k).join(','); if (ks !== 'diary,album,wishes') throw new Error('读回 ' + ks) })
await T('lockSalt / lockHash 可写', async () => { await S.update(sid, { lockSalt: 'aabb', lockHash: 'ccdd', lockOn: true }, A); const r = await S.get(sid, A); if (r.lockSalt !== 'aabb') throw new Error('lockSalt=' + r.lockSalt) })

console.log('\n=== 3. diaries / 点赞 / 评论 ===')
const D = col('diaries')
let did
await T('新建日记', async () => { did = (await D.create({ text: '冒烟', title: 'T', mood: '开心' }, A)).id })
await T('上传照片', async () => { const f = new FormData(); f.append('text', '带图'); f.append('photo', new Blob([PNG], { type: 'image/png' }), 'x.png'); const r = await D.create(null, A, f); if (!r.photo) throw new Error('photo 空'); await D.del(r.id, A) })
await T('点赞 likes+ 自增', async () => { const n0 = (await D.get(did, A)).likes || 0; await D.update(did, { 'likes+': 1 }, A); const n1 = (await D.get(did, A)).likes; if (n1 !== n0 + 1) throw new Error(`${n0}->${n1}`) })
let cid
await T('评论 + expand member', async () => {
  const C = col('comments')
  cid = (await C.create({ diary: did, member: meA.id, text: '冒烟评论' }, A)).id
  const p = await C.list('&filter=' + encodeURIComponent(`diary="${did}"`) + '&expand=member', A)
  if (!p.items.find((x) => x.id === cid)) throw new Error('filter 查不到，total=' + p.totalItems)
})

console.log('\n=== 4. albums（多图 / 追加 / 计数）===')
const AL = col('albums')
let aid
await T('新建相册（2 图）', async () => {
  const f = new FormData(); f.append('name', '冒烟相册')
  f.append('photos', new Blob([PNG], { type: 'image/png' }), 'a.png')
  f.append('photos', new Blob([PNG], { type: 'image/png' }), 'b.png')
  const r = await AL.create(null, A, f); aid = r.id
  if ((r.photos || []).length !== 2) throw new Error('photos=' + (r.photos || []).length)
})
await T('追加照片 photos+（P0 回归）', async () => {
  const f = new FormData(); f.append('photos+', new Blob([PNG], { type: 'image/png' }), 'c.png')
  const r = await AL.update(aid, null, A, f)
  if ((r.photos || []).length !== 3) throw new Error('追加后=' + (r.photos || []).length + '，期望 3')
})
await T('views+/likes+', async () => { await AL.update(aid, { 'views+': 1, 'likes+': 2 }, A); const r = await AL.get(aid, A); if (r.views !== 1 || r.likes !== 2) throw new Error(`views=${r.views} likes=${r.likes}`) })
await T('删单张（数组覆盖）', async () => { const r = await AL.get(aid, A); const keep = r.photos.slice(0, 2); const f = new FormData(); keep.forEach((n) => f.append('photos', new Blob([PNG], { type: 'image/png' }), n)); const u = await AL.update(aid, null, A, f); if ((u.photos || []).length !== 2) throw new Error('剩 ' + (u.photos || []).length) })

console.log('\n=== 5. wishes / moments / checkins / messages ===')
const W = col('wishes')
let wid
await T('新建清单项', async () => { wid = (await W.create({ text: '冒烟清单', done: false }, A)).id })
await T('打勾写 doneDate（text 字段）', async () => { const r = await W.update(wid, { done: true, doneDate: '2026-01-02' }, A); if (r.doneDate !== '2026-01-02') throw new Error('doneDate=' + r.doneDate); return 'doneDate=' + r.doneDate })
await T('取消勾选清 doneDate', async () => { const r = await W.update(wid, { done: false, doneDate: '' }, A); if (r.doneDate !== '') throw new Error('doneDate=' + r.doneDate) })
const MO = col('moments')
let mid
await T('新建纪念日（公历）', async () => { mid = (await MO.create({ name: '冒烟纪念日', day: '2020-05-20 00:00:00.000Z', yearly: true }, A)).id })
await T('新建纪念日（农历）', async () => { const r = await MO.create({ name: '农历纪念', lunar: true, lunarMD: '07-07', yearly: true }, A); await MO.del(r.id, A) })
const CK = col('checkins'), CR = col('ckrecords')
let kid, rid
await T('打卡计划 + 打卡 + 当日查询', async () => {
  kid = (await CK.create({ name: '冒烟打卡', emoji: '📌' }, A)).id
  rid = (await CR.create({ plan: kid, who: meA.id, day: '2026-11-22' }, A)).id
  const p = await CR.list('&filter=' + encodeURIComponent('day="2026-11-22"'), A)
  if (!p.items.find((x) => x.id === rid)) throw new Error('查不到，total=' + p.totalItems)
  return 'total=' + p.totalItems
})
const MS = col('messages')
let msgid
await T('留言板', async () => { msgid = (await MS.create({ text: '冒烟留言', mood: '小熊', member: meA.id }, A)).id })

console.log('\n=== 6. bkcfg ===')
const BK = col('bkcfg')
let bkid
await T('写入 WebDAV 配置', async () => { bkid = (await BK.create({ auto: true, webdavUrl: 'https://e.com/dav', webdavUser: 'u', webdavPass: 'p', webdavDir: 'ai' }, A)).id })
await T('读回（webdavPass 是 hidden，按设计不下发）', async () => { const r = await BK.get(bkid, A); if (r.webdavPass !== undefined) throw new Error('hidden 字段竟然下发了'); if (r.webdavUser !== 'u') throw new Error('webdavUser 丢了'); return 'user=' + r.webdavUser + '，pass 不下发' })

console.log('\n=== 7. 三款游戏（建房 / 入座 / 落子 / 胜负 / 战绩 / 删局）===')
async function gameCase(name, G, R, moves) {
  let gid
  await T(`${name} 建房`, async () => { const r = await G.create({ code: String(1000 + Math.floor(Math.random() * 9000)), black: meA.id, bnm: meA.nickName || 'A', state: 'lobby', winner: '', moves: '', start: Date.now() }, A); gid = r.id })
  await T(`${name} 入座`, async () => { const r = await G.update(gid, { white: meB.id, wnm: meB.nickName || 'B', state: 'live' }, Bt); if (r.white !== meB.id) throw new Error('white 未写入') })
  await T(`${name} 落子`, async () => { const r = await G.update(gid, { moves }, A); if (r.moves !== moves) throw new Error('moves 不一致') })
  await T(`${name} 判胜`, async () => { const r = await G.update(gid, { winner: 'black', state: 'done', dur: 60 }, A); if (r.winner !== 'black') throw new Error('winner 未写入') })
  await T(`${name} 写战绩 + 删战绩`, async () => { const rrid = (await R.create({ game: gid, winner: 'black', bn: 'A', wn: 'B', mv: 9, dur: 60 }, A)).id; await R.del(rrid, A) })
  await T(`${name} 删对局（deleteRule）`, async () => { await G.del(gid, A) })
}
await gameCase('五子棋', col('gmk'), col('gmkr'), '112 113 114 115 116')
await gameCase('四子棋', col('c4'), col('c4r'), '3:0 2:0 4:0 1:0')
await gameCase('飞行棋', col('fly'), col('flyr'), JSON.stringify({ p: [3, 0], turn: 1, skip: [false, false], task: -1, extra: false, t: 1 }))

console.log('\n=== 8. 权限负例 ===')
await T('匿名读 diaries 返回空列表（规则过滤，不报错）', async () => { const p = await req('/api/collections/diaries/records?perPage=1'); if (p.totalItems !== 0) throw new Error('匿名竟然读到 ' + p.totalItems + ' 条') })
await T('匿名写 settings 被拒', async () => { try { await req('/api/collections/settings/records', { method: 'POST', body: { siteName: 'x' } }); throw new Error('匿名竟然能写') } catch (e) { if (!e.status || e.status < 400) throw e } })
await T('members 自助注册被拒', async () => { try { await req('/api/collections/members/records', { method: 'POST', body: { email: 'x@x.test', password: '12345678', passwordConfirm: '12345678' } }); throw new Error('竟能注册') } catch (e) { if (!e.status || e.status < 400) throw e } })
await T('别人的局不能删（规则生效）', async () => {
  const g = await col('gmk').create({ code: String(1000 + Math.floor(Math.random() * 9000)), black: meB.id, bnm: 'B' }, Bt)
  try { await col('gmk').del(g.id, A); throw new Error('别人的局竟然能删') }
  catch (e) { if (e.status !== 403 && e.status !== 404) throw e }
  finally { await col('gmk').del(g.id, Bt).catch(() => {}) }
})

console.log('\n=== 9. 改密码（最后做，失败则超管兜底复原）===')
await T('改密 → 新密码登录 → 复原', async () => {
  await col('members').update(meA.id, { oldPassword: PW, password: PW + '9', passwordConfirm: PW + '9' }, A)
  const t2 = (await auth(U1, PW + '9')).token
  await col('members').update(meA.id, { oldPassword: PW + '9', password: PW, passwordConfirm: PW }, t2)
})
try {
  const su = await req('/api/collections/_superusers/auth-with-password', { method: 'POST', body: { identity: ADMIN, password: ADMIN_PW } })
  await col('members').update(meA.id, { password: PW, passwordConfirm: PW }, su.token)
} catch (e) { console.log('  warn 超管复位跳过：' + (e && e.message)) }
await T('复原后旧密码可登录', async () => { await auth(U1, PW) })

console.log('\n=== 清理 ===')
const fresh = (await auth(U1, PW)).token
await T('清理测试数据', async () => {
  for (const [c, id] of [['diaries', did], ['albums', aid], ['wishes', wid], ['moments', mid], ['checkins', kid], ['messages', msgid], ['bkcfg', bkid]]) if (id) await col(c).del(id, fresh).catch(() => {})
  if (rid) await col('ckrecords').del(rid, fresh).catch(() => {})
  if (cid) await col('comments').del(cid, fresh).catch(() => {})
  if (orig) await S.update(sid, { siteName: orig.siteName || '', tiles: orig.tiles || [], lockSalt: orig.lockSalt || '', lockHash: orig.lockHash || '', lockOn: !!orig.lockOn }, fresh)
  else await S.del(sid, fresh).catch(() => {})
})

console.log(`\n===== 结果：通过 ${pass}，失败 ${fail} =====`)
if (fails.length) { console.log('失败明细：'); fails.forEach((f) => console.log(' - ' + f)); process.exitCode = 1 }
