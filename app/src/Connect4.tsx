// 四子棋：7×6 重力落子 · 复用五子棋那套联机底座（房号/心跳/悔棋提案/终局特效/战绩）
// 数据走 PocketBase c4/c4r 集合（与 gmk 同构），逻辑净室自写
import { useEffect, useRef, useState } from 'react'
import { Card, Button, Tag } from 'animal-island-ui'
import { motion } from 'motion/react'
import { tapSmall } from './motion'
import { Ic } from './Icons'
import { pb, quiet, showToast } from './core'
const COLS = 7, ROWS = 6, N = COLS * ROWS
const CONF = ['#ff9ec4', '#ffd76e', '#9ad9a0', '#9ecbff', '#d1b3ff']
const newCode = () => String(1000 + Math.floor(Math.random() * 9000))

type Mv = { c: number, x: number }
const parseMv = (mv: string): Mv[] => (mv ? mv.split(',').filter(Boolean) : []).map((s, k) => {
  const [c, x] = s.split(':').map(Number)
  return { c, x: x > 0 ? x : (k % 2) + 1 }
})
// 回放落子：每颗掉进该列最底空位，返回 42 格盘面（r*COLS+c，row0=顶）
const boardOf = (mv: string) => {
  const bd = Array(N).fill(0)
  parseMv(mv).forEach((m) => {
    if (m.c < 0 || m.c >= COLS) return
    for (let r = ROWS - 1; r >= 0; r--) { if (!bd[r * COLS + m.c]) { bd[r * COLS + m.c] = m.x; break } }
  })
  return bd
}
const landRow = (bd: number[], c: number) => { for (let r = ROWS - 1; r >= 0; r--) if (!bd[r * COLS + c]) return r; return -1 }
const winAt4 = (bd: number[], i: number) => {
  const r0 = Math.floor(i / COLS), c0 = i % COLS, who = bd[i]
  if (!who) return null
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [i]
    for (const sg of [1, -1]) for (let k = 1; k < 4; k++) {
      const r = r0 + dr * k * sg, c = c0 + dc * k * sg
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS || bd[r * COLS + c] !== who) break
      cells.push(r * COLS + c)
    }
    if (cells.length >= 4) return cells
  }
  return null
}

