// Full-page components inside the site shell (no modal forms)
import { useEffect, useState } from 'react'
import { Card, Title, Button, Input, Tag, Divider, Modal } from 'animal-island-ui'
import { motion, AnimatePresence } from 'motion/react'
import { spring, tapSmall, listVariant, itemVariant } from './motion'
import { Ic } from './Icons'
import { pb, quiet } from './core'
import { readExif, nextOccurLunar } from './utils'
import {
  exifLine, lmdText, fmtDT, dayStr, today, daysSince, nextOccur,
  MOOD_CN, MOOD_IC, MOOD_TAG, compressImg,
} from './shared'

function Av({ rec, size = 34, fb }: any) {
  const url = rec && rec.avatar ? pb.files.getURL(rec, rec.avatar) : ''
  return <span className="av" style={{ width: size, height: size }}>
    {url ? <img src={url} alt="" loading="lazy" /> : <Ic v={fb || '💗'} size={Math.round(size * 0.55)} />}
  </span>
}

const TabBtn = ({ n, on, go }: any) => (
  <motion.button {...tapSmall} className={on ? 'on' : ''} onClick={() => go(n.k)} style={{ position: 'relative' }}>
    {on && <motion.span layoutId="dpill" className="dpill" transition={{ type: 'spring', stiffness: 480, damping: 34 }} />}
    <span className="ic">{on
      ? <motion.span initial={{ scale: 0.55, y: 3 }} animate={{ scale: 1, y: 0 }} transition={spring.bouncy} style={{ display: 'block' }}><Ic v={n.ic} /></motion.span>
      : <Ic v={n.ic} />}</span>{n.t}
  </motion.button>
)

