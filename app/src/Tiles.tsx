// 首页功能卡片的定义与"可自定义宫格"管理页（数据在 settings.tiles，双端实时同步）
import { useEffect, useRef, useState } from 'react'
import { Card, Button, Modal, Input } from 'animal-island-ui'
import { motion } from 'motion/react'
import { tapSmall } from './motion'
import { Ic } from './Icons'
import { saveSettings, showToast } from './core'

export const TILES = [
  { k: 'album', ic: '🎬', t: '时光相册', s: '留住你我记忆', c: 'app-pink' },
  { k: 'diary', ic: '📔', t: '恋爱日常', s: '记录点滴时光', c: 'app-yellow' },
  { k: 'promise', ic: '📋', t: '爱情清单', s: '甜蜜约定', c: 'lime-green' },
  { k: 'tools', ic: '🧰', t: '小工具', s: '吃什么·去哪玩', c: 'app-orange' },
  { k: 'checkin', ic: '📌', t: '打卡计划', s: '坚持每日打卡', c: 'app-blue' },
  { k: 'message', ic: '💬', t: '祝福语', s: '写下祝福', c: 'app-teal' },
  { k: 'countdown', ic: '⏳', t: '倒计时', s: '重要的日子', c: 'brown' },
  { k: 'games', ic: '🎮', t: '小游戏', s: '双人同乐', c: 'app-teal' },
  { k: 'footprint', ic: '👣', t: '足迹地图', s: '照片里的地方', c: 'app-blue' },
  { k: 'about', ic: '👩‍❤️‍👨', t: '关于我们', s: '我们的故事', c: 'app-red' },
]
// 首页宫格 = 可按需覆盖的 stored 列表（存 settings.tiles，两端实时同步）
export function resolveTiles(stored: any): any[] {
  const base: Record<string, any> = {}
  TILES.forEach((t) => { base[t.k] = t })
  if (!Array.isArray(stored) || !stored.length) return TILES.map((t) => ({ ...t }))
  const http = (u: any) => typeof u === 'string' && /^https?:\/\//i.test(u)
  return stored.filter((e: any) => e && e.k).map((e: any) => {
    const b = base[e.k]
    if (b) return { ...b, ...(e.ic ? { ic: e.ic } : {}), ...(e.t ? { t: e.t } : {}), ...(e.s !== undefined && e.s !== '' ? { s: e.s } : {}), ...(http(e.url) ? { url: e.url } : {}) }
    // 已下线的内置卡（如旧的记账/衣柜/经期）只在用户改过标题或图标时保留，否则丢弃
    if (!(e.t || e.ic)) return null
    // 链接卡只接受 http(s)，挡住导入 JSON 里的 javascript: 等协议
    return { ...e, url: http(e.url) ? e.url : undefined }
  }).filter(Boolean)
}
function tileOverride(b: any | undefined, cur: any): any {
  if (!b) return { k: cur.k, ic: cur.ic, t: cur.t, s: cur.s, url: cur.url }
  const o: any = { k: cur.k }
  if (cur.ic !== b.ic) o.ic = cur.ic
  if (cur.t !== b.t) o.t = cur.t
  if ((cur.s || '') !== (b.s || '')) o.s = cur.s || ''
  return o
}