export function C4Home({ go, me }: any) {
  const [games, setGames] = useState<any[]>([])
  const [hist, setHist] = useState<any[]>([])
  const [jc, setJc] = useState('')
  const [recOpen, setRecOpen] = useState(false)
  const myName = me?.nickName || me?.username || '我'
  const load = () => {
    pb.collection('c4').getFullList({ sort: '-created', filter: "winner = ''" }).then(setGames).catch(quiet)
    pb.collection('c4r').getFullList({ sort: '-created', filter: "winner != ''" }).then(setHist).catch(quiet)
  }
  useEffect(() => { load()
    pb.collection('c4').subscribe('*', () => load()).catch(quiet)
    return () => { pb.collection('c4').unsubscribe('*').catch(() => {}) }
  }, [])
  const live = games.filter((x) => x.winner === '')
  const mine = live.find((x) => x.black === me.id || x.white === me.id)
  const joinable = live.filter((x) => x.black !== me.id && x.white !== me.id && (!x.black || !x.white))
  const join = async (gm: any) => { try {
    const seat = gm.black ? 'white' : 'black'
    await pb.collection('c4').update(gm.id, seat === 'white'
      ? { white: me.id, wnm: myName, state: 'live', start: Date.now(), wSeen: Date.now() }
      : { black: me.id, bnm: myName, state: 'live', start: Date.now(), bSeen: Date.now() })
    go('c4-play', gm.id, true)
  } catch (e) { quiet(e) } }
  const create = async () => { try {
    const openG: any[] = await pb.collection('c4').getFullList({ sort: '-created', filter: "winner = ''" }).catch(() => [])
    const myG = openG.find((x) => x.black === me.id || x.white === me.id)
    if (myG) return go('c4-play', myG.id, true)
    const empty = openG.find((x) => !x.black || !x.white)
    if (empty) return join(empty)
    const r = await pb.collection('c4').create({ black: me.id, bnm: myName, moves: '', state: 'lobby', winner: '', prop: '', propBy: '', bSeen: Date.now(), wSeen: 0, code: newCode() })
    // 双端同时点开局会各建一局：再查一次，保留最早的空位局，自己多建的那局删掉并入
    const again: any[] = await pb.collection('c4').getFullList({ sort: 'created', filter: "winner = ''" }).catch(() => [])
    const first = again[0]
    if (first && first.id !== r.id && (!first.black || !first.white)) {
      await pb.collection('c4').delete(r.id).catch(() => {})
      return join(first)
    }
    go('c4-play', r.id, true)
  } catch (e) { quiet(e) } }
  const joinByCode = async () => {
    const code = jc.trim()
    if (!/^\d{4}$/.test(code)) { showToast('房号是 4 位数字哦'); return }
    try {
      const rs: any[] = await pb.collection('c4').getFullList({ filter: `code = '${code}' && winner = ''` })
      const g = rs[0]
      if (!g) { showToast(`找不到 ${code} 号房`); return }
      if (g.black === me.id || g.white === me.id) { go('c4-play', g.id, true); return }
      if (g.black && g.white) { showToast(`${code} 号房已经坐满啦`); return }
      join(g)
    } catch (e) { quiet(e) }
  }
  const isToday = (t: number) => new Date(t).toDateString() === new Date().toDateString()
  const rate = (arr: any[]) => {
    const played = arr.filter((x) => x.winner !== 'draw').length
    const won = arr.filter((x) => x.winner !== 'draw' && (x.winner === 'black' ? x.bid === me.id || (!x.bid && x.bn === myName) : x.wid === me.id || (!x.wid && x.wn === myName))).length
    return played ? Math.round((won / played) * 100) : null
  }
  const mine2 = hist.filter((x) => (x.bid || x.wid) ? (x.bid === me.id || x.wid === me.id) : (x.bn === myName || x.wn === myName))
  const td2 = mine2.filter((x) => isToday(new Date(x.created).getTime()))
  const wr = (label: string, arr: any[]) => <div className="wr"><span className="wn">{label}</span>
    <b className="wB">{rate(arr) === null ? '—' : rate(arr) + '%'}</b><span className="mut">{arr.length} 局</span></div>
  return (
    <>
      {!!mine && <Card className="blk" style={{ textAlign: 'center', padding: '18px 14px' }}>
        <div className="gmk-title">进行中的对局</div>
        <div className="mut" style={{ margin: '6px 0 12px' }}>{mine.code ? mine.code + ' 号房 · ' : ''}对手 {(mine.black === me.id ? mine.wnm : mine.bnm) || '等待中就位'}</div>
        <motion.button {...tapSmall} className="gmk-hero" onClick={() => go('c4-play', mine.id)}>继续对局 ›</motion.button>
      </Card>}
      <Card className="blk" style={{ textAlign: 'center', padding: '20px 14px' }}>
        <div style={{ color: 'var(--accent)', display: 'flex', justifyContent: 'center' }}><Ic v="🍬" size={46} /></div>
        <div className="gmk-title" style={{ margin: '8px 0 2px' }}>糖果四子棋</div>
        <div className="mut" style={{ margin: '2px 0 14px' }}>红先黄后 · 选列落子自动掉底 · 四连即胜，两台设备实时对战</div>
        <Button type="primary" block onClick={create}><Ic v="➕" size={15} /> 进入对局室</Button>
        {!!joinable.length && <div style={{ marginTop: 10 }}>
          {joinable.map((x) => (
            <div key={x.id} className="li" style={{ textAlign: 'left' }} onClick={() => join(x)}>
              <span className="dot"><Ic v="🍬" size={16} /></span>
              <span className="grow"><b>{x.code ? x.code + ' 号房 · ' : ''}{x.bnm || x.wnm} 的棋室</b><div className="mut">虚位以待 · 你执{x.black ? '黄' : '红'}</div></span>
              <Tag size="small" color="app-pink">加入</Tag>
            </div>))}
        </div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, textAlign: 'left' }}>
          <input className="in" style={{ flex: 1 }} inputMode="numeric" maxLength={4} placeholder="输入 4 位房号加入"
            value={jc} onChange={(e: any) => setJc(e.target.value)} />
          <Button size="small" type="primary" onClick={joinByCode}>加入</Button>
        </div>
      </Card>
      <Card className="blk" style={{ padding: '10px 16px' }}><Title4 /><div style={{ padding: '2px 0 8px' }}>{wr('今日', td2)}{wr('总', mine2)}</div></Card>
      <Card className="blk" style={{ padding: '10px 16px' }}>
        <div style={{ fontWeight: 800, color: 'var(--ink1)', padding: '8px 0 2px' }}>对局记录</div>
        {(recOpen ? hist : hist.slice(0, 3)).map((x) => (
          <div key={x.id} className="li" style={{ padding: '8px 2px' }}>
            <span className="dot"><Ic v={x.winner === 'draw' ? '🤝' : x.winner === 'black' ? '🔴' : '🟡'} size={15} /></span>
            <span className="grow"><b>{x.winner === 'draw' ? '平局' : (x.winner === 'black' ? x.bn : x.wn) + ' 胜'}</b>
              <div className="mut">{new Date(x.created).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {x.mv || '—'} 手 · {x.dur ? Math.max(1, Math.round(x.dur / 60)) + ' 分钟' : '—'} · {x.bn} vs {x.wn}</div></span>
          </div>))}
        {!hist.length && <div className="mut" style={{ padding: '6px 2px' }}>暂无记录</div>}
        {hist.length > 3 && <Button size="small" ghost block style={{ marginTop: 6 }} onClick={() => setRecOpen(!recOpen)}>{recOpen ? '收起 ▲' : `查看全部 ${hist.length} 局 ▼`}</Button>}
      </Card>
    </>
  )
}
function Title4() { return <div style={{ fontWeight: 800, color: 'var(--ink1)', padding: '8px 0 2px' }}>胜率</div> }