function HomeExtra({ data, go }: any) {
  const soon = data.moments.slice(0, 2)
  return (
    <>
      {!!soon.length && (
        <Card color="app-yellow" className="blk">
          <Title size="small" variant="tab">临近的日子</Title>
          {soon.map((m: any) => {
            const n = m.lunar && m.lunarMD ? nextOccurLunar(m.lunarMD, m.yearly) : nextOccur(m.day, m.yearly)
            return <div className="li" key={m.id}>
              <span className="dot"><Ic v={m.emoji || '💗'} /></span>
              <span className="grow"><b>{m.name}</b><div className="mut">{m.lunar && m.lunarMD ? `农历${lmdText(m.lunarMD)}` : dayStr(m.day)}{m.yearly ? ' · 每年' : ''}</div></span>
              <b className="cnt">{n <= 0 ? '就是今天🎉' : `还有 ${n} 天`}</b>
            </div>
          })}
          <div style={{ textAlign: 'right', marginTop: 8 }}><Button size="small" ghost onClick={() => go('countdown')}>全部日子 →</Button></div>
        </Card>
      )}
      {!!data.diaries.length && (
        <Card className="blk">
          <Title size="small" variant="tab">最近的日常</Title>
          {data.diaries.slice(0, 3).map((d: any) => (
            <div className="li" key={d.id}>
              <span className="dot"><Ic v={MOOD_IC[d.mood] || '📔'} /></span>
              <span className="grow"><b>{d.title || d.text.slice(0, 18)}</b>
                <div className="mut">{d.expand?.member?.nickName || ''} · {fmtDT(d.created)}</div></span>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 8 }}><Button size="small" ghost onClick={() => go('diary')}>更多日常 →</Button></div>
        </Card>
      )}
    </>
  )
}

function Diary({ data, reload, onAdd, unlocked, askLock }: any) {
  const like = async (d: any) => { try { await pb.collection('diaries').update(d.id, { 'likes+': 1 }); reload() } catch (e) { quiet(e) } }
  const [open, setOpen] = useState<string>('')
  const [pop, setPop] = useState('')
  const [cmt, setCmt] = useState('')
  const lockOn = !!data.setting?.lockOn
  const send = async (d: any) => {
    if (!cmt.trim()) return
    try { await pb.collection('comments').create({ diary: d.id, member: pb.authStore.record?.id, text: cmt.trim() }); setCmt(''); reload() } catch (e) { quiet(e) }
  }
  return (
    <>
      <div className="pbar"><Button type="primary" onClick={onAdd}><Ic v="✏️" size={14} /> 创建</Button><span className="mut">共 {data.diaries.length} 篇</span></div>
      {data.diaries.map((d: any) => {
        const locked = d.private && lockOn && !unlocked
        const cs = (data.comments || []).filter((c: any) => c.diary === d.id)
        return (
        <Card key={d.id} className="blk" style={locked ? { opacity: .72 } : undefined}>
          <div className="li" style={{ paddingBottom: 6 }}>
            <Av rec={locked ? null : d.expand?.member} fb={locked ? '🔒' : (MOOD_IC[d.mood] || '💗')} />
            <span className="grow"><span className="whorow"><b>{locked ? '私密内容' : (d.expand?.member?.nickName || '旅人')}</b>
              {!locked && <Tag size="small" color={MOOD_TAG[d.mood] || 'app-pink'}>{MOOD_CN[d.mood] || d.mood}</Tag>}</span>
              <div className="mut">{fmtDT(d.created)}</div></span>
            {d.private && !lockOn ? <Tag size="small" color="brown"><Ic v="🔒" size={12} /> 私密</Tag> : null}
          </div>
          {locked ? (
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <div className="mut" style={{ marginBottom: 8 }}>这是一条上了锁的私密日常</div>
              <Button size="small" onClick={askLock}><Ic v="🔐" size={14} /> 输入口令解锁</Button>
            </div>
          ) : (<>
          {d.title && <div style={{ fontWeight: 700, margin: '2px 0 4px' }}>{d.title}</div>}
          <div style={{ fontSize: 14.5, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{d.text}</div>
          {d.photo && <>
            <img style={{ borderRadius: 12, marginTop: 8, maxWidth: '100%' }} src={pb.files.getURL(d, d.photo)} alt="" />
            {d.exif && <div className="mut" style={{ marginTop: 4 }}><Ic v="📷" size={12} /> {exifLine(d.exif)}</div>}
          </>}
          <div className="diafoot">
            <motion.span {...tapSmall} style={{ display: 'inline-flex' }}><Tag size="small" color="app-red" onClick={() => { like(d); setPop(d.id + ':' + ((d.likes || 0) + 1)) }} style={{ cursor: 'pointer', position: 'relative' }}>
              <motion.span key={d.likes} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring.bouncy} style={{ display: 'inline-flex' }}><Ic v="❤️" size={12} /></motion.span>
              {pop === d.id + ':' + (d.likes || 0) + 1 && <motion.i className="hb" initial={{ opacity: .95, y: 0, scale: .5 }} animate={{ opacity: 0, y: -26, scale: 1.3 }} transition={{ duration: .55, ease: 'easeOut' }}><Ic v="❤️" size={13} /></motion.i>}&nbsp;{d.likes || 0}</Tag></motion.span>
            <Tag size="small" color="app-blue" onClick={() => { setOpen(open === d.id ? '' : d.id); setCmt('') }} style={{ cursor: 'pointer' }}><Ic v="💬" size={12} />&nbsp;{cs.length}</Tag>
          </div>
          {open === d.id && (
            <div className="cmtbox">
              {cs.map((c: any) => (
                <div className="cmt" key={c.id}>
                  <Av rec={c.expand?.member} size={22} fb="💬" />
                  <b>{c.expand?.member?.nickName || '旅人'}</b>
                  <span>{c.text}</span>
                  <i>{fmtDT(c.created)}</i>
                </div>
              ))}
              {!cs.length && <div className="mut" style={{ padding: '4px 0 8px' }}>还没有评论，说点悄悄话</div>}
              <div className="cmtrow">
                <input value={cmt} onChange={(e) => setCmt(e.target.value)} placeholder="回复 TA…"
                  onKeyDown={(e) => e.key === 'Enter' && send(d)} />
                <Button size="small" type="primary" onClick={() => send(d)}>发送</Button>
              </div>
            </div>
          )}
          </>)}
        </Card>
        )
      })}
      {!data.diaries.length && <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 22 }}>还没有日常，点「创建」写第一篇</div></Card>}
    </>
  )
}

