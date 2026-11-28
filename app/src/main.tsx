import React from 'react'
import ReactDOM from 'react-dom/client'
import 'animal-island-ui/style'
import './emoji.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)

// 顶部胶囊提示：有新版本时点一下刷新（只在生产构建里启用，开发模式不注册 SW）
// 同一时间只保留一条：更新检查连续触发时，新提示替换旧提示，避免重叠
let tipEl: HTMLDivElement | null = null
let tipTimer = 0
function tip(msg: string) {
  if (tipEl) tipEl.remove()
  clearTimeout(tipTimer)
  const d = document.createElement('div')
  d.textContent = msg
  d.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;background:#c2456e;color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer'
  d.onclick = () => location.reload()
  document.body.appendChild(d)
  tipEl = d
  tipTimer = window.setTimeout(() => {
    d.remove()
    if (tipEl === d) tipEl = null
  }, 12000)
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // 首次安装时 clients.claim() 也会触发 controllerchange，不能提示“已更新”
  const hadController = !!navigator.serviceWorker.controller
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        if (!w) return
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) tip('小站有新版本，点这里刷新')
        })
      })
    }).catch(() => {})
    let done = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (done || !hadController) return
      done = true
      tip('已更新到新版本，点这里重新载入')
    })
  })
}
