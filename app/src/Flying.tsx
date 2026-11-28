// 情侣飞行棋：S 型 24 格 · 任务格/奖励格/陷阱格 · 40 条原创任务库（净室自写）
// 联机走 PocketBase fly/flyr（房号底座同五子棋），另有同屏热座模式
import { useEffect, useRef, useState } from 'react'
import { Card, Button, Tag } from 'animal-island-ui'
import { motion } from 'motion/react'
import { tapSmall } from './motion'
import { Ic } from './Icons'
import { pb, quiet, showToast } from './core'

const CELLS = 24, GOAL = CELLS - 1
const TASK_CELLS = [3, 6, 10, 14, 17, 21]
const BONUS_CELLS = [7, 18]
const TRAP_CELLS = [12, 20]
const CONF = ['#ff9ec4', '#ffd76e', '#9ad9a0', '#9ecbff', '#d1b3ff']
const TASKS = [
  '拥抱 10 秒，数着秒的那种', '给对方一个额头吻', '摸摸对方的头三下，说「乖」', '互相喂一口手边的零食',
  '捏捏对方的脸，不许躲', '牵手对视 15 秒，先笑的人罚唱一句', '真诚夸对方三件事，不许重样', '背对方绕房间一圈（或 1 分钟）',
  '用气声说一次「我爱你」', '帮对方撩一次头发', '说出今天最想对方的一瞬间', '交换一个最近的秘密',
  '回忆第一次见面的第一印象', '说一件想约 TA 一起去做的小事', '约定下一次的约会内容', '温柔指出一个想让对方改的小习惯',
  '描述十年后两人的一天', '告诉对方你最想要 TA 送的礼物', '重演你们最难忘的一次约会', '说一件你藏了很久的小事',
  '学一种动物叫，把对方逗笑为止', '跳舞 10 秒，动作越怪越好', '一起做 5 个深蹲，喊着数', '做一个最丑的鬼脸合影',
  '唱对方最爱那首歌的一句', '用对方家乡的口音说话 10 秒', '摆出游戏角色招牌姿势让 TA 拍照', '模仿对方平时的一个小动作',
  '石头剪刀布，输的洗一次碗', '扳手腕一局，赢的提一个小要求', '让对方给你画眉毛（1 分钟后合影）', '挠痒痒 15 秒，不许躲',
  '给对方按摩肩膀 2 分钟', '接下来的 1 分钟当对方的跟班', '让对方选你明天穿什么', '真心话一局：对方问，你必须答',
  '把手机交给对方翻看 1 分钟', '给对方起一个今天专用的肉麻昵称',
]
const newCode = () => String(1000 + Math.floor(Math.random() * 9000))
const initBd = () => ({ p: [0, 0], turn: 0, skip: [false, false], task: -1, extra: false, t: 0 })
const parseBd = (bd: string) => { try { const v = JSON.parse(bd); return (v && v.p && typeof v.turn === 'number') ? v : initBd() } catch { return initBd() } }
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
function Dice({ v, rolling }: any) {
  const shown = rolling ? (1 + ((Date.now() / 90) | 0) % 6) : (v || 6)
  const on = new Set(PIPS[shown] || [4])
  return <div className={'flydice' + (rolling ? ' rolling' : '')}>
    <div className="pips">{Array.from({ length: 9 }).map((_, i) => <s key={i} className={on.has(i) ? 'on' : ''} />)}</div>
  </div>
}