function Albums({ data, reload, onAdd, go, grid, setGrid }: any) {
  const view0 = grid
  const setView0 = setGrid
  const gurl = (a: any, f: string) => pb.files.getURL(a, f)
  const bump = async (a: any, patch: any) => {
    try { await pb.collection('albums').update(a.id, patch); reload() } catch (e) { quiet(e) }
  }
  const open = (a: any) => { bump(a, { 'views+': 1 }); go('album-view', a.id) }
  const total = data.albums.reduce((n: number, a: any) => n + (a.photos || []).length, 0)
  const wall = (a: any) => {
    const ps: string[] = a.photos || []
    const cells = ps.slice(0, 9)
    const cls = cells.length <= 1 ? 'n1' : cells.length === 2 || cells.length === 4 ? 'n2' : 'n3'
    return <div className={'wall ' + cls}>
      {cells.map((f, i) => (
        <span key={f} className="cell">
          <img src={gurl(a, f)} alt="" loading="lazy" onClick={() => open(a)} />
          {i === 8 && ps.length > 9 && <b className="more" onClick={() => open(a)}>+{ps.length - 9}</b>}
        </span>
      ))}
    </div>
  }
  return (
    <>
      <div className="pbar">
        <Button type="primary" onClick={onAdd}><Ic v="📷" size={15} /> 上传动态</Button>
        <motion.span {...tapSmall}>
        <Button type="primary" ghost={!view0} onClick={() => setView0(!view0)}><Ic v="🎬" size={14} /> {view0 ? '返回动态' : '全部相册'}</Button>
        </motion.span>
        <span className="mut">{data.albums.length} 个瞬间 · {total} 张</span>
      </div>
      {view0 && (
        <motion.div className="agrid" variants={listVariant} initial="initial" animate="animate">
          {data.albums.map((a: any) => (
            <motion.div key={a.id} variants={itemVariant}>
              <Card hoverable className="acard" onClick={() => open(a)}>
                {a.cover || a.photos?.length
                  ? <img src={gurl(a, a.cover || a.photos[0])} alt="" />
                  : <div className="noimg"><Ic v="🖼️" size={32} /></div>}
                <div className="n">{a.name}</div>
                <div className="mut">{(a.photos || []).length} 张 · {(a.created || '').slice(5, 10)}</div>
              </Card>
            </motion.div>
          ))}
          {!data.albums.length && <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 22 }}>还没有相册，点「上传动态」发第一组</div></Card>}
        </motion.div>
      )}
      {!view0 && data.albums.map((a: any) => (
        <Card key={a.id} className="blk post">
          <div className="phead">
            <Av rec={a.expand?.member} size={30} fb="🖼️" />
            <span className="grow">
              <b>{(a.expand && a.expand.member && a.expand.member.nickName) || '岛民'}</b>
              <div className="mut" style={{ fontSize: 12 }}>{(a.created || '').slice(0, 16)}</div>
            </span>
            <span className="pill" onClick={() => open(a)}>{(a.photos || []).length} 张</span>
          </div>
          <div className="ptitle" onClick={() => open(a)}>{a.name}</div>
          {!!a.note && <div className="pnote">{a.note}</div>}
          {(a.photos || []).length ? wall(a) : <div className="mut" style={{ textAlign: 'center', padding: 16 }}>这本还空着，点开传第一张</div>}
          <div className="pfoot">
            <span onClick={() => open(a)}><Ic v="👁️" size={14} /> {a.views || 0}</span>
            <motion.span className={'cLike' + ((a.likes || 0) > 0 ? ' on' : '')} {...tapSmall} onClick={() => bump(a, { 'likes+': 1 })}>
              <motion.span key={a.likes} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring.bouncy} style={{ display: 'inline-block' }}><Ic v="❤️" size={14} w="fill" /></motion.span> {a.likes || 0}</motion.span>
            <span><Ic v="🖼️" size={14} /> {(a.photos || []).length}</span>
          </div>
        </Card>
      ))}
      {!view0 && !data.albums.length && <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 22 }}>还没有相册，点「上传动态」发第一组</div></Card>}
    </>
  )
}