// 功能卡片管理页（独立页：自带返回；编辑/添加走底部小弹窗，不再是一根长弹窗）
export function PageTileMgr({ data }: any) {
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState('')
  const [ef, setEf] = useState<any>({})
  const [nt, setNt] = useState<any>({ ic: '', t: '', url: '' })
  // 本地 list 是唯一渲染源：persist 后立刻重排，不用等父组件 reload
  const [list, setList] = useState<any[]>(() => resolveTiles(data.setting?.tiles))
  const listRef = useRef<any[]>(list)
  listRef.current = list
  const baseMap: Record<string, any> = {}
  TILES.forEach((t) => { baseMap[t.k] = t })
  // 另一端改了卡片（订阅推来的新 props）→ 跟一次
  const sig = JSON.stringify(data.setting?.tiles || null)
  useEffect(() => {
    const next = resolveTiles(data.setting?.tiles)
    if (JSON.stringify(next) !== JSON.stringify(listRef.current)) setList(next)
  }, [sig])
  const persist = async (next: any[]) => {
    const shown = next.length ? next : TILES
    listRef.current = shown
    setList(shown)
    setBusy(true)
    try {
      const payload = next.map((e: any) => tileOverride(baseMap[e.k], e))
      await saveSettings({ tiles: payload })
    } catch (e: any) {
      const d: any = e?.data?.data || e?.data || {}
      showToast('没保存上：' + (Object.values(d).map((v: any) => v?.message || v).join('；').slice(0, 50) || String(e?.message || e).slice(0, 40)))
    }
    setBusy(false)
  }
  const mv = (i: number, d: number) => { const n = [...listRef.current]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; persist(n) }
  const rm = (i: number) => persist(listRef.current.filter((_: any, j: number) => j !== i))
  const openEdit = (t: any, i: number) => { setEf({ idx: i, ic: t.ic, t: t.t, s: t.s, url: t.url || '', cus: !baseMap[t.k] }); setSheet('edit') }
  const saveEdit = () => {
    const n = [...listRef.current]; const o = { ...n[ef.idx] }
    if ((ef.ic || '').trim()) o.ic = ef.ic.trim()
    if ((ef.t || '').trim()) o.t = ef.t.trim()
    o.s = (ef.s || '').trim() || o.s
    if (ef.cus) { const u = (ef.url || '').trim(); if (!/^https?:\/\//i.test(u)) return showToast('网址要以 http:// 或 https:// 开头'); o.url = u }
    n[ef.idx] = o; persist(n); setSheet('')
  }
  const addLink = () => {
    const name = (nt.t || '').trim(), u = (nt.url || '').trim()
    if (!name) return showToast('给链接起个名字')
    if (!/^https?:\/\//i.test(u)) return showToast('网址要以 http:// 或 https:// 开头')
    persist([...listRef.current, { k: 'cus-' + Date.now().toString(36), ic: (nt.ic || '').trim() || '🔗', t: name, s: '外部链接', url: u }])
    setNt({ ic: '', t: '', url: '' }); setSheet('')
  }
  const avail = TILES.filter((t) => !list.some((c: any) => c.k === t.k))
  return (<>
    <Card color="default" className="blk risein" style={{ padding: '4px 14px' }}>
      {list.map((t: any, i: number) => (
        <div key={t.k} className="li">
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
            <Ic v={t.ic} size={16} />
            <b style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>{t.t}</b>
            <span className="mut" style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.s}</span>
          </span>
          <motion.span {...tapSmall} className="miniact" onClick={() => mv(i, -1)}><Ic v="up" size={13} /></motion.span>
          <motion.span {...tapSmall} className="miniact" onClick={() => mv(i, 1)}><Ic v="down" size={13} /></motion.span>
          <motion.span {...tapSmall} className="miniact" onClick={() => openEdit(t, i)}><Ic v="edit" size={13} /></motion.span>
          <motion.span {...tapSmall} className="miniact" title="隐藏" onClick={() => rm(i)}><Ic v="hide" size={13} /></motion.span>
        </div>
      ))}
    </Card>
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <Button ghost disabled={busy} onClick={() => setSheet('add')} style={{ flex: 1 }}>添加功能</Button>
      <Button ghost disabled={busy} onClick={() => setSheet('link')} style={{ flex: 1 }}>添加链接</Button>
      <Button ghost disabled={busy} onClick={() => persist([])} style={{ flex: 1 }}>恢复默认</Button>
    </div>
    <div className="mut" style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5 }}>改动自动保存 · 两端实时同步</div>

    <Modal open={sheet === 'edit'} onClose={() => setSheet('')} typewriter={false} title="编辑卡片">
      <div className="r2">
        <label className="fld" style={{ flex: '0 0 78px' }}><span>图标</span><Input size="small" value={ef.ic || ''} onChange={(e: any) => setEf({ ...ef, ic: e.target.value })} /></label>
        <label className="fld" style={{ flex: 1, minWidth: 0 }}><span>名称</span><Input size="small" value={ef.t || ''} onChange={(e: any) => setEf({ ...ef, t: e.target.value })} /></label>
      </div>
      <label className="fld" style={{ display: 'block', marginTop: 8 }}><span>副标题</span><Input size="small" value={ef.s || ''} onChange={(e: any) => setEf({ ...ef, s: e.target.value })} /></label>
      {ef.cus ? <label className="fld" style={{ display: 'block', marginTop: 8 }}><span>网址</span><Input size="small" value={ef.url || ''} onChange={(e: any) => setEf({ ...ef, url: e.target.value })} placeholder="https://..." /></label>
        : <div className="mut" style={{ fontSize: 11.5, marginTop: 8 }}>内置功能改名字即可，位置不变</div>}
      <div className="acts" style={{ marginTop: 10 }}>
        <Button type="primary" disabled={busy} onClick={saveEdit}>保 存</Button>
        <Button ghost onClick={() => setSheet('')}>取消</Button>
      </div>
    </Modal>

    <Modal open={sheet === 'add'} onClose={() => setSheet('')} typewriter={false} title="添加功能">
      {avail.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {avail.map((t) => <motion.span key={t.k} {...tapSmall} className="chip" onClick={() => { persist([...list, t]); setSheet('') }}>{t.ic} {t.t}</motion.span>)}
        </div>
      ) : <div className="mut" style={{ textAlign: 'center', padding: 14 }}>全部功能都已在首页啦</div>}
    </Modal>

    <Modal open={sheet === 'link'} onClose={() => setSheet('')} typewriter={false} title="添加链接">
      <div className="r2">
        <label className="fld" style={{ flex: '0 0 78px' }}><span>图标</span><Input size="small" value={nt.ic} onChange={(e: any) => setNt({ ...nt, ic: e.target.value })} placeholder="🔗" /></label>
        <label className="fld" style={{ flex: 1, minWidth: 0 }}><span>名称</span><Input size="small" value={nt.t} onChange={(e: any) => setNt({ ...nt, t: e.target.value })} placeholder="如：她的微博" /></label>
      </div>
      <label className="fld" style={{ display: 'block', marginTop: 8 }}><span>网址</span><Input size="small" value={nt.url} onChange={(e: any) => setNt({ ...nt, url: e.target.value })} placeholder="https://..." /></label>
      <div className="acts" style={{ marginTop: 10 }}>
        <Button type="primary" disabled={busy} onClick={addLink}>添 加</Button>
        <Button ghost onClick={() => setSheet('')}>取消</Button>
      </div>
    </Modal>
  </>)
}



