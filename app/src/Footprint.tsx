// 足迹地图：把相册 / 日常照片里的 GPS 坐标落到地图上
// 默认走高德 JS API（需要 .env.local 里的 VITE_AMAP_KEY）；没配 key 时回落到 Leaflet + OpenStreetMap。
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import AMapLoader from '@amap/amap-jsapi-loader'
import { Card, Button, Tag } from 'animal-island-ui'
import { pb } from './core'
import { Ic } from './Icons'

type Spot = { key: string; lat: number; lng: number; url: string; big: string; from: string; date: string }

declare global {
  interface Window { _AMapSecurityConfig?: { securityJsCode: string }; AMap?: any }
}

const KEY = import.meta.env.VITE_AMAP_KEY as string | undefined
const SEC = import.meta.env.VITE_AMAP_SEC as string | undefined

// EXIF 存的是 WGS-84，高德底图是 GCJ-02，不做这一步标记会偏 300–600 米
function wgs2gcj(lng: number, lat: number): [number, number] {
  const PI = 3.14159265358979323846
  const aa = 6378245.0
  const ee = 0.00669342162296594323
  const out = lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
  if (out) return [lng, lat]
  const tLat = (x: number, y: number) => {
    let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    r += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
    r += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
    r += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
    return r
  }
  const tLng = (x: number, y: number) => {
    let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    r += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
    r += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
    r += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
    return r
  }
  let dLat = tLat(lng - 105.0, lat - 35.0)
  let dLng = tLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sq = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((aa * (1 - ee)) / (magic * sq) * PI)
  dLng = (dLng * 180.0) / (aa / sq * Math.cos(radLat) * PI)
  return [lng + dLng, lat + dLat]
}

// 从 albums.exifs / diaries.exif 里挑出带 GPS 的照片
function collect(data: any): Spot[] {
  const out: Spot[] = []
  const ok = (g: any) => Array.isArray(g) && g.length >= 2 && isFinite(Number(g[0])) && isFinite(Number(g[1])) && !(Number(g[0]) === 0 && Number(g[1]) === 0)
  for (const a of data.albums || []) {
    let ex: any = {}
    try { ex = JSON.parse(a.exifs || '{}') } catch { ex = {} }
    for (const p of a.photos || []) {
      const e = ex[p]
      if (!e || !ok(e.gps)) continue
      out.push({
        key: a.id + p, lat: Number(e.gps[0]), lng: Number(e.gps[1]),
        url: pb.files.getURL(a, p, { thumb: '240x240' }), big: pb.files.getURL(a, p),
        from: a.name || '相册', date: String(e.date || a.created || '').slice(0, 10),
      })
    }
  }
  for (const d of data.diaries || []) {
    if (!d.photo) continue
    let e: any = null
    try { e = JSON.parse(d.exif || 'null') } catch { e = null }
    if (!e || !ok(e.gps)) continue
    out.push({
      key: d.id, lat: Number(e.gps[0]), lng: Number(e.gps[1]),
      url: pb.files.getURL(d, d.photo, { thumb: '240x240' }), big: pb.files.getURL(d, d.photo),
      from: '恋爱日常', date: String(e.date || d.created || '').slice(0, 10),
    })
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// 高德 Marker 的 content 是裸 DOM，样式写内联更稳（全局 css 里的 .fpmk-in 只服务 Leaflet）
const PIN_CSS = 'display:block;width:58px;text-align:center;cursor:pointer'
const IMG_CSS = 'width:52px;height:52px;object-fit:cover;border-radius:14px;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.28);background:#fff;display:block;margin:0 auto'
const BADGE_CSS = 'display:inline-block;margin-top:2px;font-size:10.5px;line-height:14px;color:#fff;background:#c2456e;border-radius:8px;padding:0 5px'
const pin = (s: Spot) => `<span data-k="${s.key}" style="${PIN_CSS}"><img src="${s.url}" alt="" style="${IMG_CSS}"/><b style="${BADGE_CSS}">${s.date.slice(5)}</b></span>`

// ---------- 高德 ----------
function AmapView({ spots, onPick, onFit }: any) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        window._AMapSecurityConfig = { securityJsCode: SEC || '' }
        const AMap = await AMapLoader.load({ key: KEY!, version: '2.0' })
        if (dead || !box.current) return
        const night = document.body.classList.contains('night')
        const m = new AMap.Map(box.current, {
          zoom: 4, center: [108.5, 32.5], viewMode: '2D', zooms: [3, 18],
          mapStyle: night ? 'amap://styles/dark' : 'amap://styles/whitesmoke',
        })
        map.current = m
        for (const s of spots) {
          const [lng, lat] = wgs2gcj(s.lng, s.lat)
          const mk = new AMap.Marker({
            position: [lng, lat], content: pin(s), anchor: 'bottom-center', title: `${s.from} · ${s.date}`,
          })
          m.add(mk)
        }
        const fit = () => m.setFitView(undefined, false, [70, 70, 70, 70], 13)
        onFit(fit)
        if (spots.length) fit()
      } catch (e: any) {
        onFit(() => {})
        console.warn('amap load failed', e)
      }
    })()
    return () => { dead = true; map.current?.destroy?.(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots])
  // 自定义 content 的点击不一定会冒泡成 AMap 的 marker click，这里用委托兜住
  const pick = (e: any) => {
    const el = e.target.closest?.('[data-k]')
    if (!el) return
    const s = spots.find((x: Spot) => x.key === el.getAttribute('data-k'))
    if (s) onPick(s)
  }
  return <div className="fpbox" ref={box} onClick={pick} />
}