function AlbumView({ id, data, reload, go }: any) {
  const a = data.albums.find((x: any) => x.id === id)
  const [big, setBig] = useState(-1)
  const [ask, setAsk] = useState('')
  const [askA, setAskA] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!a) return <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 22 }}>这本相册不存在或已被删除</div></Card>
  const gurl = (f: string) => pb.files.getURL(a, f)
  const ps: string[] = a.photos || []
  const exOf = (f: string) => { try { return (JSON.parse(a.exifs || '{}'))[f] || null } catch { return null } }
  const del = async (f: string) => {
    setBusy(true)
    try {
      const rest = ps.filter((x) => x !== f)
      const patch: any = { photos: rest.length ? rest : '' }
      if (a.cover === f) patch.cover = rest[0] || ''
      await pb.collection('albums').update(a.id, patch)
      setBig(-1); setAsk(''); reload()
    } catch (e) { quiet(e) }
    setBusy(false)
  }
  const delAlbum = async () => {
    setBusy(true)
    try {
      await pb.collection('albums').delete(a.id)
      setAskA(false); setBig(-1); reload(); go('album', undefined, true)
    } catch (e) { quiet(e) }
    setBusy(false)
  }
  const addMore = async (fs: File[]) => {
    if (!fs.length) return
    setBusy(true)
    try {
      const ex: any = { ...(JSON.parse(a.exifs || '{}')) }
      for (const x of fs) { const r = await readExif(x); if (r) ex[x.name] = r }
      await pb.collection('albums').update(a.id, { 'photos+': fs, exifs: JSON.stringify(ex) })
      reload()
    } catch (e) { quiet(e) }
    setBusy(false)
  }
  return (
    <>
      <Card color="app-yellow" className="blk" style={{ padding: '14px 14px 12px' }}>
        <div className="phead">
          <Av rec={a.expand?.member} size={30} fb="🖼️" />
          <span className="grow">
            <b>{(a.expand && a.expand.member && a.expand.member.nickName) || '岛民'}</b>
            <div className="mut" style={{ fontSize: 12 }}>{(a.created || '').slice(0, 16)}</div>
          </span>
          <span className="pill">{ps.length} 张</span>
        </div>
        <div className="ptitle">{a.name}</div>
        {!!a.note && <div className="pnote">{a.note}</div>}
        <div className="pfoot" style={{ marginTop: 2 }}>
          <span><Ic v="👁️" size={14} /> {a.views || 0}</span>
          <span><Ic v="🖼️" size={14} /> {ps.length}</span>
          <label className="picbtn" style={{ marginLeft: 'auto' }}><Ic v="➕" size={14} /> 加照片
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async (e) => addMore(await Promise.all([...(e.target.files || [])].map(compressImg)))} /></label>
          <motion.span {...tapSmall} className="delAlbum" title="删除相册" onClick={() => setAskA(true)}><Ic v="🗑️" size={16} /></motion.span>
        </div>
      </Card>
      <div className="wallfull">
        {ps.map((f, i) => (
          <div className="wf" key={f}>
            <motion.img layoutId={`gph-${i}`} src={gurl(f)} alt="" loading="lazy" onClick={() => setBig(i)} transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
          </div>
        ))}
        {!ps.length && <Card className="blk" style={{ gridColumn: '1 / -1' }}><div className="mut" style={{ textAlign: 'center', padding: 18 }}>这本还空着，点上方「加照片」</div></Card>}
      </div>
      <AnimatePresence>{big >= 0 && ps[big] && <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} onClick={() => setBig(-1)}>
        <motion.img layoutId={`gph-${big}`} src={gurl(ps[big])} alt="" onClick={(e) => e.stopPropagation()} />
        <div className="lbbar" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setBig((big + ps.length - 1) % ps.length)}>‹</button>
          <span className="mut">{big + 1}/{ps.length}{(() => { const e2 = exOf(ps[big]); return e2 ? ' · ' + exifLine(JSON.stringify(e2)) : '' })()}</span>
          <button onClick={() => setAsk(ps[big])}><Ic v="🗑️" size={16} /></button>
          <button onClick={() => setBig((big + 1) % ps.length)}>›</button>
          <button className="lbx" onClick={() => setBig(-1)}><Ic v="close" size={20} /></button>
        </div>
      </motion.div>}</AnimatePresence>
      <Modal open={askA} onClose={() => setAskA(false)} typewriter={false} title="删除整个相册？"
        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button ghost onClick={() => setAskA(false)}>取消</Button>
          <Button type="primary" danger loading={busy} onClick={delAlbum}>删除相册</Button>
        </div>}>
        <div className="mut" style={{ textAlign: 'center' }}>将连同这本里的 <b style={{ color: '#c2456e' }}>{ps.length} 张照片</b>一起删除，且不可恢复。</div>
      </Modal>
      <Modal open={!!ask} onClose={() => setAsk('')} typewriter={false} title="删除这张照片？"
        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button ghost onClick={() => setAsk('')}>取消</Button>
          <Button type="primary" danger loading={busy} onClick={() => del(ask)}>删除</Button>
        </div>}>
        <div className="mut" style={{ textAlign: 'center' }}>删除后不可恢复，本相册其余照片不受影响。</div>
      </Modal>
    </>
  )
}

