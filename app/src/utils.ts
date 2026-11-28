// 自研工具层：农历换算 / EXIF 本地解析 / 口令哈希。零外联。

// ---------- 农历（公开通用算法 + 标准农历数据表 1900-2059） ----------
const LUNAR_INFO: number[] = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,//1900-1909
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,//1910-1919
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,//1920-1929
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,//1930-1939
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,//1940-1949
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,//1950-1959
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,//1960-1969
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,//1970-1979
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b279,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,//1980-1989
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,//1990-1999
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,//2000-2009
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,//2010-2019
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,//2020-2029
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,//2030-2039
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,//2040-2049
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,//2050-2059
]
const LUNAR_LAST = 1900 + LUNAR_INFO.length - 1
const LGY = Date.UTC(1900, 0, 31) // 农历 1900-01-01 = 公历 1900-01-31（UTC 避免时区偏移）
const lYearDays = (y: number) => { let s = 348; for (let i = 0x8000; i > 0x8; i >>= 1) s += (LUNAR_INFO[y - 1900] & i) ? 1 : 0; return s + leapDays(y) }
const leapMonth = (y: number) => LUNAR_INFO[y - 1900] & 0xf
const leapDays = (y: number) => leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0
const monthDays = (y: number, m: number) => (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29
export const solarToLunar = (date: Date) => {
  const gy = date.getFullYear()
  // 表只到 2059：超出范围返回空值，避免越界静默算错
  if (gy < 1900 || gy > LUNAR_LAST) return { lYear: 0, lMonth: 1, lDay: 1, isLeap: false, text: '—' }
  let offset = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - LGY) / 86400000)
  let y = 1900
  for (; y <= LUNAR_LAST && offset > 0; y++) offset -= lYearDays(y)
  if (offset < 0) offset += lYearDays(--y)
  const leap = leapMonth(y)
  let isLeap = false, m = 1
  for (; m < 13 && offset > 0; m++) {
    let d
    if (leap > 0 && m === leap + 1 && !isLeap) { --m; isLeap = true; d = leapDays(y) }
    else d = monthDays(y, m)
    if (isLeap && m === leap + 1) isLeap = false
    offset -= d
  }
  if (offset === 0 && leap > 0 && m === leap + 1) { if (isLeap) isLeap = false; else { isLeap = true; --m } }
  if (offset < 0) { offset += monthDays(y, --m) }
  const LM = ['正','二','三','四','五','六','七','八','九','十','冬','腊']
  const LD = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十']
  return { lYear: y, lMonth: m, lDay: offset + 1, isLeap, text: `${isLeap ? '闰' : ''}${LM[m - 1]}月${LD[offset]}` }
}
// 农历月日 → 指定农历年里的公历 Date（按常规月，忽略闰月纪念日场景）
export const lunarToSolar = (lYear: number, lMonth: number, lDay: number) => {
  if (lYear < 1900 || lYear > LUNAR_LAST) return new Date(NaN)
  let offset = 0
  for (let y = 1900; y < lYear; y++) offset += lYearDays(y)
  const leap = leapMonth(lYear)
  for (let m = 1; m < lMonth; m++) {
    offset += monthDays(lYear, m)
    if (leap === m) offset += leapDays(lYear)
  }
  return new Date(LGY + (offset + lDay - 1) * 86400000)
}
// 农历纪念日的下次公历倒数天数
export function nextOccurLunar(md: string, yearly: boolean) {
  const [m, d] = md.split('-').map(Number)
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startY = solarToLunar(now).lYear
  if (!startY) return NaN
  for (let y = startY; y <= Math.min(startY + 2, LUNAR_LAST); y++) {
    if (d > monthDays(y, m)) continue
    const s = lunarToSolar(y, m, d).getTime()
    if (s >= today0) return Math.round((s - today0) / 86400000)
    if (!yearly) return Math.round((s - today0) / 86400000)
  }
  return NaN
}
export const lunarToday = () => solarToLunar(new Date()).text

