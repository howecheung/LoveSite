// Shared helpers: date/format utils, mood tables, EXIF text, image compress, CountNum, Clock
import { useEffect, useState } from 'react'

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
  const ms = Date.now() - new Date(dayStr(d) + 'T00:00:00').getTime()
  if (ms < 0) return { h: 0, m: 0, s: 0 }
  return { h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60 }
}

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

function Clock({ start }: any) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [])
  if (!start) return <>0小时0分0秒</>
  const q = sinceParts(start)
  return <>{q.h}小时{q.m}分{q.s}秒</>
}

export { exifLine, lmdText, MOODS, MOOD_CN, MOOD_IC, MOOD_TAG, dayStr, fmtDT, today, daysSince, nextOccur, sinceParts, compressImg, CountNum, Clock }