function Wishes({ data, reload, onAdd }: any) {
  const done = data.wishes.filter((w: any) => w.done).length
  const pct = data.wishes.length ? Math.round(done / data.wishes.length * 100) : 0
  const toggle = async (w: any) => { const d = !w.done; try { await pb.collection('wishes').update(w.id, { done: d, doneDate: d ? today() : '' }); reload() } catch (e) { quiet(e) } }
  return (
    <>
      <Card color="app-green" className="blk">
        <div className="li" style={{ paddingBottom: 0 }}>
          <span className="grow bar"><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
          <b className="cnt">{done}/{data.wishes.length}</b>
        </div>
        <div style={{ marginTop: 10 }}><Button type="primary" size="small" onClick={onAdd}><Ic v="➕" size={14} /> 添加约定</Button></div>
      </Card>
      <Card color="warm-peach-pink" className="blk">
        {data.wishes.map((w: any) => (
          <div className={'li wx' + (w.done ? ' done' : '')} key={w.id}>
            <button className={"tick" + (w.done ? " on" : "")} onClick={() => toggle(w)}>{w.done ? "✓" : ""}</button>
            <span className="grow" style={{ fontSize: 14.5 }}>{w.text}</span>
            {w.done && w.doneDate && <span className="mut">{dayStr(w.doneDate)}</span>}
          </div>
        ))}
        {!data.wishes.length && <div className="mut" style={{ textAlign: 'center', padding: 18 }}>还没有约定，写下第一件想一起做的事</div>}
      </Card>
    </>
  )
}

function Moments({ data, onAdd }: any) {
  return (
    <>
      <div className="pbar"><Button type="primary" onClick={onAdd}><Ic v="➕" size={14} /> 添加日子</Button><span className="mut">{data.moments.length} 个纪念日</span></div>
      {data.moments.map((m: any) => {
        const n = m.lunar && m.lunarMD ? nextOccurLunar(m.lunarMD, m.yearly) : nextOccur(m.day, m.yearly)
        return (
          <Card key={m.id} color={(n >= 0 && n <= 15 ? 'app-pink' : 'default') as any} className="blk">
            <div className="li" style={{ padding: 0, border: 0 }}>
              <span className="dot" style={{ width: 44, height: 44 }}><Ic v={m.emoji || '💗'} size={20} /></span>
              <span className="grow"><b style={{ fontSize: 15 }}>{m.name}</b>
                <div className="mut">{m.lunar && m.lunarMD ? `农历${lmdText(m.lunarMD)}` : dayStr(m.day)}{m.yearly ? ' · 每年' : ''}{m.note ? ` · ${m.note}` : ''}</div></span>
              <span className="dayn">{Math.abs(n)}<small>{n < 0 ? '已过天数' : '天后'}</small></span>
            </div>
          </Card>
        )
      })}
      {!data.moments.length && <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 22 }}>把重要的日子钉在这里</div></Card>}
    </>
  )
}