// ===== 共用棋盘 + 骰子 + 任务卡 =====
function FlyBoard({ p, canAct, rolling, dice, onRoll, task, onTaskDone, winner }: any) {
  return (<>
    <div className="flyboard">
      {Array.from({ length: CELLS }).map((_, i) => {
        const row = Math.floor(i / 6), col = row % 2 ? 5 - (i % 6) : (i % 6)
        const kind = TASK_CELLS.includes(i) ? 'task' : BONUS_CELLS.includes(i) ? 'bonus' : TRAP_CELLS.includes(i) ? 'trap' : i === 0 ? 'start' : i === GOAL ? 'goal' : ''
        // 两枚棋子都显示；用真实座位判断颜色，不能在 filter 后用下标猜
        const toks = [
          { seat: 0, cls: 'tokA', emoji: '🐻', on: p[0] === i },
          { seat: 1, cls: 'tokB', emoji: '🐰', on: p[1] === i },
        ].filter((t) => t.on)
        return <div key={i} className={'fcell' + (kind ? ' f' + kind : '')} style={{ gridRowStart: row + 1, gridColumnStart: col + 1 }}>
          <span className="fk">{kind === 'task' ? '💞' : kind === 'bonus' ? '🎁' : kind === 'trap' ? '💤' : kind === 'goal' ? '🏁' : kind === 'start' ? '🏠' : ''}</span>
          {toks.map((t) => <i key={t.seat} className={'ftok ' + t.cls}>{t.emoji}</i>)}
        </div>
      })}
    </div>
    <div className="flyctl">
      <Dice v={dice} rolling={rolling} />
      <Button type="primary" disabled={!canAct || rolling || !!winner} onClick={onRoll}>掷 骰 子</Button>
    </div>
    {task >= 0 && !winner && (
      <div className="flytask">
        <div className="ftcard">
          <div className="fttag">💞 情侣任务</div>
          <div className="fttext">{TASKS[task]}</div>
          <Button type="primary" block onClick={onTaskDone}>完成啦 ❤</Button>
        </div>
      </div>)}
  </>)
}

