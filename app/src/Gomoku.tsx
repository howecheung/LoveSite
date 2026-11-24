// 五子棋：大厅（单棋室+房号）、联机对局（带色棋谱、悔棋退一手、续战）、同屏离线模式
// 与主站解耦：数据走 PocketBase gmk/gmkr 集合，实时靠 SDK subscribe + 心跳 bSeen/wSeen
import { useEffect, useRef, useState } from 'react'
import { Card, Title, Button, Tag } from 'animal-island-ui'
import { motion } from 'motion/react'
import { tapSmall } from './motion'
import { Ic } from './Icons'
import { pb, quiet, showToast } from './core'
const GN = 15
const CONF = ['#ff9ec4', '#ffd76e', '#9ad9a0', '#9ecbff', '#d1b3ff']
const HIST_KEY = 'gomoku_hist'
const loadHist = (): any[] => { try { const v = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const pushHist = (rec: any) => { localStorage.setItem(HIST_KEY, JSON.stringify([rec, ...loadHist()].slice(0, 100))) }

function Games({ go }: any) {
  const rows = [
    { ic: 'gomoku', t: '五子棋', s: '跨设备联机 · 实时对战 · 同屏模式', k: 'gomoku', on: true },
    { ic: '🍬', t: '四子棋', s: '糖果对弈 · 跨设备联机 · 四连即胜', k: 'c4', on: true },
    { ic: '✈️', t: '情侣飞行棋', s: '掷骰走格 · 情侣任务 · 联机+同屏', k: 'fly', on: true },
    { ic: '🧩', t: '记忆翻牌', s: '敬请期待', k: '', on: false },
    { ic: '🃏', t: '24 点对战', s: '敬请期待', k: '', on: false },
  ]
  return (
    <Card color="app-teal" className="blk"><Title size="small" variant="tab">游戏厅</Title>
      {rows.map((r2) => (
        <div key={r2.t} className={'li' + (r2.on ? '' : ' dis')} onClick={() => r2.on && go(r2.k)}>
          <span className="dot"><Ic v={r2.ic} size={18} /></span>
          <span className="grow"><b>{r2.t}</b><div className="mut">{r2.s}</div></span>
          {r2.on ? <span className="mut">›</span> : <Tag size="small" color="app-yellow">开发中</Tag>}
        </div>
      ))}
    </Card>
  )
}

function GomokuHome({ go, me }: any) {
  const [games, setGames] = useState<any[]>([])
  const [hist, setHist] = useState<any[]>([])
  const [jc, setJc] = useState('')
  const [recOpen, setRecOpen] = useState(false)
  const myName = me?.nickName || me?.username || '我'
  const pushHistLocal = (rs: any[]) => { try { localStorage.setItem(HIST_KEY, JSON.stringify(rs.map((r) => ({
    t: new Date(r.created).getTime(), w: r.winner === 'draw' ? 3 : (r.winner === 'black' ? 1 : 2), mv: r.mv, dur: r.dur, bn: r.bn, wn: r.wn })))) } catch { /* ignore */ } }
  const load = () => {
    pb.collection('gmk').getFullList({ sort: '-created', filter: "winner = ''" }).then(setGames).catch(quiet)
    pb.collection('gmkr').getFullList({ sort: '-created', filter: "winner != ''" }).then((rs) => { setHist(rs); pushHistLocal(rs) }).catch(quiet)
  }
  useEffect(() => { load()
    pb.collection('gmk').subscribe('*', () => load()).catch(quiet)
    return () => { pb.collection('gmk').unsubscribe('*').catch(() => {}) }
  }, [])
  const live = games.filter((x) => x.winner === '')
  const mine = live.find((x) => x.black === me.id || x.white === me.id)
  const joinable = live.filter((x) => x.black !== me.id && x.white !== me.id && (!x.black || !x.white))
  const create = async () => { try {
    // 两人站只有一个棋室：现场查库（不信可能未加载完的列表）→ 有 unfinished 先进自己的 → 再进有空位的 → 都没有才新建
    const openG: any[] = await pb.collection('gmk').getFullList({ sort: '-created', filter: "winner = ''" }).catch(() => [])
    const myG = openG.find((x) => x.black === me.id || x.white === me.id)
    if (myG) return go('gomoku-play', myG.id, true)
    const empty = openG.find((x) => !x.black || !x.white)
    if (empty) return join(empty)
    const r = await pb.collection('gmk').create({ black: me.id, bnm: myName, moves: '', state: 'lobby', winner: '', prop: '', propBy: '', bSeen: Date.now(), wSeen: 0, code: newCode() })
    // 双端同时点开局会各建一局：再查一次，保留最早的空位局，自己多建的那局删掉并入
    const again: any[] = await pb.collection('gmk').getFullList({ sort: 'created', filter: "winner = ''" }).catch(() => [])
    const first = again[0]
    if (first && first.id !== r.id && (!first.black || !first.white)) {
      await pb.collection('gmk').delete(r.id).catch(() => {})
      return join(first)
    }
    go('gomoku-play', r.id, true)
  } catch (e) { quiet(e) } }
  const join = async (gm: any) => { try {
    const seat = gm.black ? 'white' : 'black'
    await pb.collection('gmk').update(gm.id, seat === 'white'
      ? { white: me.id, wnm: myName, state: 'live', start: Date.now(), wSeen: Date.now() }
      : { black: me.id, bnm: myName, state: 'live', start: Date.now(), bSeen: Date.now() })
    go('gomoku-play', gm.id, true)
  } catch (e) { quiet(e) } }
  const joinByCode = async () => {
    const code = jc.trim()
    if (!/^\d{4}$/.test(code)) { showToast('房号是 4 位数字哦'); return }
    try {
      const rs: any[] = await pb.collection('gmk').getFullList({ filter: `code = '${code}' && winner = ''` })
      const g = rs[0]
      if (!g) { showToast(`找不到 ${code} 号房`); return }
      if (g.black === me.id || g.white === me.id) { go('gomoku-play', g.id, true); return }
      if (g.black && g.white) { showToast(`${code} 号房已经坐满啦`); return }
      join(g)
    } catch (e) { quiet(e) }
  }
  const isToday = (t: number) => new Date(t).toDateString() === new Date().toDateString()
  const isMine = (x: any) => (x.bid || x.wid) ? (x.bid === me.id || x.wid === me.id) : (x.bn === myName || x.wn === myName)
  const rate = (arr: any[]) => {
    const played = arr.filter((x) => x.winner !== 'draw').length
    const won = arr.filter((x) => x.winner !== 'draw' && (x.winner === 'black' ? x.bid === me.id || (!x.bid && x.bn === myName) : x.wid === me.id || (!x.wid && x.wn === myName))).length
    return played ? Math.round((won / played) * 100) : null
  }
  const td = hist.filter((x) => isToday(new Date(x.created).getTime()))
  const mine2 = hist.filter(isMine)
  const td2 = td.filter((x) => x.bn === myName || x.wn === myName)
  const wr = (label: string, arr: any[]) => <div className="wr"><span className="wn">{label}</span>
    <b className="wB">{rate(arr) === null ? '—' : rate(arr) + '%'}</b><span className="mut">{arr.length} 局</span></div>
  return (
    <>
      {!!mine && <Card className="blk" style={{ textAlign: 'center', padding: '18px 14px' }}>
        <div className="gmk-title">进行中的对局</div>
        <div className="mut" style={{ margin: '6px 0 12px' }}>{mine.code ? mine.code + ' 号房 · ' : ''}对手 {(mine.black === me.id ? mine.wnm : mine.bnm) || '等待中就位'} · {mine.state === 'live' ? ((mine.moves ? mine.moves.split(',').filter(Boolean).length : 0) + 1) + ' 手进行中' : '等待就位'}</div>
        <motion.button {...tapSmall} className="gmk-hero" onClick={() => go('gomoku-play', mine.id)}>继续对局 ›</motion.button>
      </Card>}
      <Card className="blk" style={{ textAlign: 'center', padding: '20px 14px' }}>
        <div style={{ color: 'var(--accent)', display: 'flex', justifyContent: 'center' }}><Ic v="gomoku" size={46} /></div>
        <div className="gmk-title" style={{ margin: '8px 0 2px' }}>线上对战</div>
        <div className="mut" style={{ margin: '2px 0 14px' }}>黑先白后 · 交叉点落子 · 两台设备实时对弈，中途离开可回来续战</div>
        <Button type="primary" block onClick={create}><Ic v="➕" size={15} /> 进入棋室</Button>
        {!!joinable.length && <div style={{ marginTop: 10 }}>
          {joinable.map((x) => (
            <div key={x.id} className="li" style={{ textAlign: 'left' }} onClick={() => join(x)}>
              <span className="dot"><Ic v="gomoku" size={16} /></span>
              <span className="grow"><b>{x.code ? x.code + ' 号房 · ' : ''}{x.bnm || x.wnm} 的棋室</b><div className="mut">虚位以待 · 你执{x.black ? "白" : "黑"}</div></span>
              <Tag size="small" color="app-pink">加入</Tag>
            </div>))}
        </div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, textAlign: 'left' }}>
          <input className="in" style={{ flex: 1 }} inputMode="numeric" maxLength={4} placeholder="输入 4 位房号加入"
            value={jc} onChange={(e: any) => setJc(e.target.value)} />
          <Button size="small" type="primary" onClick={joinByCode}>加入</Button>
        </div>
        <div style={{ marginTop: 12 }}><Button size="small" ghost onClick={() => { localStorage.removeItem('gomoku'); go('gomoku-local') }}>同屏一人执一子（离线模式）</Button></div>
      </Card>
      <Card className="blk"><Title size="small" variant="tab">胜率</Title>
        {wr('今日', td2)}
        {wr('总', mine2)}
        <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>{mine2.length ? `以「${myName}」名义合计 ${mine2.length} 局` : '还没有战绩，开一局吧'}</div>
      </Card>
      <Card className="blk"><Title size="small" variant="tab">对局记录</Title>
        {(recOpen ? hist : hist.slice(0, 3)).map((x) => (
          <div key={x.id} className="li" style={{ padding: '8px 2px' }}>
            <span className="dot"><Ic v={x.winner === 'draw' ? '🤝' : x.winner === 'black' ? '⚫' : '⚪'} size={15} /></span>
            <span className="grow"><b>{x.winner === 'draw' ? '平局' : (x.winner === 'black' ? x.bn : x.wn) + ' 胜'}</b>
              <div className="mut">{new Date(x.created).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {x.mv || '—'} 手 · {x.dur ? Math.max(1, Math.round(x.dur / 60)) + ' 分钟' : '—'} · {x.bn} vs {x.wn}</div></span>
          </div>))}
        {!hist.length && <div className="mut" style={{ padding: '6px 2px' }}>暂无记录</div>}
        {hist.length > 3 && <Button size="small" ghost block style={{ marginTop: 6 }} onClick={() => setRecOpen(!recOpen)}>{recOpen ? '收起 ▲' : `查看全部 ${hist.length} 局 ▼`}</Button>}
      </Card>
    </>
  )
}

type Mv = { i: number, c: number }
const parseMv = (mv: string): Mv[] => (mv ? mv.split(',').filter(Boolean) : []).map((x, k) => {
  const [i, c] = x.split(':').map(Number)
  return { i, c: c > 0 ? c : (k % 2) + 1 } })
const boardOf = (mv: string) => { const b = Array(GN * GN).fill(0)
  parseMv(mv).forEach((m) => { if (m.i >= 0 && m.i < GN * GN) b[m.i] = m.c })
  return b }
const mvTxt = (arr: Mv[]) => arr.map((m) => `${m.i}:${m.c}`).join(',')
const newCode = () => String(1000 + Math.floor(Math.random() * 9000))
function GomokuLive({ id, go, me }: any) {
  const [g, setG] = useState<any>(null)
  const [, setNow] = useState(0)
  const recorded = useRef('')
  const [fxOn, setFxOn] = useState(false)
  useEffect(() => { let alive = true
    const refetch = () => { pb.collection('gmk').getOne(id).then((r) => { if (alive) setG(r) }).catch(() => {}) }
    refetch()
    pb.collection('gmk').subscribe(id, (e) => setG(e.record)).catch(quiet)
    const onBack = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => { alive = false; clearInterval(t);
      document.removeEventListener('visibilitychange', onBack); window.removeEventListener('focus', onBack)
      pb.collection('gmk').unsubscribe(id).catch(() => {}) }
  }, [id])
  const seat = !g ? '' : g.black === me.id ? 'black' : g.white === me.id ? 'white' : 'watch'
  useEffect(() => { if (!g || seat === 'watch' || seat === '' || g.winner) return
    const t = setInterval(() => { fetch(`/api/collections/gmk/records/${g.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token as string },
      body: JSON.stringify({ [seat === 'black' ? 'bSeen' : 'wSeen']: Date.now() }) }).catch(() => {}) }, 10000)
    return () => clearInterval(t)
  }, [g?.id, seat, g?.winner])
  useEffect(() => {
    if (!g?.winner) { setFxOn(false); return }
    setFxOn(true)
    const t = setTimeout(() => setFxOn(false), 4200)
    return () => clearTimeout(t)
  }, [g?.winner, g?.moves])
  const myName = me?.nickName || me?.username || '我'
  useEffect(() => { if (!g || !g.winner) return
    const gk = `${g.id}#${g.round || 1}`
    if (recorded.current === gk) return
    recorded.current = gk
    pb.collection('gmkr').getFullList({ filter: `game="${gk}"` }).then((l) => { if (!l.length)
      pb.collection('gmkr').create({ game: gk, winner: g.winner, bn: g.bnm, wn: g.wnm, bId: g.black, wId: g.white,
        mv: parseMv(g.moves || '').length, dur: g.dur || 0 }).catch(quiet)
    }).then(() => pb.collection('gmkr').getList(1, 200, { sort: '-created', fields: 'id' }))
      .then((pg) => { pg.items.slice(100).forEach((x: any) => pb.collection('gmkr').delete(x.id).catch(() => {})) }).catch(quiet)
  }, [g?.winner])
  const patch = async (body: any) => { try {
    const r = await fetch(`/api/collections/gmk/records/${g.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token as string, 'If-Match': g.updated },
      body: JSON.stringify(body) })
    if (r.status === 412) { const cur = await pb.collection('gmk').getOne(g.id).catch(() => null); if (cur) setG(cur); return }
    if (!r.ok) throw new Error('HTTP ' + r.status)
  } catch (e) { quiet(e) } }
  const winAt = (bd: number[], i: number) => { const r0 = Math.floor(i / GN), c0 = i % GN, who = bd[i]
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const cells = [i]
      for (const sg of [1, -1]) for (let k = 1; k < 5; k++) { const r = r0 + dr * k * sg, c = c0 + dc * k * sg
        if (r < 0 || c < 0 || r >= GN || c >= GN || bd[r * GN + c] !== who) break
        cells.push(r * GN + c) }
      if (cells.length >= 5) return cells }
    return null }
  const b = g ? boardOf(g.moves || '') : Array(GN * GN).fill(0)
  const mvArr: Mv[] = g ? parseMv(g.moves || '') : []
  const lastC = mvArr.length ? mvArr[mvArr.length - 1].c : 0
  const turnSeat = !lastC ? 'black' : lastC === 1 ? 'white' : 'black'
  const last = mvArr.length ? mvArr[mvArr.length - 1].i : -1
  const bothIn = g && g.black && g.white
  const winCells = g && g.winner && g.winner !== 'draw' && last >= 0 ? winAt(b, last) : null
  const oppSeatName = seat === 'black' ? g?.wnm : g?.bnm
  const oppSeen = seat === 'black' ? g?.wSeen : g?.bSeen
  const oppOnline = !!oppSeen && (Date.now() - oppSeen) < 32000
  const play = (i: number) => {
    if (!g || g.winner || g.state !== 'live' || seat !== turnSeat || b[i] || !bothIn) return
    const myc = seat === 'black' ? 1 : 2
    const arr: Mv[] = [...mvArr, { i, c: myc }]
    const nb = boardOf(mvTxt(arr))
    const wl = winAt(nb, i); const full = nb.every((x: number) => x)
    const winColor = myc === 1 ? 'black' : 'white'
    if (navigator.vibrate) navigator.vibrate(wl ? [30, 40, 80] : 12)
    patch({ moves: mvTxt(arr), ...(wl || full ? { winner: wl ? winColor : 'draw', state: 'done', dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) } : {}) })
  }
  const undo = (extra: any = {}) => {
    // 只悔发起方自己的最后一颗（TA 应过的保留）
    const c0 = g.propBy === 'white' || (extra.by === 'white') ? 2 : 1
    let k = mvArr.length - 1
    while (k >= 0 && mvArr[k].c !== c0) k--
    if (k < 0) { patch({ prop: '', propBy: '', ...extra }); return }
    const arr = mvArr.slice(0, k).concat(mvArr.slice(k + 1))
    patch({ moves: mvTxt(arr), prop: '', propBy: '', ...extra })
  }
  const ask = (what: string) => patch({ prop: what, propBy: seat })
  const answer = (ok: boolean) => { if (!ok) { patch({ prop: '', propBy: '' }); return }
    if (g.prop === 'undo') undo()
    else patch({ winner: 'draw', state: 'done', prop: '', propBy: '', dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) }) }
  const resign = () => patch({ winner: seat === 'black' ? 'white' : 'black', state: 'done', dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) })
  const rematch = () => patch({ moves: '', winner: '', state: 'live', prop: '', propBy: '', start: Date.now(), dur: 0, round: (g.round || 1) + 1 })
  const swap = () => patch({ black: g.white, white: g.black, bnm: g.wnm, wnm: g.bnm, moves: '', winner: '', state: 'live', prop: '', propBy: '', start: Date.now(), dur: 0 })
  const takeSeat = (want: string) => patch(want === 'black'
    ? { black: me.id, bnm: myName, white: '', wnm: '', bSeen: Date.now(), state: 'lobby' }
    : { white: me.id, wnm: myName, black: '', bnm: '', wSeen: Date.now(), state: 'lobby' })
  if (!g) return <Card className="blk gmk-box"><div className="mut-row">棋盘铺好之前，先等一下…</div></Card>
  const iWin = !!g.winner && g.winner === seat
  const winLineTxt = g.winner === 'draw' ? '平局 · 棋逢对手'
    : g.winner ? ((g.winner === 'black' ? g.bnm : g.wnm) || '') + ' 五连获胜' : ''
  const statusTxt = g.winner ? winLineTxt
    : !bothIn ? '等待对方就位…'
    : seat === 'watch' ? '观战模式 · 你未占座'
    : g.state !== 'live' ? '就位后对方加入即开局'
    : seat === turnSeat ? `第 ${mvArr.length + 1} 手 · 轮你落子`
    : oppOnline ? `第 ${mvArr.length + 1} 手 · ${oppSeatName || '对方'} 思考中…` : `第 ${mvArr.length + 1} 手 · 对方暂时离开，落子会同步`
  return (
    <Card className="blk gmk-box">
      {!!g.code && <div className="mut" style={{ textAlign: 'center', fontSize: 11.5, marginBottom: 6 }}>房间号 <b style={{ color: 'var(--accent-ink)', letterSpacing: 2 }}>{g.code}</b> · <span className="cp" onClick={() => { navigator.clipboard?.writeText(String(g.code)).then(() => showToast('房号已复制')).catch(() => showToast('复制失败，手动选一下')) }}>复制</span></div>}
      <div className="pvp">
        {(['black', 'white'] as const).map((sk) => {
          const name2 = sk === 'black' ? g.bnm : g.wnm
          const occ = sk === 'black' ? g.black : g.white
          const seen = sk === 'black' ? g.bSeen : g.wSeen
          const isMe = occ === me.id
          const online = isMe || (!!occ && Date.now() - (seen || 0) < 32000)
          return <div key={sk} className={'pl' + (!g.winner && g.state === 'live' && turnSeat === sk ? ' now' : '') + (occ && !online && g.state === 'live' && !g.winner ? ' off' : '')}>
            <i className={'pvdot ' + (sk === 'black' ? 'dotB' : 'dotW')} />
            <div className="grow"><div className="nm">{name2 || (sk === 'black' ? '黑方空位' : '白方空位')}{isMe ? '（你）' : ''}</div>
              <div className="st">{occ ? (online ? '● 在线' : '○ 离线') : '等待加入'} · {sk === 'black' ? '先手' : '后手'}</div></div>
          </div> })}
      </div>
      {g.state === 'lobby' && !g.winner && (
        <div className="gmk-wait">
          {seat === 'watch' || !seat ? <>
            <div className="pulse" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)', margin: '6px 0 10px' }}>这局棋室还缺一位棋手</div>
            <div style={{ marginBottom: 8 }}><Button size="small" type="primary" onClick={() => takeSeat(g.black ? 'white' : 'black')}>执{g.black ? '白（后手）' : '黑（先手）'}加入</Button></div></>
            : <>
            <div className="pulse" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)', margin: '6px 0 10px' }}>⏳ {g.code ? g.code + ' 号房等待加入' : '等待对方加入'} · TA 可在大厅点这局或输入房号</div>
            <div className="mut" style={{ marginBottom: 10 }}>你已占座，开局前还能换：</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button size="small" type="primary" ghost={seat !== 'black'} onClick={() => takeSeat('black')}>执黑 · 先</Button>
              <Button size="small" type="primary" ghost={seat !== 'white'} onClick={() => takeSeat('white')}>执白 · 后</Button>
            </div></>}
        </div>)}
      <div className={'goban' + (winCells ? ' winning' : '')}><div className="gwrap"><div className="ggrid">
        {b.map((x: number, i: number) => (
          <span key={i} className={'gc' + (x ? ' st' + x : '') + (i === last ? ' last' : '') + (winCells && winCells.includes(i) ? ' win' : '')} onClick={() => play(i)}>
            {!!x && <motion.i initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 16 }} />}</span>))}
      </div></div>
        {!!g.winner && fxOn && <div className="winfx" onClick={() => setFxOn(false)}>
          <div className="wcard">
            <div className="wtrophy"><Ic v={g.winner === 'draw' ? 'handshake' : 'trophy'} size={64} /></div>
            <div className="wtxt">{g.winner === 'draw' ? '平局！' : iWin ? '你赢啦！' : '对方获胜'}</div>
            <div className="wsub">{g.winner === 'draw' ? '棋逢对手 · 再战一局' : (g.winner === 'black' ? g.bnm : g.wnm) + ' 五连达成'}</div>
          </div>
          {Array.from({ length: 26 }).map((_, k) => (
            <i key={k} className="conf" style={{ left: (k * 3.84 + 1.5) + '%', background: CONF[k % 5],
              animationDelay: ((k % 6) * 0.32) + 's', animationDuration: (1.9 + (k % 5) * 0.3) + 's' }} />))}
        </div>}
      </div>
      {!!g.prop && g.propBy && g.propBy !== seat && !g.winner && seat !== 'watch' &&
        <div className="propbar"><span className="grow">{(g.propBy === 'black' ? g.bnm : g.wnm)} 请求{g.prop === 'undo' ? '悔棋' : '和棋'}</span>
          <Button size="small" type="primary" onClick={() => answer(true)}>同意</Button>
          <Button size="small" ghost onClick={() => answer(false)}>拒绝</Button></div>}
      {!!g.prop && g.propBy === seat && !g.winner &&
        <div className="propbar"><span className="grow">已发出{g.prop === 'undo' ? '悔棋' : '和棋'}请求，等待对方回应…</span>
          <Button size="small" ghost onClick={() => patch({ prop: '', propBy: '' })}>取消</Button></div>}
      <div className="gfoot">
        {g.winner ? <>
          <span style={{ display: 'flex', gap: 6 }}>
            <Button size="small" type="primary" onClick={rematch}>再来一局</Button>
            <Button size="small" ghost onClick={swap}>换色</Button></span>
          <span className="mut" style={{ textAlign: 'center', fontSize: 12 }}>{iWin ? <><Ic v="trophy" size={13} /> 赢啦！</> : g.winner === 'draw' ? <Ic v="handshake" size={13} /> : '差一点'} {winLineTxt}{g.dur ? ' · ' + Math.max(1, Math.round(g.dur / 60)) + ' 分钟' : ''} · {mvArr.length} 手</span>
          <Button size="small" ghost onClick={() => go('gomoku', undefined, true)}>回大厅</Button></>
          : seat !== 'watch' && seat && bothIn && g.state === 'live' ? <>
          <Button size="small" ghost onClick={() => ask('undo')} disabled={mvArr.length < 2}>悔棋</Button>
          <span className="mut" style={{ textAlign: 'center' }}>{statusTxt}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <Button size="small" ghost onClick={() => ask('draw')}>和棋</Button>
            <Button size="small" ghost onClick={resign}>认输</Button></span></>
          : <span className="mut" style={{ textAlign: 'center', flex: 1 }}>{statusTxt}</span>}
      </div>
      <div className="gmk-hint">离开也不怕 · 回来自动续战 · 两台设备连同一网络即可实时对弈</div>
    </Card>
  )
}

function GomokuLocal({ data, go }: any) {  const load = (): any => { try { const v = JSON.parse(localStorage.getItem('gomoku') || ''); return Array.isArray(v?.b) && v.b.length === GN * GN ? v : null } catch { return null } }
  const fresh = () => ({ b: Array(GN * GN).fill(0), turn: 1, win: 0, hist: [] as number[], start: Date.now() })
  const [g, setG] = useState<any>(load() || fresh())
  const names = [data?.setting?.boyName || '男孩', data?.setting?.girlName || '女孩']
  const save = (v: any) => { localStorage.setItem('gomoku', JSON.stringify(v)); setG(v) }
  const winLine = (b: number[], i: number) => {
    const r0 = Math.floor(i / GN), c0 = i % GN, who = b[i]
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [i]
      for (const sg of [1, -1]) for (let k = 1; k < 5; k++) {
        const r = r0 + dr * k * sg, c = c0 + dc * k * sg
        if (r < 0 || c < 0 || r >= GN || c >= GN || b[r * GN + c] !== who) break
        cells.push(r * GN + c)
      }
      if (cells.length >= 5) return cells
    }
    return null
  }
  const play = (i: number) => {
    if (g.win || g.b[i]) return
    const b = g.b.slice(); b[i] = g.turn
    const h = [...(g.hist || []), i]
    const wl = winLine(b, i)
    const full = b.every((x: number) => x)
    let rec = null
    if (wl) rec = { t: Date.now(), w: g.turn, mv: h.length, dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) }
    else if (full) rec = { t: Date.now(), w: 3, mv: h.length, dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) }
    if (rec) pushHist(rec)
    if (rec) { const gk = 'local-' + Date.now().toString(36)
      pb.collection('gmkr').create({ game: gk, winner: rec.w === 3 ? 'draw' : rec.w === 1 ? 'black' : 'white',
        bn: names[0], wn: names[1], mv: rec.mv, dur: rec.dur }).catch(() => {}) }
    if (rec && navigator.vibrate) navigator.vibrate(rec.w === 3 ? [40, 60, 40] : [30, 40, 80])
    save({ ...g, b, hist: h, turn: g.turn === 1 ? 2 : 1, win: wl ? g.turn : full ? 3 : 0 })
  }
  const undo = () => {
    const h = (g.hist || []).slice()
    if (!h.length) return
    const i = h.pop()
    const c = g.b[i]
    const b = g.b.slice(); b[i] = 0
    save({ ...g, b, turn: c, win: 0, hist: h })
  }
  const reset = () => save(fresh())
  const last = (g.hist || []).length ? g.hist[g.hist.length - 1] : -1
  const winnerName = g.win === 1 ? names[0] : g.win === 2 ? names[1] : ''
  return (
    <>
      <Card color="app-yellow" className="blk gomoku-box">
        <div className="gbar">
          <span className={g.turn === 1 && !g.win ? 'chip now' : 'chip'}><i className="dotB" />{names[0]} 执黑</span>
          <span className={g.turn === 2 && !g.win ? 'chip now' : 'chip'}><i className="dotW" />{names[1]} 执白</span>
        </div>
        <div className="goban"><div className="gwrap"><div className="ggrid">
          {g.b.map((x: number, i: number) => (
            <span key={i} className={'gc' + (x ? ' st' + x : '') + (i === last ? ' last' : '')} onClick={() => play(i)}>
              {!!x && <motion.i initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 16 }} />}
            </span>
          ))}
        </div></div></div>
        <div className="gfoot">
          <Button size="small" ghost onClick={undo}>悔棋</Button>
          <span className="mut">{g.win ? (g.win === 3 ? '🤝 平局！' : '🎉 ' + winnerName + ' 五连获胜！') : ((g.hist || []).length + 1) + ' 手 · 轮到 ' + (g.turn === 1 ? names[0] + '（黑）' : names[1] + '（白）')}</span>
          <Button size="small" type="primary" ghost={!g.win} onClick={reset}>重开</Button>
        </div>
        {!!g.win && <div style={{ textAlign: 'center', marginTop: 8 }}><Button size="small" block ghost onClick={() => go('gomoku', undefined, true)}>回大厅看战绩 ›</Button></div>}
      </Card>
      <div className="mut" style={{ textAlign: 'center', fontSize: 12, marginTop: 4 }}>点线交叉处落子 · 先连五子者胜 · 黑棋先行 · 棋局自动保存</div>
    </>
  )
}
export { Games, GomokuHome, GomokuLive, GomokuLocal }