function Checkin({ data, reload, me, onAdd }: any) {
  const did = (pid: string) => data.ckrecords.some((r: any) => r.plan === pid && r.who === me)
  return (
    <>
      <div className="pbar"><Button type="primary" onClick={onAdd}><Ic v="➕" size={14} /> 新计划</Button><span className="mut">今天 · {today()}</span></div>
      <Card color="app-blue" className="blk">
        {data.checkins.map((c: any) => {
          const on = did(c.id)
          return (
            <div className="li" key={c.id}>
              <span className="dot"><Ic v={c.emoji || '📌'} /></span>
              <span className="grow"><b>{c.name}</b><div className="mut">{on ? '今日已打卡' : '还没打卡'}</div></span>
              <Button size="small" type={on ? 'text' : 'primary'} disabled={on} onClick={async () => {
                await pb.collection('ckrecords').create({ plan: c.id, who: me, day: today() }); reload()
              }}>{on ? '✓ 已打卡' : '打卡'}</Button>
            </div>
          )
        })}
        {!data.checkins.length && <div className="mut" style={{ textAlign: 'center', padding: 18 }}>还没有打卡计划</div>}
      </Card>
    </>
  )
}

function Msgs({ data, reload, me }: any) {
  const [t, setT] = useState('')
  return (
    <>
      <Card className="blk">
        <Title size="small" variant="tab">写祝福</Title>
        <textarea className="ta" value={t} onChange={(e) => setT(e.target.value)} placeholder={`${me}，想对 TA 说点什么…`} />
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Button type="primary" size="small" disabled={!t.trim()} onClick={async () => {
            await pb.collection('messages').create({ text: t.trim(), mood: me, member: pb.authStore.record?.id }); setT(''); reload()
          }}>送出</Button>
        </div>
      </Card>
      {data.messages.map((m: any) => (
        <Card key={m.id} color="app-teal" className="blk">
          <div style={{ fontSize: 14.5, lineHeight: 1.7 }}>{m.text}</div>
          <div className="li" style={{ padding: '8px 0 0', border: 0 }}>
            <Tag size="small" color="purple"><Ic v="💌" size={12} /> {m.mood || '祝福'}</Tag>
            <span className="grow" /><span className="mut">{fmtDT(m.created)}</span>
          </div>
        </Card>
      ))}
      {!data.messages.length && <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 22 }}>还没有祝福</div></Card>}
    </>
  )
}

function Tools() {
  const FOODS = ['火锅', '日料', '烧烤', '粤菜', '麻辣烫', '披萨', '饺子', '家常炒菜', '米线', '汉堡', '泰餐', '蒸菜', '砂锅粥', '铁板烧', '小面', '轻食沙拉']
  const PLACES = ['公园散步', '看场电影', '逛博物馆', '去海边', '爬山', '逛书店', '密室逃脱', '游乐园', '咖啡厅发呆', '看展', '骑行绿道', '露营看星星']
  const [pick, setPick] = useState<any>({})
  const roll = (kind: string, arr: string[]) => setPick((p: any) => ({ ...p, [kind]: arr[Math.floor(Math.random() * arr.length)] }))
  const TCard = ({ t, ic, k, arr, color }: any) => (
    <Card color={color} className="blk" style={{ textAlign: 'center' }}>
      <Title size="small" variant="tab"><Ic v={ic} size={15} /> {t}</Title>
      <div style={{ margin: '10px 0' }}><b style={{ fontSize: 34, color: '#c2456e' }}>{pick[k] || '？'}</b></div>
      <Button type="primary" onClick={() => roll(k, arr)}>帮我决定</Button>
    </Card>
  )
  return (
    <>
      <TCard t="吃什么" ic="🍜" k="food" arr={FOODS} color="app-orange" />
      <TCard t="去哪玩" ic="🗺️" k="place" arr={PLACES} color="app-teal" />
    </>
  )
}

function About({ data }: any) {
  const s = data.setting || {}
  return (
    <>
      <Card color="app-red" className="blk" style={{ textAlign: 'center' }}>
        <div><Ic v="couple" size={42} /></div>
        <div style={{ margin: '6px 0 2px' }}><Title size="middle" color="app-red" variant="layer">{s.names || '我们'}</Title></div>
        <div className="mut">自 {dayStr(s.startDate) || '——'} 起，已相伴 {s.startDate ? daysSince(s.startDate) : 0} 天</div>
        <Divider style={{ margin: '12px 20px' }} />
        <div style={{ fontSize: 14, lineHeight: 2, textAlign: 'left', whiteSpace: 'pre-wrap' }}>
          {s.story || '我们的故事从这里开始。\n在「更多 · 关于我们」里写下属于你们的篇章。'}
        </div>
      </Card>
      <Card className="blk">
        <Title size="small" variant="tab">在一起做的事</Title>
        {data.wishes.slice(0, 5).map((w: any) => (
          <div className="li" key={w.id}><span className="dot"><Ic v={w.done ? '✅' : '⏳'} /></span><span className="grow">{w.text}</span></div>
        ))}
        {!data.wishes.length && <div className="mut" style={{ textAlign: 'center', padding: 14 }}>爱情清单还空着</div>}
      </Card>
    </>
  )
}


