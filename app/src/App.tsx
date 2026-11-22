import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Background, Card, Title, Button, Input, Tag, Modal, Divider } from 'animal-island-ui'
import './app.css'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
import { spring, pageVariants, tapSmall, listVariant, itemVariant } from './motion'
import { Ic } from './Icons'
import { pb, quiet, showToast } from './core'
import { Games, GomokuHome, GomokuLive, GomokuLocal } from './Gomoku'
import { TILES, resolveTiles, PageTileMgr } from './Tiles'
import { C4Home, C4Live } from './Connect4'
import { FlyHome, FlyLive, FlyLocal } from './Flying'
import { nextOccurLunar, readExif, sha256, lunarToday, solarToLunar } from './utils'
const exifLine = (t: string) => { try { const j = JSON.parse(t); const a: string[] = []; if (j.date) a.push(j.date.slice(0, 10).replace(/:/g, '-')); if (j.cam) a.push(j.cam); if (j.gps) a.push('GPS ' + j.gps.join(',')); return a.join(' · ') } catch { return '' } }
const lmdText = (md: string) => { const [m, d] = md.split('-').map(Number); const LM = ['正','二','三','四','五','六','七','八','九','十','冬','腊']; const LD = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十']; return LM[m - 1] + '月' + LD[d - 1] }

const MOODS = ['happy', 'love', 'calm', 'miss', 'proud', 'sad']
const MOOD_CN: any = { happy: '开心', love: '恋爱中', calm: '平静', miss: '想念', proud: '得意', sad: '难过' }
const MOOD_IC: any = { happy: '😄', love: '😍', calm: '😌', miss: '🥺', proud: '😎', sad: '😢' }
const MOOD_TAG: any = { happy: 'app-yellow', love: 'app-pink', calm: 'app-teal', miss: 'purple', proud: 'lime-green', sad: 'app-blue' }
const dayStr = (d: string) => (d || '').slice(0, 10)
const fmtDT = (iso: string) => {
  const d = new Date(iso); const z = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`
}
const today = () => new Date().toISOString().slice(0, 10)
const daysSince = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(dayStr(d) + 'T00:00:00').getTime()) / 86400000))
function nextOccur(day: string, yearly: boolean) {
  const d = new Date(dayStr(day) + 'T00:00:00'); const now = new Date()
  if (!yearly) return Math.ceil((d.getTime() - Date.now()) / 86400000)
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate())
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (next.getTime() < t0.getTime()) next.setFullYear(now.getFullYear() + 1)
  return Math.round((next.getTime() - t0.getTime()) / 86400000)
}
const sinceParts = (d: string) => {
  const ms = Date.now() - new Date(dayStr(d)).getTime()
  if (ms < 0) return { h: 0, m: 0, s: 0 }
  return { h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60 }
}

const NAV = [
  { k: 'home', ic: '🏠', t: '首页' },
  { k: 'diary', ic: '📔', t: '日常' },
  { k: 'album', ic: '🎬', t: '相册' },
  { k: 'promise', ic: '📋', t: '清单' },
  { k: 'more', ic: '⋯', t: '更多' },
]

export default function App() {
  const [authed, setAuthed] = useState(pb.authStore.isValid)
  if (!authed) return <Login onOK={() => setAuthed(true)} />
  return <Site onOut={() => { pb.authStore.clear(); setAuthed(false) }} />
}

// 上传前压缩：iPhone 48MP 巨照（40MB+）会顶爆服务端请求上限变 400；
// 统一压到长边 2400 JPEG(85%)，顺带把 HEIC 转成通用 JPEG。GIF/小图直传保动图。
async function compressImg(fl: File): Promise<File> {
  try {
    if (fl.type === 'image/gif' || fl.size < 1.5 * 1048576) return fl
    const bmp: any = await createImageBitmap(fl)
    const sc = Math.min(1, 2400 / Math.max(bmp.width || 2400, bmp.height || 2400))
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round((bmp.width || 2400) * sc)); cv.height = Math.max(1, Math.round((bmp.height || 2400) * sc))
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
    if (bmp.close) bmp.close()
    const blob: any = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85))
    if (!blob) return fl
    return new File([blob], fl.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() })
  } catch { return fl }
}

// 天数滚动计数：easeOutExpo（与官方 CountUp 同曲线），输出普通 <b> 保持行内排版
const CountNum = ({ end }: { end: number }) => {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(end); return }
    let raf = 0
    const t0 = performance.now(), D = 1100
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / D)
      setV(Math.max(0, Math.round(end * (1 - Math.pow(2, -10 * k)))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [end])
  return <b>{v}</b>
}

function Login({ onOK }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState('')
  const go = async () => {
    setErr('')
    try { await pb.collection('members').authWithPassword(u, p); onOK() } catch { setErr('账号或密令不对，再试试') }
  }
  return (
    <Background type="dots-pink" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card color="app-pink" style={{ width: '100%', maxWidth: 370, padding: 26 }}>
        <div style={{ textAlign: 'center' }}><Ic v="couple" size={42} /></div>
        <div style={{ textAlign: 'center', margin: '6px 0 2px' }}>
          <Title size="middle" color="app-pink" variant="ribbon">情侣小站</Title>
        </div>
        <div style={{ textAlign: 'center', color: '#a08b76', fontSize: 13, marginBottom: 18 }}>爱是相伴，此心安处是吾乡</div>
        <div className="aifrm">
          <Input placeholder="账号（zwh / mm）" value={u} onChange={(e: any) => setU(e.target.value)} />
          <Input type="password" placeholder="密令（不限字数）" value={p} onChange={(e: any) => setP(e.target.value)} onPressEnter={go} />
          {err && <div style={{ color: '#d0455f', fontSize: 13 }}>{err}</div>}
          <Button type="primary" block onClick={go}>进入小站</Button>
        </div>
      </Card>
    </Background>
  )
}

function Clock({ start }: any) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [])
  if (!start) return <>0小时0分0秒</>
  const q = sinceParts(start)
  return <>{q.h}小时{q.m}分{q.s}秒</>
}

function Site({ onOut }: any) {
  const me: any = pb.authStore.record || {}
  const [route, setRoute] = useState('home')
  const [loaded, setLoaded] = useState(false)
  const [data, setData] = useState<any>({ setting: null, diaries: [], albums: [], moments: [], wishes: [], messages: [], checkins: [], ckrecords: [], comments: [] })
  const [unlocked, setUnlocked] = useState(!!sessionStorage.getItem('lk'))
  useEffect(() => { const t = setInterval(() => { const v = !!sessionStorage.getItem('lk'); setUnlocked((o) => (o === v ? o : v)) }, 900); return () => clearInterval(t) }, [])
  const [modal, setModal] = useState<string | null>(null)
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const [setting, diaries, albums, moments, wishes, messages, checkins, ckrecords, comments] = await Promise.all([
        pb.collection('settings').getList(1, 1).then((p: any) => p.items[0] || null).catch(quiet),
        pb.collection('diaries').getFullList({ sort: '-created', expand: 'member' }).catch(quiet),
        pb.collection('albums').getFullList({ sort: '-created', expand: 'member' }).catch(quiet),
        pb.collection('moments').getFullList({ sort: 'day' }).catch(quiet),
        pb.collection('wishes').getFullList({ sort: '-created' }).catch(quiet),
        pb.collection('messages').getFullList({ sort: '-created' , expand: 'member' }).catch(quiet),
        pb.collection('checkins').getFullList({ sort: 'created' }).catch(quiet),
        pb.collection('ckrecords').getFullList({ filter: `day='${today()}'` }).catch(quiet),
        pb.collection('comments').getFullList({ sort: 'id', expand: 'member' }).catch(quiet),
      ])
      setData({ setting, diaries: diaries || [], albums: albums || [], moments: moments || [], wishes: wishes || [], messages: messages || [], checkins: checkins || [], ckrecords: ckrecords || [], comments: comments || [] })
    } finally { busy.current = false; setLoaded(true) }
  }, [])

  useEffect(() => {
    load()
    const cols = ['diaries', 'albums', 'moments', 'wishes', 'messages', 'checkins', 'ckrecords', 'settings', 'comments']
    cols.forEach((c) => pb.collection(c).subscribe('*', () => setTimeout(load, 150)).catch(quiet))
    return () => { cols.forEach((c) => pb.collection(c).unsubscribe('*').catch(quiet)) }
  }, [load])

  const [dir, setDir] = useState(0)
  const [ctx, setCtx] = useState<any>(null)
  const [agrid, setAgrid] = useState(false)
  const MAINR = ['home', 'diary', 'album', 'more']
  const stack = useRef<string[]>([])
  const go = (k: string, arg?: any, repl?: boolean) => {
    if (arg !== undefined) setCtx(arg)
    if (MAINR.includes(k)) stack.current = []
    else if (!repl && k !== route) stack.current = [...stack.current.slice(-10), route]
    setDir(!MAINR.includes(route) && MAINR.includes(k) ? -1 : MAINR.includes(route) && !MAINR.includes(k) ? 1 : 0)
    setRoute(k); window.scrollTo(0, 0)
  }
  const back = () => {
    const prev = stack.current.pop() || 'home'
    setDir(-1); setRoute(prev); window.scrollTo(0, 0)
  }
  const isMain = route === 'home' || route === 'more'
  const [theme, setTheme] = useState(() => { const t = localStorage.getItem('ai-theme'); return t === 'island' ? 'island' : 'rose' })
  const [night, setNight] = useState(() => localStorage.getItem('ai-night') === '1')
  useEffect(() => { document.body.classList.toggle('theme-island', theme === 'island'); localStorage.setItem('ai-theme', theme) }, [theme])
  useEffect(() => { document.body.classList.toggle('night', night); localStorage.setItem('ai-night', night ? '1' : '0') }, [night])

  return (
    <MotionConfig reducedMotion="user">
    <Background type={theme === 'island' ? 'dots-yellow-green' : 'dots-pink'} style={{ minHeight: '100vh' }}>
      <div className="shell">
        <Card className="side" style={{ padding: 12 }}>
          <div className="brand"><Ic v="couple" size={18} /> {data.setting?.siteName || '情侣小站'}</div>
          {NAV.map((n) => (
            <button key={n.k} className={'navb' + (route === n.k ? ' on' : '')} onClick={() => go(n.k)}>
              <span><Ic v={n.ic} size={18} /></span>{n.t}
            </button>
          ))}
          <Divider style={{ margin: '10px 4px' }} />
          {TILES.filter((t) => !NAV.some((n) => n.k === t.k)).map((n) => (
            <button key={n.k} className={'navb' + (route === n.k ? ' on' : '')} onClick={() => go(n.k)}>
              <span><Ic v={n.ic} size={18} /></span>{n.t}
            </button>
          ))}
        </Card>

        <div className="main">
          <div className="hrow">
            {!MAINR.includes(route) && <motion.button {...tapSmall} className="backbtn" onClick={back}><Ic v="arrowL" size={14} /> 返回</motion.button>}
            {route === 'home' && <span className="dchip" onClick={() => go('home')}><Ic v="❤️" size={11} w="fill" /> 第 {data.setting ? daysSince(data.setting.startDate) : 0} 天</span>}
            <div className="htitle">{route === 'home' ? (data.setting?.siteName || '情侣小站') : ({ backup: '数据备份', more: '更多', tilemgr: '功能卡片', c4: '四子棋', 'c4-play': '四子棋 · 对局', fly: '情侣飞行棋', 'fly-play': '飞行棋 · 对局', 'fly-local': '飞行棋 · 同屏', games: '小游戏', gomoku: '五子棋', 'gomoku-play': '五子棋 · 对局', 'gomoku-local': '五子棋 · 同屏', 'album-view': '相册' } as any)[route] || (TILES.find((t) => t.k === route)?.t || '')}</div>
            <div className="hacts">
              <button className="hbtn" onClick={() => setModal('search')}><Ic v="🔍" size={16} /></button>
              <button className="hbtn" onClick={() => setModal('notice')}><Ic v="🔔" size={16} /></button>
              <button className="hbtn" onClick={() => setNight((x: boolean) => !x)}>{night ? <Ic v="🌙" size={16} /> : <Ic v="☀️" size={16} />}</button>
              <button className="hbtn" title="天气 · 敬请期待"><Ic v="☁️" size={16} /></button>
              <button className="hbtn" title="足迹 · 敬请期待"><Ic v="👣" size={16} /></button>
            </div>
          </div>

          {loaded === false && <div className="mut-row risein">小岛正在开门…</div>}
          <AnimatePresence mode="wait">
          <motion.div key={route} custom={dir} variants={pageVariants} initial="initial" animate="animate" exit="exit"
            transition={spring.soft}>
          {route === 'home' && (
            <>
              <Card className="daycard blk" onClick={() => setModal('days')}>
                <div className="dleft">
                  <div className="l1">今天，是我们在一起的</div>
                  <div className="l2">第 <CountNum end={data.setting ? daysSince(data.setting.startDate) : 0} /> 天</div>
                  <div className="l3"><Clock start={data.setting?.startDate} /> · 农历{lunarToday()}</div>
                </div>
                <div className="dv" />
                <div className="l4">“{data.setting?.quote || '爱是相伴，此心安处是吾乡'}”</div>
              </Card>
              <div className="tiles">
                {resolveTiles(data.setting?.tiles).map((t: any, i: number) => (
                  <Card key={t.k} color="default" hoverable className="tile" data-t={(i % 3) + 1} style={{ ['--i' as any]: i }} onClick={() => (t.url ? window.open(t.url, '_blank', 'noopener') : go(t.k))}>
                    <span className="ic"><Ic v={t.ic} /></span>
                    <span className="t">{t.t}</span><span className="s">{t.s}</span>
                  </Card>
                ))}
              </div>
              <HomeExtra data={data} go={go} />
            </>
          )}

          {route === 'diary' && <Diary data={data} reload={load} onAdd={() => setModal('diary')} unlocked={unlocked} askLock={() => setModal('lockIn')} />}
          {route === 'album' && <Albums data={data} reload={load} onAdd={() => setModal('album')} go={go} grid={agrid} setGrid={setAgrid} />}
          {route === 'promise' && <Wishes data={data} reload={load} onAdd={() => setModal('wish')} />}
          {route === 'countdown' && <Moments data={data} reload={load} onAdd={() => setModal('moment')} />}
          {route === 'checkin' && <Checkin data={data} reload={load} me={me.nickName || me.username || '我'} onAdd={() => setModal('checkin')} />}
          {route === 'message' && <Msgs data={data} reload={load} me={me.nickName || me.username || '我'} />}
          {route === 'tools' && <Tools />}
          {route === 'backup' && <BackupPage reload={load} />}
          {route === 'about' && <About data={data} />}
          {route === 'bill' && <Stub ic="💰" t="记账" s="钱包模块开发中，敬请期待" color="app-green" />}
          {route === 'wardrobe' && <Stub ic="👗" t="衣柜" s="穿搭衣橱开发中，敬请期待" color="purple" />}
          {route === 'period' && <Stub ic="🩸" t="经期记录" s="健康记录开发中，敬请期待" color="warm-peach-pink" />}
          {route === 'more' && <More data={data} onOut={onOut} setModal={setModal} me={me} go={go} night={night} setNight={setNight} theme={theme} setTheme={setTheme} />}
          {route === 'games' && <Games go={go} />}
          {route === 'tilemgr' && <PageTileMgr data={data} />}
          {route === 'album-view' && <AlbumView id={ctx} data={data} reload={load} go={go} />}
          {route === 'gomoku' && <GomokuHome data={data} go={go} me={me} />}
          {route === 'gomoku-play' && <GomokuLive id={ctx} data={data} go={go} me={me} />}
          {route === 'c4' && <C4Home go={go} data={data} me={me} />}
          {route === 'c4-play' && <C4Live id={ctx} data={data} go={go} me={me} />}
          {route === 'fly' && <FlyHome go={go} me={me} />}
          {route === 'fly-play' && <FlyLive id={ctx} go={go} me={me} />}
          {route === 'fly-local' && <FlyLocal go={go} data={data} />}
          {route === 'gomoku-local' && <GomokuLocal data={data} go={go} />}
          </motion.div>
          </AnimatePresence>
          <div style={{ height: 30 }} />
        </div>
      </div>

      <div className="tabbar desk-hide">
        {NAV.filter(n=>n.k==='home'||n.k==='diary').map((n) => <TabBtn key={n.k} n={n} on={route === n.k} go={go} />)}
        <button className="plus" onClick={() => setModal('diary')}><Ic v="➕" size={26} w="fill" /></button>
        {NAV.filter(n=>n.k==='album'||n.k==='more').map((n) => <TabBtn key={n.k} n={n} on={route === n.k} go={go} />)}
      </div>

      {modal && <ModalCard kind={modal} data={data} me={me} close={() => setModal(null)} reload={load} go={go} setUnlocked={setUnlocked} />}
    </Background>
    </MotionConfig>
  )
}

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
          <div style={{ textAlign: 'right', marginTop: 8 }}><Button size="small" type="ghost" onClick={() => go('countdown')}>全部日子 →</Button></div>
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
          <div style={{ textAlign: 'right', marginTop: 8 }}><Button size="small" type="ghost" onClick={() => go('diary')}>更多日常 →</Button></div>
        </Card>
      )}
    </>
  )
}

function Diary({ data, reload, onAdd, unlocked, askLock }: any) {
  const like = async (d: any) => { try { await pb.collection('diaries').update(d.id, { likes: (d.likes || 0) + 1 }); reload() } catch (e) { quiet(e) } }
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
  const open = (a: any) => { bump(a, { views: (a.views || 0) + 1 }); go('album-view', a.id) }
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
        <Button type={view0 ? 'primary' : 'ghost'} onClick={() => setView0(!view0)}><Ic v="🎬" size={14} /> {view0 ? '返回动态' : '全部相册'}</Button>
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
            <motion.span className={'cLike' + ((a.likes || 0) > 0 ? ' on' : '')} {...tapSmall} onClick={() => bump(a, { likes: (a.likes || 0) + 1 })}>
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
  const [fresh, setFresh] = useState<any>(null)
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
      await pb.collection('albums').update(a.id, { photos: fs, exifs: JSON.stringify(ex) })
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
          <Button type="ghost" onClick={() => setAskA(false)}>取消</Button>
          <Button type="danger" loading={busy} onClick={delAlbum}>删除相册</Button>
        </div>}>
        <div className="mut" style={{ textAlign: 'center' }}>将连同这本里的 <b style={{ color: '#c2456e' }}>{ps.length} 张照片</b>一起删除，且不可恢复。</div>
      </Modal>
      <Modal open={!!ask} onClose={() => setAsk('')} typewriter={false} title="删除这张照片？"
        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button type="ghost" onClick={() => setAsk('')}>取消</Button>
          <Button type="danger" loading={busy} onClick={() => del(ask)}>删除</Button>
        </div>}>
        <div className="mut" style={{ textAlign: 'center' }}>删除后不可恢复，本相册其余照片不受影响。</div>
      </Modal>
    </>
  )
}

function Wishes({ data, reload, onAdd }: any) {
  const done = data.wishes.filter((w: any) => w.done).length
  const pct = data.wishes.length ? Math.round(done / data.wishes.length * 100) : 0
  const toggle = async (w: any) => { try { await pb.collection('wishes').update(w.id, { done: !w.done }); reload() } catch (e) { quiet(e) } }
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

function Moments({ data, reload, onAdd }: any) {
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
  const get = () => pb.collection('bkcfg').getFullList().then((r: any) => r[0]).then((r: any) => {
    setC(r); setList((l: any) => ({ ...l, auto: !!r.auto }))
  }).catch((e: any) => setMsg({ ok: false, text: 'bkcfg 读取失败：' + String(e?.message || e) }))
  useEffect(() => { get(); fetchList() }, [])
  const fetchList = () => fetch('/api/ai/backup/list', { headers: { Authorization: pb.authStore.token! } })
    .then((r) => r.json()).then(setList).catch(quiet)
  const save = async (patch: any, toast = '已保存') => {
    setBusy('save'); setMsg(null)
    try { await pb.collection('bkcfg').update(c.id, patch); await get(); setMsg({ ok: true, text: toast }) }
    catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy('')
  }
  const call = async (kind: string, url: string) => {
    setBusy(kind); setMsg(null)
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: pb.authStore.token! } })
      const j = await r.json()
      if (kind === 'dav') setMsg(j.ok ? { ok: true, text: 'WebDAV 可用：' + j.detail } : { ok: false, text: j.detail })
      else { setMsg({ ok: !String(j.output).includes('✗'), text: String(j.output).replace(/^OK /, '') }); fetchList(); reload() }
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy('')
  }
  const F = ({ label, k, ph, type }: any) => (
    <Input key={k} type={type} placeholder={ph} value={c?.[k] || ''} onChange={(e: any) => setC({ ...c, [k]: e.target.value })} />
  )
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
          <Input type="password" placeholder="密码（保存后不再显示，重填即覆盖）" value={c.webdavPass || ''} onChange={(e: any) => setC({ ...c, webdavPass: e.target.value })} />
          <Input placeholder="远程子目录，如 /ai-couple" value={c.webdavDir || ''} onChange={(e: any) => setC({ ...c, webdavDir: e.target.value })} />
        </div>
        <div className="mut" style={{ margin: '8px 0' }}>注意：飞牛 WebDAV 根目录不可写，
          地址必须落在共享文件夹内；建议用 http:5005，别用自签 https:5006</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button size="small" loading={busy === 'save'} onClick={() => save({ webdavUrl: c.webdavUrl, webdavUser: c.webdavUser, webdavPass: c.webdavPass, webdavDir: c.webdavDir })}>保存设置</Button>
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

const Stub = ({ ic, t, s, color }: any) => (
  <Card color={color} className="blk" style={{ textAlign: 'center', padding: '36px 20px' }}>
    <div><Ic v={ic} size={40} /></div>
    <div style={{ margin: '10px 0 4px' }}><Title size="small" variant="layer">{t}</Title></div>
    <div className="mut">{s}</div>
  </Card>
)

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
        <div className="mut" style={{ marginTop: 12, fontSize: 11 }}>情侣小站 · PocketBase + React + Animal Island UI · v0.4</div>
      </Card>
    </>
  )
}

function ModalCard({ kind, data, me, close, reload, go, setUnlocked }: any) {
  const [f, setF] = useState<any>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const s = data.setting || {}
    setF({})
    if (kind === 'about') setF({ names: s.names || '', startDate: dayStr(s.startDate), quote: s.quote || '', story: s.story || '', boyName: s.boyName || '男孩', girlName: s.girlName || '女孩' })
    if (kind === 'profile') setF({ nickName: me.nickName || '', gender: me.gender || '' })
    if (kind === 'diary') setF({ text: '', mood: 'happy', private: false, title: '' })
    if (kind === 'sitename') setF({ siteName: s.siteName || '' })
    if (kind === 'moment') setF({ yearly: true, lunar: false })
    if (kind === 'lockSet') setF({ p1: '', p2: '', on: !!data.setting?.lockOn })
    if (kind === 'search') setF({ q: '' })
  }, [kind])

  const save = async (fn: () => Promise<any>) => {
    setBusy(true)
    try { await fn(); await reload(); close() } catch (e: any) {
      const inner: any = e?.data?.data || e?.data || {}
      const det = Object.entries(inner)
        .map(([k, v]: any) => (v && typeof v === 'object' ? (v.message || JSON.stringify(v)) : String(v)))
        .filter((x: string) => x && !/failed to create|failed to update/i.test(x)).join('；')
      showToast(det ? `没存上：${det.slice(0, 60)}` : `没存上：${String(e?.message || e).slice(0, 40)}`)
    }
    setBusy(false)
  }
  const TITLE: any = { notice: '通知', days: '恋爱天数', diary: '写日常', album: '新建相册', wish: '添加约定', moment: '添加日子', checkin: '新打卡计划', profile: '我的资料', sitename: '站点名称', about: '关于我们', search: '搜索小站', games: '小游戏', gomoku: '五子棋', 'gomoku-play': '五子棋 · 对局', 'gomoku-local': '五子棋 · 同屏', 'album-view': '相册', lockIn: '解锁私密内容', lockSet: '私密口令' }

  return (
    <Modal open onClose={close} typewriter={false} title={TITLE[kind] || ''}>
      {kind === 'search' && <>
        <Input placeholder="搜日常 / 相册 / 清单 / 祝福…" autoFocus value={f.q || ''} onChange={(e: any) => setF({ ...f, q: e.target.value })} />
        <div style={{ marginTop: 10 }}>
          {(f.q || '').trim().length >= 1 && <>
            {data.diaries.filter((x: any) => (x.text + ' ' + (x.title || '')).includes(f.q.trim())).slice(0, 6).map((x: any) => (
              <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('diary') }}>
                <span className="dot"><Ic v={MOOD_IC[x.mood] || '📔'} /></span>
                <span className="grow"><b>{x.title || x.text.slice(0, 20)}</b><div className="mut">日常 · {fmtDT(x.created)}</div></span>
              </div>))}
            {data.albums.filter((x: any) => x.name.includes(f.q.trim())).map((x: any) => (
              <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('album') }}>
                <span className="dot"><Ic v="🎬" /></span>
                <span className="grow"><b>{x.name}</b><div className="mut">相册 · {(x.photos || []).length} 张</div></span>
              </div>))}
            {data.wishes.filter((x: any) => x.text.includes(f.q.trim())).slice(0, 6).map((x: any) => (
              <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('promise') }}>
                <span className="dot"><Ic v={x.done ? '✅' : '⏳'} /></span>
                <span className="grow">{x.text}<div className="mut">清单</div></span>
              </div>))}
            {data.messages.filter((x: any) => x.text.includes(f.q.trim())).slice(0, 6).map((x: any) => (
              <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('message') }}>
                <span className="dot"><Ic v="💌" /></span>
                <span className="grow">{x.text.slice(0, 30)}<div className="mut">祝福</div></span>
              </div>))}
            {!(data.diaries.filter((x: any) => (x.text + ' ' + (x.title || '')).includes(f.q.trim())).length + data.albums.filter((x: any) => x.name.includes(f.q.trim())).length + data.wishes.filter((x: any) => x.text.includes(f.q.trim())).length + data.messages.filter((x: any) => x.text.includes(f.q.trim())).length)
              && <div className="mut" style={{ textAlign: 'center', padding: 16 }}>没搜到「{f.q.trim()}」相关内容</div>}
          </>}
        </div>
      </>}
      {kind === 'lockIn' && <>
        <div className="mut" style={{ marginBottom: 10 }}>输入私密口令后，本次浏览会话内不再重复询问</div>
        <input className="ta2" type="password" placeholder="解锁口令" autoFocus value={f.pw || ''} onChange={(e) => setF({ ...f, pw: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={async () => {
            setBusy(true)
            const h = await sha256((f.pw || '').trim())
            if (h === data.setting?.lockHash) { sessionStorage.setItem('lk', '1'); setUnlocked(true); close() }
            else setF((x: any) => ({ ...x, msg: '口令不对，再试试' }))
            setBusy(false)
          }}>解 锁</Button>
        </div>
        {f.msg && <div style={{ color: '#d0455f', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{f.msg}</div>}
      </>}
      {kind === 'lockSet' && <>
        <div className="mut" style={{ marginBottom: 10 }}>设一个两人知道的口令。之后所有「私密」日常对 TA 上锁，输入口令才可见。</div>
        <input className="ta2" type="password" placeholder="新口令（至少 4 位）" value={f.p1 || ''} onChange={(e) => setF({ ...f, p1: e.target.value })} />
        <input className="ta2" type="password" placeholder="再输一次" value={f.p2 || ''} onChange={(e) => setF({ ...f, p2: e.target.value })} />
        {!data.setting?.lockHash ? null : (
          <div className="li" style={{ border: 0, marginTop: 6 }}>
            <button className={'tick' + (f.on ? ' on' : '')} onClick={() => setF({ ...f, on: !f.on })}>{f.on ? '✓' : ''}</button>
            <span style={{ fontSize: 14 }}>启用私密口令锁</span>
          </div>)}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => save(async () => {
            const st = data.setting || {}
            const patch: any = { lockOn: f.p1 ? true : !!f.on }
            if (f.p1 && f.p1 === f.p2) patch.lockHash = await sha256(f.p1.trim())
            if (st.id) await pb.collection('settings').update(st.id, patch)
            else await pb.collection('settings').create(patch)
          })}>{data.setting?.lockHash ? '保存设置' : '设 置'}</Button>
        </div>
        {f.msg && <div style={{ color: '#d0455f', fontSize: 13, marginTop: 8 }}>{f.msg}</div>}
      </>}
      {kind === 'notice' && <div className="li"><span className="dot"><Ic v="couple" /></span><span className="grow">欢迎来到情侣小站，完善资料后就可以记录日常啦<div className="mut">刚刚</div></span></div>}
      {kind === 'days' && <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <b style={{ fontSize: 44, color: '#c2456e' }}>{data.setting ? daysSince(data.setting.startDate) : 0}</b>
        <div className="mut">起始日 {dayStr(data.setting?.startDate) || '未设置'}，可在「关于我们」修改</div>
      </div>}
      {kind === 'diary' && <>
        <Input placeholder="标题（可留空）" value={f.title || ''} onChange={(e: any) => setF({ ...f, title: e.target.value })} />
        <textarea className="ta" style={{ margin: '4px 0 10px' }} value={f.text || ''} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="今天发生了什么值得记住的事？" />
        <div className="chips" style={{ marginBottom: 10 }}>
          {MOODS.map((m) => <Tag key={m} color={f.mood === m ? 'app-pink' : MOOD_TAG[m]} onClick={() => setF({ ...f, mood: m })} style={{ cursor: 'pointer' }}><Ic v={MOOD_IC[m]} size={13} /> {MOOD_CN[m]}</Tag>)}
        </div>
        <div className="li" style={{ border: 0 }}>
          <button className={"tick" + (f.private ? " on" : "")} onClick={() => setF({ ...f, private: !f.private })}>{f.private ? "✓" : ""}</button>
          <span style={{ fontSize: 14 }}>🔒 仅自己可见</span>
          <span className="grow" />
          <label className="picbtn"><Ic v="📎" size={13} /> 附图
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => { const f0 = e.target.files?.[0]; setF({ ...f, photo: f0 ? await compressImg(f0) : null }) }} /></label>
        </div>
        {f.photo && <div className="mut" style={{ margin: '4px 0' }}>已选：{f.photo.name}</div>}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.text || '').trim()} onClick={() => save(async () => {
            const fd: any = { text: f.text.trim(), mood: f.mood, title: f.title || '', private: !!f.private, member: pb.authStore.record?.id }
            if (f.photo) { fd.photo = f.photo; const ex = await readExif(f.photo); if (ex) fd.exif = JSON.stringify(ex) }
            await pb.collection('diaries').create(fd)
          })}>保 存</Button>
        </div>
      </>}
      {kind === 'album' && <>
        <Input placeholder="相册名，比如：第一次旅行" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <textarea className="ta" placeholder="写两句此刻的心情…（可选）" value={f.note || ''} onChange={(e: any) => setF({ ...f, note: e.target.value })} style={{ minHeight: 46 }} />
        <label className="picbtn" style={{ display: 'inline-block', marginTop: 6 }}>选择照片（可多选）
          <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async (e) => setF({ ...f, files: await Promise.all([...(e.target.files || [])].map(compressImg)) })} /></label>
        <div className="mut" style={{ margin: '8px 0 0' }}>{f.files?.length ? `已选 ${f.files.length} 张` : '也可以建好后再加图'}</div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim()} onClick={() => save(async () => {
            const fd: any = { name: f.name.trim() }
            const meRec = pb.authStore.record; if (meRec) fd.member = meRec.id
            if ((f.note || '').trim()) fd.note = f.note.trim()
            if (f.files?.length) {
              fd.photos = f.files; fd.cover = f.files[0]
              const ex: any = {}
              for (const x of f.files) { const r = await readExif(x); if (r) ex[x.name] = r }
              if (Object.keys(ex).length) fd.exifs = JSON.stringify(ex)
            }
            await pb.collection('albums').create(fd)
          })}>创 建</Button>
        </div>
      </>}
      {kind === 'wish' && <>
        <Input placeholder="想和 TA 一起做的事…" value={f.text || ''} onChange={(e: any) => setF({ ...f, text: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.text || '').trim()} onClick={() => save(() => pb.collection('wishes').create({ text: f.text.trim(), done: false }))}>加入清单</Button>
        </div>
      </>}
      {kind === 'moment' && <>
        <Input placeholder="日子名称，比如：女孩的生日" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <div className="chips" style={{ margin: '10px 0 0' }}>
          <Tag color={!f.lunar ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, lunar: false })} style={{ cursor: 'pointer' }}>阳历日期</Tag>
          <Tag color={f.lunar ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, lunar: true })} style={{ cursor: 'pointer' }}>农历日期</Tag>
        </div>
        {!f.lunar ? (
          <div className="mdate"><span>日期</span><input type="date" value={f.day || ''} onChange={(e) => setF({ ...f, day: e.target.value })} /></div>
        ) : (
          <div className="mdate"><span>农历月/日</span>
            <input type="number" min={1} max={12} placeholder="月" style={{ width: 64 }} value={f.lm || ''} onChange={(e) => setF({ ...f, lm: e.target.value })} />
            <input type="number" min={1} max={30} placeholder="日" style={{ width: 64 }} value={f.ld || ''} onChange={(e) => setF({ ...f, ld: e.target.value })} />
          </div>
        )}
        <div className="chips" style={{ margin: '10px 0 0' }}>
          <Tag color={f.yearly !== false ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, yearly: true })} style={{ cursor: 'pointer' }}>每年重复</Tag>
          <Tag color={f.yearly === false ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, yearly: false })} style={{ cursor: 'pointer' }}>仅一次</Tag>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim() || (f.lunar ? !(f.lm && f.ld) : !f.day)} onClick={() => save(() => pb.collection('moments').create(
            f.lunar
              ? { name: f.name.trim(), lunar: true, lunarMD: `${Number(f.lm)}-${Number(f.ld)}`, day: new Date().toISOString().slice(0, 10), yearly: f.yearly !== false }
              : { name: f.name.trim(), day: f.day, yearly: f.yearly !== false }))}>保 存</Button>
        </div>
      </>}
      {kind === 'checkin' && <>
        <Input placeholder="图标（一个 emoji），如 🌙" value={f.emoji || ''} onChange={(e: any) => setF({ ...f, emoji: e.target.value })} />
        <Input placeholder="计划名，如：早睡打卡" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim()} onClick={() => save(() => pb.collection('checkins').create({ name: f.name.trim(), emoji: f.emoji || '📌' }))}>创 建</Button>
        </div>
      </>}
      {kind === 'profile' && <>
        <div className="avrow">
          <Av rec={pb.authStore.record} size={64} fb="💗" />
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 14 }}>我的头像</div>
            <label className="picbtn" style={{ marginTop: 6 }}>
              {f.avBusy ? '上传中…' : f.avDone ? '✓ 已更新' : '选择图片'}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                const fl = [...(e.target.files || [])]
                if (!fl.length) return
                fl[0] = await compressImg(fl[0])
                setF({ ...f, avBusy: true })
                try {
                  const rec = await pb.collection('members').update(pb.authStore.record!.id, { avatar: fl[0] })
                  try { pb.authStore.save(pb.authStore.token, rec) } catch { /* 本地缓存刷新失败不影响上传结果 */ }
                  setF({ ...f, avBusy: false, avDone: true }); reload()
                } catch (err: any) { setF({ ...f, avBusy: false }); showToast('头像没传上：' + String(err?.message || err).slice(0, 40)) }
              }} />
            </label>
          </div>
        </div>
        <div className="aivz" />
        <Input placeholder="昵称" value={f.nickName || ''} onChange={(e: any) => setF({ ...f, nickName: e.target.value })} />
        <div className="chips" style={{ marginTop: 6 }}>
          {['男', '女'].map((g) => <Tag key={g} color={f.gender === g ? 'app-pink' : 'app-teal'} onClick={() => setF({ ...f, gender: g })} style={{ cursor: 'pointer' }}>{g}</Tag>)}
        </div>
        <div className="aivz" />
        <Input type="password" placeholder="当前密令（修改密令时必填）" value={f.pw0 || ''} onChange={(e: any) => setF({ ...f, pw0: e.target.value })} />
        <div style={{ height: 6 }} />
        <Input type="password" placeholder="新密令（不限字数，留空则不修改）" value={f.p1 || ''} onChange={(e: any) => setF({ ...f, p1: e.target.value })} />
        <div style={{ height: 6 }} />
        <Input type="password" placeholder="再输一次新密令" value={f.p2 || ''} onChange={(e: any) => setF({ ...f, p2: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => {
            const body: any = { nickName: f.nickName, gender: f.gender }
            if ((f.p1 || '').length) {
              if (!(f.pw0 || '').length) { showToast('改密令要先输当前密令'); return }
              if (f.p1 !== f.p2) { showToast('两次密令不一样，检查一下'); return }
              body.oldPassword = f.pw0; body.password = f.p1; body.passwordConfirm = f.p2
            }
            save(async () => {
              const rec = await pb.collection('members').update(pb.authStore.record!.id, body)
              try { if (body.password) pb.authStore.save(pb.authStore.token, rec) } catch { /* 本地缓存刷新失败不影响改密结果 */ }
              if (body.password) { setF({ ...f, pw0: '', p1: '', p2: '' }); showToast('密令已更新') }
            })
          }}>保 存</Button>
        </div>
      </>}
      {kind === 'sitename' && <>
        <Input placeholder="情侣小站" value={f.siteName || ''} onChange={(e: any) => setF({ ...f, siteName: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => save(async () => {
            const s = data.setting
            if (s) await pb.collection('settings').update(s.id, { siteName: f.siteName || '情侣小站' })
            else await pb.collection('settings').create({ siteName: f.siteName || '情侣小站' })
          })}>保 存</Button>
        </div>
      </>}
      {kind === 'about' && <>
        <Input placeholder="两人称呼" value={f.names || ''} onChange={(e: any) => setF({ ...f, names: e.target.value })} />
        <Input placeholder="男孩昵称" value={f.boyName || ''} onChange={(e: any) => setF({ ...f, boyName: e.target.value })} />
        <Input placeholder="女孩昵称" value={f.girlName || ''} onChange={(e: any) => setF({ ...f, girlName: e.target.value })} />
        <Input placeholder="一句话签名" value={f.quote || ''} onChange={(e: any) => setF({ ...f, quote: e.target.value })} />
        <div className="mdate"><span>在一起的日子</span><input type="date" value={f.startDate || ''} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
        <div style={{ marginTop: 10 }}><div className="mdate-span">我们的故事</div>
          <textarea className="ta" value={f.story || ''} onChange={(e) => setF({ ...f, story: e.target.value })} /></div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => {
            const body: any = { ...f }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '')) body.startDate = dayStr(data.setting?.startDate || '')
            if (!body.startDate) { showToast('请先选择在一起的日子'); return }
            save(async () => {
              const s = data.setting
              if (s) await pb.collection('settings').update(s.id, body)
              else await pb.collection('settings').create(body)
            })
          }}>保 存</Button>
        </div>
      </>}
    </Modal>
  )
}
