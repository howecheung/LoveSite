// 全站共享内核：PocketBase 单例、静默错误胶囊（quiet）、主动提示（showToast）
import PocketBase from 'pocketbase'

export const pb = new PocketBase(window.location.origin, null as any, { autoCancellation: false } as any)
const ABORT = /abort|cancel/i
export const quiet = (e: any) => {
  if (ABORT.test(String(e?.message || e))) return
  console.warn(e)
  try {
    const msg = String(e?.message || e || '未知错误').slice(0, 60)
    const human = /failed to fetch|network/i.test(msg) ? '网络断了，稍后再试'
      : /not found/i.test(msg) ? '内容没找到，下拉刷新试试'
      : /validation|Failed|规则/i.test(msg) ? '填写内容有地方不对' : msg
    showToast('没成功：' + human)
  } catch { /* 提示本身绝不破坏主流程 */ }
}
export function showToast(msg: string) { try {
  let el = document.getElementById('errtoast')
  if (!el) { el = document.createElement('div'); el.id = 'errtoast'; document.body.appendChild(el) }
  el.textContent = msg.slice(0, 60)
  el.classList.add('show')
  clearTimeout((el as any)._t)
  ;(el as any)._t = setTimeout(() => el!.classList.remove('show'), 2600)
} catch { /* ignore */ } }