// ---------- OpenStreetMap 回落 ----------
function OsmView({ spots, onPick, onFit }: any) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  useEffect(() => {
    if (!box.current || map.current) return
    const m = L.map(box.current, { zoomControl: false, worldCopyJump: true }).setView([30, 110], 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(m)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    map.current = m
    const t = setTimeout(() => m.invalidateSize(), 240)
    return () => { clearTimeout(t); m.remove(); map.current = null }
  }, [])
  useEffect(() => {
    const m = map.current
    if (!m) return
    const layer = L.layerGroup().addTo(m)
    for (const s of spots) {
      const icon = L.divIcon({ className: 'fpmk', html: pin(s), iconSize: [58, 64], iconAnchor: [29, 58] })
      L.marker([s.lat, s.lng], { icon, title: `${s.from} · ${s.date}` }).on('click', () => onPick(s)).addTo(layer)
    }
    const fit = () => {
      if (spots.length) m.fitBounds(L.latLngBounds(spots.map((s: Spot) => [s.lat, s.lng] as [number, number])), { padding: [46, 46], maxZoom: 13 })
    }
    onFit(fit)
    fit()
    return () => { m.removeLayer(layer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots])
  return <div className="fpbox" ref={box} />
}

export function Footprint({ data }: any) {
  const spots = useMemo(() => collect(data), [data])
  const [cur, setCur] = useState<Spot | null>(null)
  const [big, setBig] = useState('')
  const fit = useRef<() => void>(() => {})

  return (
    <>
      <Card className="blk" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="fpbar">
          <Tag color="app-blue"><Ic v="👣" size={13} /> {spots.length} 个足迹</Tag>
          <span className="mut" style={{ fontSize: 11 }}>{KEY ? '高德地图' : 'OpenStreetMap'}</span>
          <span className="grow" />
          {cur && <Button size="small" type="text" onClick={() => setCur(null)}>收起</Button>}
          <Button size="small" ghost onClick={() => fit.current()}>看全部</Button>
        </div>
        {KEY
          ? <AmapView spots={spots} onPick={setCur} onFit={(f: any) => { fit.current = f }} />
          : <OsmView spots={spots} onPick={setCur} onFit={(f: any) => { fit.current = f }} />}
      </Card>
      {!spots.length && <Card className="blk"><div className="mut" style={{ textAlign: 'center', padding: 18 }}>
        照片里还没有位置信息。<br />用手机拍照（相机开着定位）再上传，这里就会长出地图。
      </div></Card>}
      {cur && <Card className="blk fpc">
        <img src={cur.big} alt="" onClick={() => setBig(cur.big)} />
        <div className="fpc-t">
          <b>{cur.from}</b>
          <div className="mut">{cur.date} · {cur.lat.toFixed(4)}, {cur.lng.toFixed(4)}</div>
        </div>
      </Card>}
      {big && <div className="lightbox" onClick={() => setBig('')}><img src={big} alt="" /></div>}
    </>
  )
}