export function C4Live({ id, go, me }: any) {
  const [g, setG] = useState<any>(null)
  const [, setNow] = useState(0)
  const recorded = useRef('')
  const [fxOn, setFxOn] = useState(false)
  useEffect(() => { let alive = true
    const refetch = () => { pb.collection('c4').getOne(id).then((r) => { if (alive) setG(r) }).catch(() => {}) }
    refetch()
    pb.collection('c4').subscribe(id, (e) => setG(e.record)).catch(quiet)
    const onBack = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => { alive = false; clearInterval(t)
      document.removeEventListener('visibilitychange', onBack); window.removeEventListener('focus', onBack)
      pb.collection('c4').unsubscribe(id).catch(() => {}) }
  }, [id])
  const seat = !g ? '' : g.black === me.id ? 'black' : g.white === me.id ? 'white' : 'watch'
  useEffect(() => { if (!g || seat === 'watch' || !seat || g.winner) return
    const t = setInterval(() => { fetch(`/api/collections/c4/records/${g.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token as string },
      body: JSON.stringify({ [seat === 'black' ? 'bSeen' : 'wSeen']: Date.now() }) }).catch(() => {}) }, 10000)
    return () => clearInterval(t)
  }, [g?.id, seat, g?.winner])
  useEffect(() => { if (!g?.winner) { setFxOn(false); return }
    setFxOn(true)
    const t = setTimeout(() => setFxOn(false), 4200)
    return () => clearTimeout(t)
  }, [g?.winner, g?.moves])
  const myName = me?.nickName || me?.username || '我'
  useEffect(() => { if (!g || !g.winner) return
    const gk = `${g.id}#${g.round || 1}`
    if (recorded.current === gk) return
    recorded.current = gk
    pb.collection('c4r').getFullList({ filter: `game="${gk}"` }).then((l) => { if (!l.length)
      pb.collection('c4r').create({ game: gk, winner: g.winner, bn: g.bnm, wn: g.wnm, bId: g.black, wId: g.white,
        mv: parseMv(g.moves || '').length, dur: g.dur || 0 }).catch(quiet)
    }).then(() => pb.collection('c4r').getList(1, 200, { sort: '-created', fields: 'id' }))
      .then((pg) => { pg.items.slice(100).forEach((x: any) => pb.collection('c4r').delete(x.id).catch(() => {})) }).catch(quiet)
  }, [g?.winner])
  const patch = async (body: any) => { try {
    const r = await fetch(`/api/collections/c4/records/${g.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token as string, 'If-Match': g.updated },
      body: JSON.stringify(body) })
    if (r.status === 412) { const cur = await pb.collection('c4').getOne(g.id).catch(() => null); if (cur) setG(cur); return }
    if (!r.ok) throw new Error('HTTP ' + r.status)
  } catch (e) { quiet(e) } }
  const b = g ? boardOf(g.moves || '') : Array(N).fill(0)
  const mvArr: Mv[] = g ? parseMv(g.moves || '') : []
  const lastX = mvArr.length ? mvArr[mvArr.length - 1].x : 0
  const turnSeat = !lastX ? 'black' : lastX === 1 ? 'white' : 'black'
  // 最后一颗实际落点（回放求行号）
  let lastI = -1
  if (mvArr.length) { const t = Array(N).fill(0)
    mvArr.forEach((m) => { for (let r = ROWS - 1; r >= 0; r--) if (!t[r * COLS + m.c]) { t[r * COLS + m.c] = 1; lastI = r * COLS + m.c; break } }) }
  const bothIn = g && g.black && g.white
  const winCells = g && g.winner && g.winner !== 'draw' && lastI >= 0 ? winAt4(b, lastI) : null
  const oppSeatName = seat === 'black' ? g?.wnm : g?.bnm
  const oppSeen = seat === 'black' ? g?.wSeen : g?.bSeen
  const oppOnline = !!oppSeen && (Date.now() - oppSeen) < 32000
  const play = (c: number) => {
    if (!g || g.winner || g.state !== 'live' || seat !== turnSeat || !bothIn) return
    if (landRow(b, c) < 0) { showToast('这列满啦，换一列'); return }
    const myx = seat === 'black' ? 1 : 2
    const arr: Mv[] = [...mvArr, { c, x: myx }]
    const nb = boardOf(arr.map((m) => `${m.c}:${m.x}`).join(','))
    // 落点=旧盘该列最低空格（不能用"列中最低的同色子"——两子间夹对手子时会扫到旧子，漏判新子的四连）
    const li = landRow(b, c) * COLS + c
    const wl = winAt4(nb, li)
    const full = nb.every((x: number) => x)
    const winColor = myx === 1 ? 'black' : 'white'
    if (navigator.vibrate) navigator.vibrate(wl ? [30, 40, 80] : 12)
    patch({ moves: arr.map((m) => `${m.c}:${m.x}`).join(','), ...(wl || full ? { winner: wl ? winColor : 'draw', state: 'done', dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) } : {}) })
  }
  const undo = (extra: any = {}) => {
    const x0 = g.propBy === 'white' || extra.by === 'white' ? 2 : 1
    let k = mvArr.length - 1
    while (k >= 0 && mvArr[k].x !== x0) k--
    if (k < 0) { patch({ prop: '', propBy: '', ...extra }); return }
    const arr = mvArr.slice(0, k).concat(mvArr.slice(k + 1))
    patch({ moves: arr.map((m) => `${m.c}:${m.x}`).join(','), prop: '', propBy: '', ...extra })
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
  if (!g) return <Card className="blk gmk-box"><div className="mut-row">糖果罐正在摆好…</div></Card>
  const iWin = !!g.winner && g.winner === seat
  const winLineTxt = g.winner === 'draw' ? '平局 · 棋盘满了'
    : g.winner ? ((g.winner === 'black' ? g.bnm : g.wnm) || '') + ' 四连获胜' : ''
  const statusTxt = g.winner ? winLineTxt
    : !bothIn ? '等待对方就位…'
    : seat === 'watch' ? '观战模式 · 你未占座'
    : g.state !== 'live' ? '就位后对方加入即开局'
    : seat === turnSeat ? `第 ${mvArr.length + 1} 手 · 轮你落子`
    : oppOnline ? `第 ${mvArr.length + 1} 手 · ${oppSeatName || '对方'} 思考中…` : `第 ${mvArr.length + 1} 手 · 对方暂时离开，落子会同步`
  return (
    <Card className="blk gmk-box">
      {!!g.code && <div className="mut" style={{ textAlign: 'center', fontSize: 11.5, marginBottom: 6 }}>房间号 <b style={{ color: 'var(--accent-ink)', letterSpacing: 2 }}>{g.code}</b> · 报号加入</div>}
      <div className="pvp">
        {(['black', 'white'] as const).map((sk) => {
          const name2 = sk === 'black' ? g.bnm : g.wnm
          const occ = sk === 'black' ? g.black : g.white
          const seen = sk === 'black' ? g.bSeen : g.wSeen
          const isMe = occ === me.id
          const online = isMe || (!!occ && Date.now() - (seen || 0) < 32000)
          return <div key={sk} className={'pl' + (!g.winner && g.state === 'live' && turnSeat === sk ? ' now' : '') + (occ && !online && g.state === 'live' && !g.winner ? ' off' : '')}>
            <i className={'pvdot ' + (sk === 'black' ? 'dotC4a' : 'dotC4b')} />
            <div className="grow"><div className="nm">{name2 || (sk === 'black' ? '红方空位' : '黄方空位')}{isMe ? '（你）' : ''}</div>
              <div className="st">{occ ? (online ? '● 在线' : '○ 离线') : '等待加入'} · {sk === 'black' ? '先手' : '后手'}</div></div>
          </div> })}
      </div>
      {g.state === 'lobby' && !g.winner && (
        <div className="gmk-wait">
          {seat === 'watch' || !seat ? <>
            <div className="pulse" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)', margin: '6px 0 10px' }}>这棋室还缺一位棋手</div>
            <div style={{ marginBottom: 8 }}><Button size="small" type="primary" onClick={() => takeSeat(g.black ? 'white' : 'black')}>执{g.black ? '黄（后手）' : '红（先手）'}加入</Button></div></>
            : <>
            <div className="pulse" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)', margin: '6px 0 10px' }}>⏳ {g.code ? g.code + ' 号房等待加入' : '等待对方加入'} · TA 可在大厅点这局或输入房号</div>
            <div className="mut" style={{ marginBottom: 10 }}>你已占座，开局前还能换：</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button size="small" type="primary" ghost={seat !== 'black'} onClick={() => takeSeat('black')}>执红 · 先</Button>
              <Button size="small" type="primary" ghost={seat !== 'white'} onClick={() => takeSeat('white')}>执黄 · 后</Button>
            </div></>}
        </div>)}
      <div className={'c4board' + (winCells ? ' winning' : '')}>
        <div className="c4grid">
          {Array.from({ length: COLS }).map((_, c) => {
            const hot = !g.winner && bothIn && g.state === 'live' && seat === turnSeat && landRow(b, c) >= 0
            return <div key={c} className={'c4col' + (hot ? ' hot' : '')} onClick={() => play(c)}>
              {Array.from({ length: ROWS }).map((__, r) => {
                const i = r * COLS + c, x = b[i]
                const fresh = i === lastI
                return <span key={i} className={'ch' + (x ? ' x' + x : '') + (fresh ? ' fresh' : '') + (winCells && winCells.includes(i) ? ' win' : '')}>
                  {!!x && <i />}
                </span>
              })}
            </div>
          })}
        </div>
        {!!g.winner && fxOn && <div className="winfx" onClick={() => setFxOn(false)}>
          <div className="wcard">
            <div className="wtrophy"><Ic v={g.winner === 'draw' ? 'handshake' : 'trophy'} size={64} /></div>
            <div className="wtxt">{g.winner === 'draw' ? '平局！' : iWin ? '你赢啦！' : '对方获胜'}</div>
            <div className="wsub">{g.winner === 'draw' ? '棋逢对手 · 再战一局' : (g.winner === 'black' ? g.bnm : g.wnm) + ' 四连达成'}</div>
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
          <span className="mut" style={{ textAlign: 'center', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{winLineTxt}{g.dur ? ' · ' + Math.max(1, Math.round(g.dur / 60)) + '分' : ''} · {mvArr.length} 手</span>
          <Button size="small" ghost onClick={() => go('c4', undefined, true)}>回大厅</Button></>
          : seat !== 'watch' && seat && bothIn && g.state === 'live' ? <>
          <Button size="small" ghost onClick={() => ask('undo')} disabled={mvArr.length < 2}>悔棋</Button>
          <span className="mut" style={{ textAlign: 'center' }}>{statusTxt}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <Button size="small" ghost onClick={() => ask('draw')}>和棋</Button>
            <Button size="small" ghost onClick={resign}>认输</Button></span></>
          : <span className="mut" style={{ textAlign: 'center', flex: 1 }}>{statusTxt}</span>}
      </div>
      <div className="gmk-hint">离开也不怕 · 回来自动续战 · 点一列，糖果就掉到底</div>
    </Card>
  )
}