// ===== 大厅（联机） =====
export function FlyHome({ go, me }: any) {
  const [games, setGames] = useState<any[]>([])
  const [hist, setHist] = useState<any[]>([])
  const [jc, setJc] = useState('')
  const [recOpen, setRecOpen] = useState(false)
  const myName = me?.nickName || me?.username || '我'
  const load = () => {
    pb.collection('fly').getFullList({ sort: '-created', filter: "winner = ''" }).then(setGames).catch(quiet)
    pb.collection('flyr').getFullList({ sort: '-created', filter: "winner != ''" }).then(setHist).catch(quiet)
  }
  useEffect(() => { load()
    pb.collection('fly').subscribe('*', () => load()).catch(quiet)
    return () => { pb.collection('fly').unsubscribe('*').catch(() => {}) }
  }, [])
  const live = games.filter((x: any) => x.winner === '')
  const mine = live.find((x: any) => x.black === me.id || x.white === me.id)
  const joinable = live.filter((x: any) => x.black !== me.id && x.white !== me.id && (!x.black || !x.white))
  const join = async (gm: any) => { try {
    const seat = gm.black ? 'white' : 'black'
    await pb.collection('fly').update(gm.id, seat === 'white'
      ? { white: me.id, wnm: myName, state: 'live', start: Date.now(), wSeen: Date.now() }
      : { black: me.id, bnm: myName, state: 'live', start: Date.now(), bSeen: Date.now() })
    go('fly-play', gm.id, true)
  } catch (e) { quiet(e) } }
  const create = async () => { try {
    const openG: any[] = await pb.collection('fly').getFullList({ sort: '-created', filter: "winner = ''" }).catch(() => [])
    const myG = openG.find((x) => x.black === me.id || x.white === me.id)
    if (myG) return go('fly-play', myG.id, true)
    const empty = openG.find((x) => !x.black || !x.white)
    if (empty) return join(empty)
    const r = await pb.collection('fly').create({ black: me.id, bnm: myName, moves: JSON.stringify(initBd()), state: 'lobby', winner: '', prop: '', propBy: '', bSeen: Date.now(), wSeen: 0, code: newCode() })
    // 双端同时点开局会各建一局：再查一次，保留最早的空位局，自己多建的那局删掉并入
    const again: any[] = await pb.collection('fly').getFullList({ sort: 'created', filter: "winner = ''" }).catch(() => [])
    const first = again[0]
    if (first && first.id !== r.id && (!first.black || !first.white)) {
      await pb.collection('fly').delete(r.id).catch(() => {})
      return join(first)
    }
    go('fly-play', r.id, true)
  } catch (e) { quiet(e) } }
  const joinByCode = async () => {
    const code = jc.trim()
    if (!/^\d{4}$/.test(code)) { showToast('房号是 4 位数字哦'); return }
    try {
      const rs: any[] = await pb.collection('fly').getFullList({ filter: `code = '${code}' && winner = ''` })
      const g = rs[0]
      if (!g) { showToast(`找不到 ${code} 号房`); return }
      if (g.black === me.id || g.white === me.id) { go('fly-play', g.id, true); return }
      if (g.black && g.white) { showToast(`${code} 号房已经坐满啦`); return }
      join(g)
    } catch (e) { quiet(e) }
  }
  return (<>
    {!!mine && <Card className="blk" style={{ textAlign: 'center', padding: '18px 14px' }}>
      <div className="gmk-title">进行中的对局</div>
      <div className="mut" style={{ margin: '6px 0 12px' }}>{mine.code ? mine.code + ' 号房 · ' : ''}对手 {(mine.black === me.id ? mine.wnm : mine.bnm) || '等待中就位'}</div>
      <motion.button {...tapSmall} className="gmk-hero" onClick={() => go('fly-play', mine.id)}>继续对局 ›</motion.button>
    </Card>}
    <Card className="blk" style={{ textAlign: 'center', padding: '20px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', fontSize: 46 }}>✈️</div>
      <div className="gmk-title" style={{ margin: '8px 0 2px' }}>情侣飞行棋</div>
      <div className="mut" style={{ margin: '2px 0 14px' }}>🐻 vs 🐰 · 掷骰走格 · 落到 💞 做情侣任务 · 先达终点 🏁 者胜</div>
      <Button type="primary" block onClick={create}><Ic v="➕" size={15} /> 进入棋室</Button>
      {!!joinable.length && <div style={{ marginTop: 10 }}>
        {joinable.map((x: any) => (
          <div key={x.id} className="li" style={{ textAlign: 'left' }} onClick={() => join(x)}>
            <span className="dot">✈️</span>
            <span className="grow"><b>{x.code ? x.code + ' 号房 · ' : ''}{x.bnm || x.wnm} 的棋室</b><div className="mut">虚位以待</div></span>
            <Tag size="small" color="app-pink">加入</Tag>
          </div>))}
      </div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, textAlign: 'left' }}>
        <input className="in" style={{ flex: 1 }} inputMode="numeric" maxLength={4} placeholder="输入 4 位房号加入" value={jc} onChange={(e: any) => setJc(e.target.value)} />
        <Button size="small" type="primary" onClick={joinByCode}>加入</Button>
      </div>
      <div style={{ marginTop: 12 }}><Button size="small" ghost onClick={() => go('fly-local')}>两个人一台手机 · 同屏模式</Button></div>
    </Card>
    <Card className="blk" style={{ padding: '10px 16px' }}>
      <div style={{ fontWeight: 800, color: 'var(--ink1)', padding: '8px 0 2px' }}>对局记录</div>
      {(recOpen ? hist : hist.slice(0, 3)).map((x: any) => (
        <div key={x.id} className="li" style={{ padding: '8px 2px' }}>
          <span className="dot"><Ic v="trophy" size={15} /></span>
          <span className="grow"><b>{(x.winner === 'black' ? x.bn : x.wn)} 胜</b>
            <div className="mut">{new Date(x.created).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {x.mv || '—'} 回合 · {x.dur ? Math.max(1, Math.round(x.dur / 60)) + ' 分钟' : '—'}</div></span>
        </div>))}
      {!hist.length && <div className="mut" style={{ padding: '6px 2px' }}>暂无记录</div>}
      {hist.length > 3 && <Button size="small" ghost block style={{ marginTop: 6 }} onClick={() => setRecOpen(!recOpen)}>{recOpen ? '收起 ▲' : `查看全部 ${hist.length} 局 ▼`}</Button>}
    </Card>
  </>)
}