// ---------- EXIF（JPEG 本地解析：时间/机型/GPS） ----------
export async function readExif(file: File): Promise<{ date?: string; cam?: string; gps?: [number, number] } | null> {
  try {
    const buf = new DataView(await file.arrayBuffer())
    if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null
    // 顺序扫 JPEG 段，遇到 EXIF(APP1) 就把 TIFF 头定位在段内偏移 10
    let p = 2, tiff = -1, le = false
    while (p + 4 <= buf.byteLength) {
      if (buf.getUint8(p) !== 0xff) { p++; continue }
      const marker = buf.getUint16(p)
      if (marker === 0xffd8 || marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd7)) { p += 2; continue }
      if (marker === 0xffda) break // 到扫描数据区，后面不会再有 EXIF
      const size = buf.getUint16(p + 2)
      if (size < 2) break
      if (marker === 0xffe1 && buf.getUint16(p + 4) === 0x4578) { tiff = p + 10; le = buf.getUint16(tiff) === 0x4949; break }
      p += 2 + size
    }
    if (tiff < 0) return null
    const u8 = (o: number) => buf.getUint8(o)
    const u16 = (o: number) => buf.getUint16(o, le)
    const u32 = (o: number) => buf.getUint32(o, le)
    const ifd0 = tiff + u32(tiff + 4)
    const tags = (dir: number) => { const out: any = {}; const n = u16(dir); for (let i = 0; i < n; i++) out[u16(dir + 2 + i * 12)] = dir + 2 + i * 12; return out }
    const str = (entry: number) => { const cnt = u32(entry + 4), o = cnt <= 4 ? entry + 8 : tiff + u32(entry + 8); let s = ''; for (let i = 0; i < cnt - 1 && i < 32; i++) s += String.fromCharCode(u8(o + i)); return s }
    const out: any = {}
    const t0 = tags(ifd0)
    if (t0[271]) out.cam = str(t0[271]) + (t0[272] ? ' ' + str(t0[272]) : '')
    if (t0[306]) out.date = str(t0[306])
    if (t0[34665]) { const ex = tags(tiff + u32(t0[34665] + 8)); if (ex[36867]) out.date = str(ex[36867]) }
    if (t0[34853]) {
      const g = tags(tiff + u32(t0[34853] + 8))
      // GPSLatitude/Longitude 的 value 是 3 个连续 RATIONAL（度/分/秒），
      // Ref(1=lat, 3=lon) 是 ASCII，直接内联在 entry 的 value 区（entry+8）。
      const ratAt = (entry: number, i: number) => { const o = tiff + u32(entry + 8) + i * 8; return u32(o) / u32(o + 4) }
      const dms = (entry: number, refEntry: number) => {
        const ref = u8(refEntry + 8)
        const neg = ref === 0x53 || ref === 0x57 // 'S' / 'W'
        return (ratAt(entry, 0) + ratAt(entry, 1) / 60 + ratAt(entry, 2) / 3600) * (neg ? -1 : 1)
      }
      if (g[1] && g[2] && g[3] && g[4]) {
        const r4 = (n: number) => Math.round(n * 1e4) / 1e4
        out.gps = [r4(dms(g[2], g[1])), r4(dms(g[4], g[3]))]
      }
    }
    return Object.keys(out).length ? out : null
  } catch (_) { return null }
}

// ---------- 口令哈希 ----------
export async function sha256(text: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
}
/** PBKDF2-SHA256(120k) —— 带随机盐，避免 4 位口令被离线暴破 */
export async function hashPwd(pw: string, salt: string) {
  if (!crypto?.subtle) throw new Error('当前地址不是安全上下文（需 https 或 localhost），无法加密口令')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' },
    key, 256,
  )
  return Array.from(new Uint8Array(bits)).map((x) => x.toString(16).padStart(2, '0')).join('')
}
export const newSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('')
