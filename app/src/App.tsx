import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { Background, Card, Title, Button, Input, Divider } from 'animal-island-ui'
import './app.css'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
import { spring, pageVariants, tapSmall } from './motion'
import { Ic } from './Icons'
import { pb, quiet } from './core'
import { TILES, resolveTiles, PageTileMgr } from './Tiles'
import { lunarToday } from './utils'
import { today, daysSince, CountNum, Clock } from './shared'
import {
  TabBtn, HomeExtra, Diary, Albums, AlbumView, Wishes, Moments,
  Checkin, Msgs, Tools, About, BackupPage, More,
} from './pages'
import { ModalCard } from './modals'

// 三款游戏各自独立成包，只有进入对应页面才下载（互不共用逻辑）
const loadGomoku = () => import('./Gomoku')
const loadC4 = () => import('./Connect4')
const loadFly = () => import('./Flying')
const Games = lazy(() => loadGomoku().then((m) => ({ default: m.Games })))
const GomokuHome = lazy(() => loadGomoku().then((m) => ({ default: m.GomokuHome })))
const GomokuLive = lazy(() => loadGomoku().then((m) => ({ default: m.GomokuLive })))
const GomokuLocal = lazy(() => loadGomoku().then((m) => ({ default: m.GomokuLocal })))
const C4Home = lazy(() => loadC4().then((m) => ({ default: m.C4Home })))
const C4Live = lazy(() => loadC4().then((m) => ({ default: m.C4Live })))
const FlyHome = lazy(() => loadFly().then((m) => ({ default: m.FlyHome })))
const FlyLive = lazy(() => loadFly().then((m) => ({ default: m.FlyLive })))
const FlyLocal = lazy(() => loadFly().then((m) => ({ default: m.FlyLocal })))
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
function Login({ onOK }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState('')
  const go = async () => {
    setErr('')
    const id = u.trim(), pw = p.trim()
    if (!id || !pw) { setErr('账号和密令都要填'); return }
    if (pw.length < 8) { setErr('密令至少 8 位（PocketBase 密码下限）'); return }
    try { await pb.collection('members').authWithPassword(id, pw); onOK() } catch { setErr('账号或密令不对，再试试') }
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
          <Input placeholder="账号（如 zwh / mm）" value={u} onChange={(e: any) => setU(e.target.value)} />
          <Input type="password" placeholder="密令（至少 8 位）" value={p} onChange={(e: any) => setP(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter') go() }} />
          {err && <div style={{ color: '#d0455f', fontSize: 13 }}>{err}</div>}
          <Button type="primary" block onClick={go}>进入小站</Button>
        </div>
      </Card>
    </Background>
  )
}

function Site({ onOut }: any) {
  const [me, setMe] = useState<any>(pb.authStore.record || {})
  const [route, setRoute] = useState('home')
  const [loaded, setLoaded] = useState(false)
  const [data, setData] = useState<any>({ setting: null, diaries: [], albums: [], moments: [], wishes: [], messages: [], checkins: [], ckrecords: [], comments: [] })
  const [unlocked, setUnlocked] = useState(!!sessionStorage.getItem('lk'))
  useEffect(() => { const t = setInterval(() => { const v = !!sessionStorage.getItem('lk'); setUnlocked((o) => (o === v ? o : v)) }, 900); return () => clearInterval(t) }, [])
  const [modal, setModal] = useState<string | null>(null)
  const busy = useRef(false)
  const pending = useRef(false)

  const load = useCallback(async function run() {
    if (busy.current) { pending.current = true; return }
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
    } finally {
      busy.current = false
      setMe(pb.authStore.record || {})
      setLoaded(true)
      // 加载期间又来新变更：等这次结束后补跑一次，避免 busy 丢最后一次更新
      if (pending.current) { pending.current = false; setTimeout(run, 0) }
    }
  }, [])

  useEffect(() => {
    load()
    const cols = ['diaries', 'albums', 'moments', 'wishes', 'messages', 'checkins', 'ckrecords', 'settings', 'comments']
    let t: any = null
    const h = () => { clearTimeout(t); t = setTimeout(load, 250) }   // 250ms 内多次变更合并成一次刷新
    cols.forEach((c) => pb.collection(c).subscribe('*', h).catch(quiet))
    return () => { clearTimeout(t); cols.forEach((c) => pb.collection(c).unsubscribe('*').catch(quiet)) }
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
          <Suspense fallback={<div className="mut-row risein">小岛正在开门…</div>}>
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
          </Suspense>
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