// ===== 联机对局 =====
export function FlyLive({ id, go, me }: any) {
  const [g, setG] = useState<any>(null)
  const [, setNow] = useState(0)
  const recorded = useRef('')
  const [fxOn, setFxOn] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [dice, setDice] = useState(0)
  useEffect(() => { let alive = true
    const refetch = () => { pb.collection('fly').getOne(id).then((r) => { if (alive) setG(r) }).catch(() => {}) }
    refetch()
    pb.collection('fly').subscribe(id, (e) => setG(e.record)).catch(quiet)
    const onBack = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => { alive = false; clearInterval(t)
      document.removeEventListener('visibilitychange', onBack); window.removeEventListener('focus', onBack)
      pb.collection('fly').unsubscribe(id).catch(() => {}) }
  }, [id])
  const seat = !g ? '' : g.black === me.id ? 'black' : g.white === me.id ? 'white' : 'watch'
  useEffect(() => { if (!g || seat === 'watch' || !seat || g.winner) return
    const t = setInterval(() => { fetch(`/api/collections/fly/records/${g.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token as string },
      body: JSON.stringify({ [seat === 'black' ? 'bSeen' : 'wSeen']: Date.now() }) }).catch(() => {}) }, 10000)
    return () => clearInterval(t)
  }, [g?.id, seat, g?.winner])
  useEffect(() => { if (!g?.winner) { setFxOn(false); return }
    setFxOn(true)
    const t = setTimeout(() => setFxOn(false), 4200)
    return () => clearTimeout(t)
  }, [g?.winner])
  useEffect(() => { if (!g || !g.winner) return
    const gk = `${g.id}#${g.round || 1}`
    const bd = parseBd(g.moves || '')
    if (recorded.current === gk) return
    recorded.current = gk
    pb.collection('flyr').getFullList({ filter: `game="${gk}"` }).then((l) => { if (!l.length)
      pb.collection('flyr').create({ game: gk, winner: g.winner, bn: g.bnm, wn: g.wnm, bId: g.black, wId: g.white,
        mv: bd.t || 0, dur: g.dur || 0 }).catch((e: any) => { if (e?.status !== 400) quiet(e) })
    }).then(() => pb.collection('flyr').getList(1, 200, { sort: '-created', fields: 'id' }))
      .then((pg) => { pg.items.slice(100).forEach((x: any) => pb.collection('flyr').delete(x.id).catch(() => {})) }).catch(quiet)
  }, [g?.winner])
  const patch = async (body: any) => { try {
    const r = await fetch(`/api/collections/fly/records/${g.id}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token as string, 'If-Match': g.updated },
      body: JSON.stringify(body) })
    if (r.status === 412) { const cur = await pb.collection('fly').getOne(g.id).catch(() => null); if (cur) setG(cur); return }
    if (!r.ok) throw new Error('HTTP ' + r.status)
  } catch (e) { quiet(e) } }
  const bd = parseBd(g?.moves || '')
  const bdRef = useRef<any>(bd)
  bdRef.current = bd
  const myIdx = seat === 'white' ? 1 : 0
  const myTurn = seat !== 'watch' && bd.turn === myIdx && !g?.winner
  const oppSeatName = seat === 'black' ? g?.wnm : g?.bnm
  const oppSeen = seat === 'black' ? g?.wSeen : g?.bSeen
  const oppOnline = !!oppSeen && (Date.now() - oppSeen) < 32000
  const doRoll = () => {
    if (!myTurn || rolling || bd.task >= 0) return
    setRolling(true)
    setTimeout(async () => {
      const v = 1 + Math.floor(Math.random() * 6)
      setDice(v); setRolling(false)
      if (navigator.vibrate) navigator.vibrate(18)
      const nb = JSON.parse(JSON.stringify(bdRef.current))
      nb.t = (nb.t || 0) + 1
      let skipNote = false
      if (nb.skip[nb.turn]) { nb.skip[nb.turn] = false; nb.turn = (nb.turn + 1) % 2; skipNote = true }
      else {
        nb.p[nb.turn] = Math.min(GOAL, nb.p[nb.turn] + v)
        const at = nb.p[nb.turn]
        if (at >= GOAL) { await patch({ moves: JSON.stringify(nb), winner: nb.turn === 0 ? 'black' : 'white', state: 'done', dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) }); return }
        if (TASK_CELLS.includes(at)) nb.task = Math.floor(Math.random() * TASKS.length)
        else if (TRAP_CELLS.includes(at)) { nb.skip[nb.turn] = true; nb.turn = (nb.turn + 1) % 2; showToast('💤 踩到瞌睡格，下一轮停一次！') }
        else if (BONUS_CELLS.includes(at)) { /* 再来一轮：turn 不变 */ }
        else nb.turn = (nb.turn + 1) % 2
      }
      await patch({ moves: JSON.stringify(nb) })
      if (skipNote) showToast('💤 这轮被催眠跳过啦')
    }, 650)
  }
  const doneTask = () => {
    const nb = JSON.parse(JSON.stringify(bd)); nb.task = -1
    nb.turn = (nb.turn + 1) % 2
    patch({ moves: JSON.stringify(nb) })
  }
  const resign = () => { if (!confirm('确定认输吗？')) return; patch({ winner: seat === 'black' ? 'white' : 'black', state: 'done', dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) }) }
  const ask = (what: string) => patch({ prop: what, propBy: seat })
  const answer = (ok: boolean) => { if (!ok) { patch({ prop: '', propBy: '' }); return }
    patch({ winner: 'draw', state: 'done', prop: '', propBy: '', dur: Math.round((Date.now() - (g.start || Date.now())) / 1000) }) }
  const rematch = () => patch({ moves: JSON.stringify(initBd()), winner: '', state: 'live', prop: '', propBy: '', start: Date.now(), dur: 0, round: (g.round || 1) + 1 })
  const myName = me?.nickName || me?.username || '我'
  const swap = () => patch({ black: g.white, white: g.black, bnm: g.wnm, wnm: g.bnm, moves: JSON.stringify(initBd()), winner: '', state: 'live', prop: '', propBy: '', start: Date.now(), dur: 0, round: (g.round || 1) + 1 })
  const takeSeat = (want: string) => patch(want === 'black'
    ? { black: me.id, bnm: myName, white: '', wnm: '', bSeen: Date.now(), state: 'lobby' }
    : { white: me.id, wnm: myName, black: '', bnm: '', wSeen: Date.now(), state: 'lobby' })
  if (!g) return <Card className="blk gmk-box"><div className="mut-row">机场正在起飞准备…</div></Card>
  const iWin = !!g.winner && g.winner === seat
  const bothIn = g.black && g.white
  const statusTxt = g.winner ? '' : !bothIn ? '等待对方就位…' : seat === 'watch' ? '观战模式' : bd.task >= 0 ? '完成小任务才能继续 ✈️' : myTurn ? '轮到你掷骰子啦' : oppOnline ? `${oppSeatName || '对方'} 掷骰中…` : '对方暂时离开，掷了也会同步'
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
          return <div key={sk} className={'pl' + (!g.winner && bd.turn === (sk === 'black' ? 0 : 1) ? ' now' : '')}>
            <i className="pvdot" style={{ background: sk === 'black' ? '#a5d6a7' : '#ffc4c4' }} />
            <div className="grow"><div className="nm">{sk === 'black' ? '🐻' : '🐰'} {name2 || (sk === 'black' ? '熊位空着' : '兔位空着')}{isMe ? '（你）' : ''}</div>
              <div className="st">{occ ? (online ? '● 在线' : '○ 离线') : '等待加入'}{bd.skip[sk === 'black' ? 0 : 1] ? ' · 💤 停一轮' : ''}</div></div>
          </div> })}
      </div>
      {g.state === 'lobby' && !g.winner && (
        <div className="gmk-wait">
          {seat === 'watch' || !seat ? <>
            <div className="pulse" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)', margin: '6px 0 10px' }}>这航班还缺一位乘客</div>
            <div style={{ marginBottom: 8 }}><Button size="small" type="primary" onClick={() => takeSeat(g.black ? 'white' : 'black')}>执{g.black ? '🐰 加入' : '🐻 加入'}</Button></div></>
            : <>
            <div className="pulse" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-ink)', margin: '6px 0 10px' }}>⏳ {g.code ? g.code + ' 号房等待加入' : '等待对方加入'}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button size="small" type="primary" ghost={seat !== 'black'} onClick={() => takeSeat('black')}>🐻 熊</Button>
              <Button size="small" type="primary" ghost={seat !== 'white'} onClick={() => takeSeat('white')}>🐰 兔</Button>
            </div></>}
        </div>)}
      <FlyBoard p={bd.p} canAct={myTurn} rolling={rolling} dice={dice} onRoll={doRoll} task={bd.task} onTaskDone={doneTask} winner={g.winner} />
      <div style={{ position: 'relative' }}>
        {!!g.winner && fxOn && <div className="winfx" onClick={() => setFxOn(false)}>
          <div className="wcard">
            <div className="wtrophy"><Ic v={g.winner === 'draw' ? 'handshake' : 'trophy'} size={64} /></div>
            <div className="wtxt">{g.winner === 'draw' ? '一起到的！' : iWin ? '你赢啦！' : (g.winner === 'black' ? g.bnm : g.wnm) + ' 先落地'}</div>
            <div className="wsub">✈️ 爱情航班安全抵达</div>
          </div>
          {Array.from({ length: 26 }).map((_, k) => (
            <i key={k} className="conf" style={{ left: (k * 3.84 + 1.5) + '%', background: CONF[k % 5],
              animationDelay: ((k % 6) * 0.32) + 's', animationDuration: (1.9 + (k % 5) * 0.3) + 's' }} />))}
        </div>}
      </div>
      {!!g.prop && g.propBy && g.propBy !== seat && !g.winner && seat !== 'watch' &&
        <div className="propbar"><span className="grow">{(g.propBy === 'black' ? g.bnm : g.wnm)} 请求和棋</span>
          <Button size="small" type="primary" onClick={() => answer(true)}>同意</Button>
          <Button size="small" ghost onClick={() => answer(false)}>拒绝</Button></div>}
      {!!g.prop && g.propBy === seat && !g.winner &&
        <div className="propbar"><span className="grow">已发出和棋请求，等待对方回应…</span>
          <Button size="small" ghost onClick={() => patch({ prop: '', propBy: '' })}>取消</Button></div>}
      <div className="gfoot">
        {g.winner ? <>
          <span style={{ display: 'flex', gap: 6 }}>
            <Button size="small" type="primary" onClick={rematch}>再来一局</Button>
            <Button size="small" ghost onClick={swap}>换宠</Button></span>
          <span className="mut" style={{ textAlign: 'center', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{iWin ? '🏆 赢啦' : g.winner === 'draw' ? '🤝 平局' : '差一点'}{g.dur ? ' · ' + Math.max(1, Math.round(g.dur / 60)) + '分' : ''}</span>
          <Button size="small" ghost onClick={() => go('fly', undefined, true)}>回大厅</Button></>
          : seat !== 'watch' && seat && bothIn ? <>
          <Button size="small" ghost onClick={() => ask('draw')}>和棋</Button>
          <span className="mut" style={{ textAlign: 'center' }}>{statusTxt}</span>
          <Button size="small" ghost onClick={resign}>认输</Button></>
          : <span className="mut" style={{ textAlign: 'center', flex: 1 }}>{statusTxt}</span>}
      </div>
      <div className="gmk-hint">💞 任务格做情侣小任务 · 🎁 奖励格再掷一次 · 💤 瞌睡格停一轮</div>
    </Card>
  )
}

// ===== 同屏热座（离线） =====
export function FlyLocal({ go, data }: any) {
  const [bd, setBd] = useState<any>(initBd())
  const startRef = useRef(Date.now())
  const [rolling, setRolling] = useState(false)
  const [dice, setDice] = useState(0)
  const [winner, setWinner] = useState('')
  const [fxOn, setFxOn] = useState(false)
  const doRoll = () => {
    if (rolling || winner || bd.task >= 0) return
    setRolling(true)
    setTimeout(() => {
      const v = 1 + Math.floor(Math.random() * 6)
      setDice(v); setRolling(false)
      if (navigator.vibrate) navigator.vibrate(18)
      const nb = JSON.parse(JSON.stringify(bd))
      nb.t = (nb.t || 0) + 1
      if (nb.skip[nb.turn]) { nb.skip[nb.turn] = false; nb.turn = (nb.turn + 1) % 2; showToast('💤 被催眠跳过这轮') }
      else {
        nb.p[nb.turn] = Math.min(GOAL, nb.p[nb.turn] + v)
        const at = nb.p[nb.turn]
        if (at >= GOAL) { setWinner(nb.turn === 0 ? '🐻' : '🐰'); setFxOn(true); setTimeout(() => setFxOn(false), 4200); setBd(nb)
          const nm2 = [data?.setting?.boyName || '男孩', data?.setting?.girlName || '女孩']
          pb.collection('flyr').create({ game: 'local-' + Date.now().toString(36), winner: nb.turn === 0 ? 'black' : 'white',
            bn: nm2[0], wn: nm2[1], mv: nb.t || 0, dur: Math.round((Date.now() - startRef.current) / 1000) }).catch(() => {})
          return }
        if (TASK_CELLS.includes(at)) nb.task = Math.floor(Math.random() * TASKS.length)
        else if (TRAP_CELLS.includes(at)) { nb.skip[nb.turn] = true; nb.turn = (nb.turn + 1) % 2; showToast('💤 瞌睡格，下一轮停一次！') }
        else if (BONUS_CELLS.includes(at)) { /* 再来一轮 */ }
        else nb.turn = (nb.turn + 1) % 2
      }
      setBd(nb)
    }, 650)
  }
  const reset = () => { startRef.current = Date.now(); setBd(initBd()); setDice(0); setWinner(''); setFxOn(true); setTimeout(() => setFxOn(false), 3000) }
  return (
    <Card className="blk gmk-box" style={{ position: 'relative' }}>
      <div className="pvp">
        {([0, 1] as const).map((k) => (
          <div key={k} className={'pl' + (!winner && bd.turn === k ? ' now' : '')}>
            <i className="pvdot" style={{ background: k ? '#ffc4c4' : '#a5d6a7' }} />
            <div className="grow"><div className="nm">{k ? '🐰 兔子' : '🐻 熊熊'}{bd.skip[k] ? ' · 💤' : ''}</div>
              <div className="st">当前 {bd.p[k]} 格{bd.turn === k && !winner ? ' · 轮到你' : ''}</div></div>
          </div>))}
      </div>
      <FlyBoard p={bd.p} canAct rolling={rolling} dice={dice} onRoll={doRoll} task={bd.task} onTaskDone={() => { const nb = { ...bd, task: -1, turn: (bd.turn + 1) % 2 }; setBd(nb) }} winner={winner} />
      {winner && fxOn && <div className="winfx" onClick={() => setFxOn(false)}>
        <div className="wcard"><div className="wtrophy"><Ic v="trophy" size={64} /></div><div className="wtxt">{winner} 先落地！</div><div className="wsub">同屏航班 · 掌声响起来</div></div>
        {Array.from({ length: 20 }).map((_, k) => (<i key={k} className="conf" style={{ left: (k * 4.8 + 1.5) + '%', background: CONF[k % 5], animationDelay: ((k % 5) * 0.3) + 's' }} />))}
      </div>}
      <div className="gfoot">
        {winner
          ? <><span style={{ display: 'flex', gap: 6 }}><Button size="small" type="primary" onClick={reset}>再来一局</Button></span>
            <span className="mut" style={{ textAlign: 'center' }}>{winner} 获胜</span>
            <Button size="small" ghost onClick={() => go('fly', undefined, true)}>回大厅</Button></>
          : <><span style={{ width: 60 }} />
            <span className="mut" style={{ textAlign: 'center' }}>{bd.task >= 0 ? '完成任务后点上方按钮 ✈️' : `轮到${bd.turn ? '🐰' : '🐻'} · 点骰子`}</span>
            <Button size="small" ghost onClick={() => go('fly', undefined, true)}>退出</Button></>}
      </div>
      <div className="gmk-hint">两个人一台手机轮流点 · 适合窝在一起玩</div>
    </Card>
  )
}