function BackupPage({ reload }: any) {
  const [c, setC] = useState<any>(null)
  const [list, setList] = useState<any>({ items: [], lastRun: '', lastResult: '', auto: true })
  const [busy, setBusy] = useState<string>('')
  const [msg, setMsg] = useState<any>(null)
  const get = () => pb.collection('bkcfg').getFullList().then((r: any) => r[0] || null).then((r: any) => {
    // webdavPass 是 hidden 字段，接口永远不下发；只标记「已有配置」，要改密码就重填
    const { webdavPass, ...rest } = r || {}
    setC({ ...rest, auto: r ? !!r.auto : true, hasSaved: !!(r && (r.webdavUrl || r.webdavUser)) })
    setList((l: any) => ({ ...l, auto: r ? !!r.auto : true }))
  }).catch((e: any) => setMsg({ ok: false, text: 'bkcfg 读取失败：' + String(e?.message || e) }))
  useEffect(() => { get(); fetchList() }, [])
  const fetchList = () => fetch('/api/ai/backup/list', { headers: { Authorization: pb.authStore.token! } })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
    .then(setList).catch((e: any) => setMsg({ ok: false, text: '备份接口不可用（未安装 pb_hooks？）：' + String(e?.message || e) }))
  const save = async (patch: any, toast = '已保存') => {
    setBusy('save'); setMsg(null)
    try {
      const body: any = { ...patch }
      if ('passDraft' in body) { if (body.passDraft) body.webdavPass = body.passDraft; delete body.passDraft }
      if (c.id) await pb.collection('bkcfg').update(c.id, body)
      else await pb.collection('bkcfg').create({ auto: true, ...body })
      await get(); setMsg({ ok: true, text: toast })
    }
    catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy('')
  }
  const call = async (kind: string, url: string) => {
    setBusy(kind); setMsg(null)
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: pb.authStore.token! } })
      if (!r.ok) throw new Error(`HTTP ${r.status}（未安装备份 hooks？）`)
      const j = await r.json()
      if (kind === 'dav') setMsg(j.ok ? { ok: true, text: 'WebDAV 可用：' + j.detail } : { ok: false, text: j.detail })
      else { setMsg({ ok: !String(j.output).includes('✗'), text: String(j.output).replace(/^OK /, '') }); fetchList(); reload() }
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy('')
  }
  if (!c) return <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 18 }}>载入中…</div></Card>
  return (
    <>
      <Card color={c.auto ? 'app-green' : 'brown'} className="blk">
        <div className="li" style={{ border: 0 }}>
          <button className={'tick' + (c.auto ? ' on' : '')} onClick={() => save({ auto: !c.auto })}>{c.auto ? '✓' : ''}</button>
          <span className="grow"><b>每日自动备份</b>
            <div className="mut">每天 03:30，本地留最近 14 份</div></span>
          <Tag size="small" color={c.auto ? 'app-green' : 'brown'}>{c.auto ? '开' : '关'}</Tag>
        </div>
        <Divider style={{ margin: '10px 4px' }} />
        <div style={{ fontSize: 13, lineHeight: 1.9 }}>
          <div>上次备份：<b>{list.lastRun ? fmtDT(list.lastRun) : '尚未跑过'}</b></div>
          {list.lastResult && <div className="mut">{list.lastResult}</div>}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
          <Button type="primary" size="small" loading={busy === 'run'} onClick={() => call('run', '/api/ai/backup/run')}>立即备份</Button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? '#3f8f4f' : '#d0455f' }}>{msg.ok ? '✓ ' : '✗ '}{msg.text}</div>}
      </Card>

      <Card color="app-blue" className="blk">
        <Title size="small" variant="tab">异地备份 WebDAV（可选）</Title>
        <div className="aifrm" style={{ marginTop: 8 }}>
          <Input placeholder="地址，如 http://192.0.2.10:5005/站点备份" value={c.webdavUrl || ''} onChange={(e: any) => setC({ ...c, webdavUrl: e.target.value })} />
          <Input placeholder="账号（飞牛登录名）" value={c.webdavUser || ''} onChange={(e: any) => setC({ ...c, webdavUser: e.target.value })} />
          <Input type="password" placeholder={c.hasSaved ? '已保存过配置，留空则不改' : '密码（保存后不再显示）'} value={c.passDraft || ''} onChange={(e: any) => setC({ ...c, passDraft: e.target.value })} />
          <Input placeholder="远程子目录，如 /ai-couple" value={c.webdavDir || ''} onChange={(e: any) => setC({ ...c, webdavDir: e.target.value })} />
        </div>
        <div className="mut" style={{ margin: '8px 0' }}>注意：飞牛 WebDAV 根目录不可写，
          地址必须落在共享文件夹内；建议用 http:5005，别用自签 https:5006</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button size="small" loading={busy === 'save'} onClick={() => save({ webdavUrl: c.webdavUrl, webdavUser: c.webdavUser, passDraft: c.passDraft, webdavDir: c.webdavDir })}>保存设置</Button>
          <Button size="small" ghost loading={busy === 'dav'} onClick={() => call('dav', '/api/ai/backup/test-dav')}>测试连接</Button>
        </div>
      </Card>

      <Card className="blk">
        <Title size="small" variant="tab">备份文件（本地 {list.items.length}）</Title>
        {list.items.map((f: any) => (
          <div className="li" key={f.name}>
            <span className="dot">💾</span>
            <span className="grow"><b style={{ fontSize: 13 }}>{f.name}</b>
              <div className="mut">{fmtDT(f.modified)} · {(f.size / 1024 / 1024).toFixed(1)}MB</div></span>
          </div>
        ))}
        {!list.items.length && <div className="mut" style={{ textAlign: 'center', padding: 14 }}>还没有备份文件</div>}
      </Card>
    </>
  )
}

