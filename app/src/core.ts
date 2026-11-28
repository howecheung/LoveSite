// 全站共享内核：PocketBase 单例、静默错误胶囊（quiet）、主动提示（showToast）
import PocketBase from 'pocketbase'

export const pb = new PocketBase(window.location.origin)
// 关掉「同 URL 并发请求自动取消」：首页一次拉 9 个集合，默认策略会互相 abort
pb.autoCancellation(false)
const ABORT = /abort|cancel/i
export const quiet = (e: any) => {
  if (ABORT.test(String(e?.message || e))) return
  // token 失效时统一回登录页；由 App 监听 authStore 变化
  if (e?.status === 401) {
    try { pb.authStore.clear() } catch { /* ignore */ }
    showToast('登录已过期，请重新登录')
    return
  }
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

// 隐私模式 / 禁用存储时 localStorage 访问会抛异常；统一走这里，避免白屏
const wrap = (getStore: () => Storage) => ({
  get(k: string) { try { return getStore().getItem(k) } catch { return null } },
  set(k: string, v: string) { try { getStore().setItem(k, v) } catch { /* ignore */ } },
  del(k: string) { try { getStore().removeItem(k) } catch { /* ignore */ } },
})
export const LS = wrap(() => localStorage)
export const SS = wrap(() => sessionStorage)

// settings 是单例：固定 id 新建，旧的随机 id 记录由迁移收敛为一条。
export const SETTINGS_ID = 'lovesitesetting'
export async function getSettings(): Promise<any | null> {
  try { return await pb.collection('settings').getOne(SETTINGS_ID) }
  catch (e: any) {
    if (e?.status !== 404) throw e
    const rows = await pb.collection('settings').getFullList({ sort: 'id' }).catch(() => [])
    return (rows as any[])[0] || null
  }
}
export async function saveSettings(patch: any): Promise<any> {
  const cur = await getSettings()
  try {
    if (cur) return await pb.collection('settings').update(cur.id, patch)
  } catch (e: any) {
    if (e?.status !== 404) throw e
  }
  try {
    return await pb.collection('settings').create({ id: SETTINGS_ID, ...patch })
  } catch (e: any) {
    // 另一台设备刚建好：改为更新，避免并发首存产生第二条
    const again = await getSettings()
    if (!again) throw e
    return pb.collection('settings').update(again.id, patch)
  }
}

