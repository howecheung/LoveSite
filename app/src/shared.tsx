// Shared helpers: date/format utils, mood tables, EXIF text, image compress, CountNum, Clock
import { useEffect, useState } from 'react'
import { nextOccurLunar } from './utils'

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
const today = () => {
  const d = new Date(), z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
const daysSince = (d: string) => {
  const t = new Date(dayStr(d) + 'T00:00:00').getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}
function nextOccur(day: string, yearly: boolean) {
  const d = new Date(dayStr(day) + 'T00:00:00'); const now = new Date()
  if (!Number.isFinite(d.getTime())) return NaN
  if (!yearly) return Math.ceil((d.getTime() - Date.now()) / 86400000)
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate())
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (next.getTime() < t0.getTime()) next.setFullYear(now.getFullYear() + 1)
  return Math.round((next.getTime() - t0.getTime()) / 86400000)
}
const sinceParts = (d: string) => {
  const ms = Date.now() - new Date(dayStr(d) + 'T00:00:00').getTime()
  if (!Number.isFinite(ms) || ms < 0) return { h: 0, m: 0, s: 0 }
  return { h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60 }
}
export const MAX_ALBUM_PHOTOS = 30

async function compressImg(fl: File): Promise<File> {
  try {
    if (fl.type === 'image/gif' || fl.size < 1.5 * 1048576) return fl
    // 省流模式压得更狠；高清模式保留更多细节
    const hd = (() => { try { return localStorage.getItem('ai-img') === 'hd' } catch { return false } })()
    const MAX = hd ? 2400 : 1600
    const Q = hd ? 0.88 : 0.82
    const bmp: any = await createImageBitmap(fl)
    const sc = Math.min(1, MAX / Math.max(bmp.width || MAX, bmp.height || MAX))
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round((bmp.width || MAX) * sc)); cv.height = Math.max(1, Math.round((bmp.height || MAX) * sc))
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
    if (bmp.close) bmp.close()
    const blob: any = await new Promise((r) => cv.toBlob(r, 'image/jpeg', Q))
    if (!blob) return fl
    return new File([blob], fl.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() })
  } catch { return fl }
}

// 真实提醒：今天还没打卡、三五天内的纪念日、对方最近发的内容
const NOTICE_KEY = 'ai-notice-clear'
export const APP_VER = __APP_VERSION__
const noticeCleared = (id: string) => {
  try { const m = JSON.parse(localStorage.getItem(NOTICE_KEY) || '{}'); return m[id] === today() } catch { return false }
}
export function clearNotices(list: any[]) {
  try {
    const m: any = JSON.parse(localStorage.getItem(NOTICE_KEY) || '{}')
    const t = today()
    for (const n of list) m[n.id] = t
    localStorage.setItem(NOTICE_KEY, JSON.stringify(m))
  } catch { /* 隐私模式下 localStorage 不可写，忽略 */ }
}
function buildNotices(data: any, me: any) {
  const out: any[] = []
  const t = today()
  const myId = me?.id
  const myName = me?.nickName || me?.username || ''
  // 新记录写 member.id；旧记录写昵称，两种都兼容
  const mine = (who: string) => !!who && (who === myId || who === myName)
  const plans: any[] = data?.checkins || []
  const recs: any[] = data?.ckrecords || []
  const undone = plans.filter((p) => !recs.some((r) => r.plan === p.id && mine(r.who) && r.day === t))
  if (undone.length) out.push({ id: 'ck', ic: '✅', t: `今天还有 ${undone.length} 个计划没打卡`, s: undone.map((p) => p.name).join(' · '), go: 'checkin' })
  for (const m of data?.moments || []) {
    let n = NaN
    try { n = m.lunar && m.lunarMD ? nextOccurLunar(m.lunarMD, m.yearly) : nextOccur(m.day, m.yearly) } catch { n = NaN }
    if (Number.isFinite(n) && n >= 0 && n <= 3) out.push({ id: 'mo' + m.id, ic: m.emoji || '💗', t: n === 0 ? `今天是「${m.name}」` : `还有 ${n} 天：${m.name}`, s: m.note || '', go: 'countdown' })
  }
  // 私密日记不参与“TA 最近发了 N 篇”的统计，避免泄漏存在性
  const other = (me?.id ? (data?.diaries || []).filter((d: any) => d.member && d.member !== myId && !d.private) : [])
  const recent = other.filter((d: any) => Date.now() - new Date(d.created).getTime() < 3 * 86400000)
  if (recent.length) out.push({ id: 'di', ic: '📔', t: `TA 最近发了 ${recent.length} 篇日常`, s: recent[0].title || recent[0].text?.slice(0, 18) || '', go: 'diary' })
  return out.filter((n) => !noticeCleared(n.id))
}

// 天数滚动计数：easeOutExpo（与官方 CountUp 同曲线），输出普通 <b> 保持行内排版
const CountNum = ({ end }: { end: number }) => {
  const [v, setV] = useState(0)
  const target = Number.isFinite(end) ? end : 0
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf = 0
    const t0 = performance.now(), D = 1100
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / D)
      // easeOutExpo 在 k=1 时仍是 0.999…，直接乘会少 1；收尾必须落到准确值
      setV(k >= 1 ? target : Math.max(0, Math.round(target * (1 - Math.pow(2, -10 * k)))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return <b>{v}</b>
}

function Clock({ start }: any) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [])
  if (!start) return <>0小时0分0秒</>
  const q = sinceParts(start)
  return <>{q.h}小时{q.m}分{q.s}秒</>
}

export { exifLine, lmdText, MOODS, MOOD_CN, MOOD_IC, MOOD_TAG, dayStr, fmtDT, today, daysSince, nextOccur, sinceParts, compressImg, CountNum, Clock, buildNotices }