function More({ data, onOut, setModal, me, go, night, setNight, theme, setTheme }: any) {
  const line = (ic: string, t: string, v: string, act?: () => void) => (
    <div className="li" onClick={act}>
      <span className="dot"><Ic v={ic} /></span>
      <span className="grow" style={{ fontSize: 14.5 }}><b>{t}</b></span>
      <span className="mut">{v}</span><span className="mut">›</span>
    </div>
  )
  return (
    <>
      <Card className="blk"><Title size="small" variant="tab">我们</Title>
        {line('👤', '我的资料', me.nickName || me.username || '', () => setModal('profile'))}
        {line('💑', '关于我们', data.setting?.names || '未设置', () => setModal('about'))}
      </Card>
      <Card color="app-yellow" className="blk"><Title size="small" variant="tab">设置</Title>
        {line('🏷️', '站点名称', data.setting?.siteName || '情侣小站', () => setModal('sitename'))}
{line('layout', '功能卡片', '排列首页宫格 · 添加链接', () => go('tilemgr'))}
        {line('palette', '配色主题', theme === 'island' ? '官方原版' : '玫瑰奶油', () => setTheme(theme === 'island' ? 'rose' : 'island'))}
        {line('🌙', '深色模式', night ? '已开启' : '已关闭', () => setNight((x: boolean) => !x))}
        {line('🔐', '私密口令', data.setting?.lockOn ? '已启用' : '未启用', () => setModal('lockSet'))}
        {line('💾', '数据备份', '', () => go('backup'))}
        {line('🧊', '刷新数据', '', () => location.reload())}
      </Card>
      <Card color="warm-peach-pink" className="blk" style={{ textAlign: 'center' }}>
        <div className="mut" style={{ marginBottom: 10 }}>当前登录：{me.nickName || me.username}</div>
        <Button danger onClick={onOut}>退出登录</Button>
        <div className="mut" style={{ marginTop: 12, fontSize: 11 }}>情侣小站 · PocketBase + React + Animal Island UI · v0.57</div>
      </Card>
    </>
  )
}

export { Av, TabBtn, HomeExtra, Diary, Albums, AlbumView, Wishes, Moments, Checkin, Msgs, Tools, About, BackupPage, More }
