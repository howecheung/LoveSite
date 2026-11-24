import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { Background, Card, Title, Button, Input, Divider } from 'animal-island-ui'
import './app.css'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
import { spring, pageVariants, tapSmall } from './motion'
import { Ic } from './Icons'
import { pb, quiet } from './core'
import { TILES, resolveTiles, PageTileMgr } from './Tiles'
import { lunarToday } from './utils'
import { today, daysSince, CountNum, Clock, buildNotices } from './shared'
import {
  TabBtn, HomeExtra, Diary, Albums, AlbumView, Wishes, Moments,
  Checkin, Msgs, Tools, About, BackupPage, More,
} from './pages'
import { ModalCard } from './modals'

// 三款游戏各自独立成包，只有进入对应页面才下载（互不共用逻辑）
const loadGomoku = () => import('./Gomoku')
const loadC4 = () => import('./Connect4')
const loadFly = () => import('./Flying')
const loadFoot = () => import('./Footprint')
const Footprint = lazy(() => loadFoot().then((m) => ({ default: m.Footprint })))
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
    if (pw.length < 1) { setErr('密令不能为空'); return }
    try { await pb.collection('members').authWithPassword(id, pw); onOK() } catch { setErr('账号或密令不对，再试试') }
  }
  return (
    <Background type="dots-pink" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      {/* 岛上飘着的云和星光 */}
      <motion.span className="lg-drift c1" animate={{ y: [0, -12, 0], x: [0, 6, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}>
        <Ic v="☁️" size={44} />
      </motion.span>
      <motion.span className="lg-drift c2" animate={{ y: [0, 10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
        <Ic v="☁️" size={26} />
      </motion.span>
      <motion.span className="lg-drift s1" animate={{ rotate: [0, 16, 0], y: [0, -6, 0] }} transition={{ duration: 6, repeat: Infinity }}>
        <Ic v="✨" size={18} />
      </motion.span>

      <motion.div className="lgwrap" initial={{ opacity: 0, y: 20, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 150, damping: 17 }}>
        <span className="lg-leaf l" />
        <span className="lg-leaf r" />
        <Card color="default" className="lgcard">
          <div className="lg-badge"><Ic v="couple" size={30} /></div>
          <div className="lg-title"><Title size="middle" color="app-pink" variant="ribbon">情侣小站</Title></div>
          <div className="lg-sub">爱是相伴，此心安处是吾乡</div>
          <div className="aifrm" style={{ marginTop: 18 }}>
            <Input placeholder="账号" value={u} onChange={(e: any) => setU(e.target.value)} />
            <Input type="password" placeholder="密令" value={p} onChange={(e: any) => setP(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter') go() }} />
            {err && <div className="lg-err">{err}</div>}
            <Button type="primary" block onClick={go}>上岛</Button>
          </div>
          <div className="lg-isle"><i /><i /><i /></div>
          <div className="lg-foot">only for us · 悄悄进来</div>
        </Card>
      </motion.div>
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
  const [rec, setRec] = useState<any>(null)
  // 打开某个弹窗；带记录时用于「编辑/删除」既有内容
  const edit = (kind: string, r?: any) => { setRec(r || null); setModal(kind) }
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
  const [imgQ, setImgQ] = useState(() => (localStorage.getItem('ai-img') === 'hd' ? 'hd' : 'lite'))
  useEffect(() => { localStorage.setItem('ai-img', imgQ) }, [imgQ])
  const noticeN = buildNotices(data, me).length
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
  // 外观模式三态：浅色 / 深色 / 跟随系统（旧的两个 key 兼容读一次）
  const [mode, setMode] = useState<'light' | 'dark' | 'auto'>(() => {
    const v = localStorage.getItem('ai-mode')
    if (v === 'light' || v === 'dark' || v === 'auto') return v
    if (localStorage.getItem('ai-night-auto') === '1') return 'auto'
    return localStorage.getItem('ai-night') === '1' ? 'dark' : 'light'
  })
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const night = mode === 'dark' || (mode === 'auto' && sysDark)
  useEffect(() => { document.body.classList.toggle('theme-island', theme === 'island'); localStorage.setItem('ai-theme', theme) }, [theme])
  useEffect(() => {
    localStorage.setItem('ai-mode', mode)
    localStorage.removeItem('ai-night')
    localStorage.removeItem('ai-night-auto')
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSysDark(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [mode])
  useEffect(() => { document.body.classList.toggle('night', night) }, [night])

  // 每日一次浏览器提醒：纪念日临近、今天还没打卡
  useEffect(() => {
    if (localStorage.getItem('ai-remind') !== '1') return
    const check = () => {
      try {
        const day = today()
        if (localStorage.getItem('ai-remind-day') === day) return
        if (!('Notification' in window) || Notification.permission !== 'granted') return
        const n = buildNotices(data, me)
        if (!n.length) return
        new Notification('情侣小站', { body: n.slice(0, 2).map((x: any) => x.t).join('；'), icon: '/icons/icon-192.png' })
        localStorage.setItem('ai-remind-day', day)
      } catch { /* 浏览器不支持时静默跳过 */ }
    }
    const t = setInterval(check, 30 * 60000)
    const s = setTimeout(check, 6000)
    return () => { clearInterval(t); clearTimeout(s) }
  }, [data, me])

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

        <div className="main" style={route === 'footprint' ? { paddingBottom: 18 } : undefined}>
          <div className="hrow">
            {!MAINR.includes(route) && <motion.button {...tapSmall} className="backbtn" onClick={back}><Ic v="arrowL" size={14} /> 返回</motion.button>}
            {route === 'home' && <span className="dchip" onClick={() => go('home')}><Ic v="❤️" size={11} w="fill" /> 第 {data.setting ? daysSince(data.setting.startDate) : 0} 天</span>}
            <div className="htitle">{route === 'home' ? (data.setting?.siteName || '情侣小站') : ({ backup: '数据备份', more: '更多', tilemgr: '功能卡片', footprint: '足迹地图', c4: '四子棋', 'c4-play': '四子棋 · 对局', fly: '情侣飞行棋', 'fly-play': '飞行棋 · 对局', 'fly-local': '飞行棋 · 同屏', games: '小游戏', gomoku: '五子棋', 'gomoku-play': '五子棋 · 对局', 'gomoku-local': '五子棋 · 同屏', 'album-view': '相册' } as any)[route] || (TILES.find((t) => t.k === route)?.t || '')}</div>
            <div className="hacts">
              <button className="hbtn" onClick={() => setModal('search')}><Ic v="🔍" size={16} /></button>
              <button className="hbtn" title="足迹地图" onClick={() => go('footprint')}><Ic v="👣" size={16} /></button>
              <button className="hbtn" onClick={() => setModal('notice')} title="提醒">
                <Ic v="🔔" size={16} />
                {noticeN > 0 && <i className="dotn">{noticeN > 9 ? '9+' : noticeN}</i>}
              </button>
              <button className="hbtn" onClick={() => setMode(night ? 'light' : 'dark')}>{night ? <Ic v="🌙" size={16} /> : <Ic v="☀️" size={16} />}</button>
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
              {!data.diaries.length && !data.albums.length && !data.moments.length && !data.wishes.length && (
                <Card color="app-yellow" className="blk">
                  <Title size="small" variant="tab">三步点亮小岛</Title>
                  <div className="li" onClick={() => setModal('about')} style={{ cursor: 'pointer' }}><span className="dot"><Ic v="1️⃣" /></span><span className="grow"><b>写下名字和开始日期</b><div className="mut">首页的天数、昵称都来自这里</div></span><span className="mut">›</span></div>
                  <div className="li" onClick={() => setModal('album')} style={{ cursor: 'pointer' }}><span className="dot"><Ic v="2️⃣" /></span><span className="grow"><b>建第一本相册</b><div className="mut">照片可以多选，建好还能继续加</div></span><span className="mut">›</span></div>
                  <div className="li" onClick={() => setModal('diary')} style={{ cursor: 'pointer' }}><span className="dot"><Ic v="3️⃣" /></span><span className="grow"><b>写第一篇日常</b><div className="mut">可上锁，只有你们能看到</div></span><span className="mut">›</span></div>
                </Card>
              )}
            </>
          )}

          {route === 'diary' && <Diary data={data} reload={load} onAdd={() => setModal('diary')} onEdit={edit} me={me} unlocked={unlocked} askLock={() => setModal('lockIn')} />}
          {route === 'album' && <Albums data={data} reload={load} onAdd={() => setModal('album')} go={go} grid={agrid} setGrid={setAgrid} />}
          {route === 'promise' && <Wishes data={data} reload={load} onAdd={() => setModal('wish')} onEdit={edit} />}
          {route === 'countdown' && <Moments data={data} reload={load} onAdd={() => setModal('moment')} onEdit={edit} />}
          {route === 'checkin' && <Checkin data={data} reload={load} me={me.nickName || me.username || '我'} onAdd={() => setModal('checkin')} onEdit={edit} />}
          {route === 'message' && <Msgs data={data} reload={load} me={me.nickName || me.username || '我'} myId={me.id} onEdit={edit} />}
          {route === 'tools' && <Tools data={data} reload={load} />}
          {route === 'backup' && <BackupPage reload={load} />}
          {route === 'about' && <About data={data} />}
          {route === 'more' && <More data={data} onOut={onOut} setModal={setModal} me={me} go={go} mode={mode} theme={theme} setTheme={setTheme} imgQ={imgQ} setImgQ={setImgQ} />}
          {route === 'games' && <Games go={go} />}
          {route === 'footprint' && <Footprint data={data} />}
          {route === 'tilemgr' && <PageTileMgr data={data} />}
          {route === 'album-view' && <AlbumView id={ctx} data={data} reload={load} go={go} onEdit={edit} />}
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

      {/* 足迹页是沉浸式地图，底部导航会压住地图下沿，这里直接不渲染 */}
      {route !== 'footprint' && <div className="tabbar desk-hide">
        {NAV.filter(n=>n.k==='home'||n.k==='diary').map((n) => <TabBtn key={n.k} n={n} on={route === n.k} go={go} />)}
        <button className="plus" onClick={() => setModal('diary')}><Ic v="➕" size={26} w="fill" /></button>
        {NAV.filter(n=>n.k==='album'||n.k==='more').map((n) => <TabBtn key={n.k} n={n} on={route === n.k} go={go} />)}
      </div>}

      {modal && <ModalCard kind={modal} rec={rec} data={data} me={me} close={() => { setModal(null); setRec(null) }} reload={load} go={go} setUnlocked={setUnlocked} mode={mode} setMode={setMode} />}
    </Background>
    </MotionConfig>
  )
}

