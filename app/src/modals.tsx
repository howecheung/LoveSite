// Bottom-sheet forms: diary / album / wish / moment / lock / profile ...
import { useEffect, useState } from 'react'
import { Button, Input, Tag, Modal } from 'animal-island-ui'
import { pb, showToast } from './core'
import { Ic } from './Icons'
import { sha256, readExif, hashPwd, newSalt } from './utils'
import { Av } from './pages'
import { fmtDT, dayStr, today, daysSince, MOODS, MOOD_CN, MOOD_IC, MOOD_TAG, compressImg, buildNotices } from './shared'

function ModalCard({ kind, rec, data, me, close, reload, go, setUnlocked, mode, setMode }: any) {
  const [f, setF] = useState<any>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const s = data.setting || {}
    setF({})
    if (kind === 'about') setF({ names: s.names || '', startDate: dayStr(s.startDate), quote: s.quote || '', story: s.story || '', boyName: s.boyName || '男孩', girlName: s.girlName || '女孩' })
    if (kind === 'profile') setF({ nickName: me.nickName || '', gender: me.gender || '' })
    if (kind === 'diary') setF({ text: '', mood: 'happy', private: false, title: '' })
    if (kind === 'sitename') setF({ siteName: s.siteName || '' })
    if (kind === 'moment') setF({ yearly: true, lunar: false })
    if (kind === 'lockSet') setF({ p1: '', p2: '', on: !!data.setting?.lockOn })
    if (kind === 'search') setF({ q: '' })
    if (kind === 'diary-edit' && rec) setF({ title: rec.title || '', text: rec.text || '', mood: rec.mood || 'happy', private: !!rec.private, photo: null })
    if (kind === 'wish-edit' && rec) setF({ text: rec.text || '' })
    if (kind === 'moment-edit' && rec) {
      const md = String(rec.lunarMD || '').split('-')
      setF({ name: rec.name || '', lunar: !!rec.lunar, lm: md[0] || '', ld: md[1] || '', day: dayStr(rec.day), yearly: rec.yearly !== false, emoji: rec.emoji || '💗', note: rec.note || '' })
    }
    if (kind === 'album-edit' && rec) setF({ name: rec.name || '', note: rec.note || '', cover: rec.cover || '' })
    if (kind === 'checkin-more' && rec) setF({ name: rec.name || '', emoji: rec.emoji || '' })
  }, [kind, rec])

  const save = async (fn: () => Promise<any>) => {
    setBusy(true)
    try { await fn(); await reload(); close() } catch (e: any) {
      const inner: any = e?.data?.data || e?.data || {}
      const det = Object.entries(inner)
        .map(([, v]: any) => (v && typeof v === 'object' ? (v.message || JSON.stringify(v)) : String(v)))
        .filter((x: string) => x && !/failed to create|failed to update/i.test(x)).join('；')
      showToast(det ? `没存上：${det.slice(0, 60)}` : `没存上：${String(e?.message || e).slice(0, 40)}`)
    }
    setBusy(false)
  }
  const TITLE: any = { notice: '通知', days: '恋爱天数', diary: '写日常', album: '新建相册', wish: '添加约定', moment: '添加日子', checkin: '新打卡计划', profile: '我的资料', sitename: '站点名称', about: '关于我们', search: '搜索小站', games: '小游戏', gomoku: '五子棋', 'gomoku-play': '五子棋 · 对局', 'gomoku-local': '五子棋 · 同屏', 'album-view': '相册', lockIn: '解锁私密内容', lockSet: '私密口令', 'diary-edit': '编辑日常', 'wish-edit': '编辑约定', 'moment-edit': '编辑日子', 'checkin-more': '打卡记录', 'msg-del': '删除祝福', 'album-edit': '编辑相册', appearance: '外观模式' }
  const del = (col: string, id: string, label: string) => {
    if (!confirm(`确定删除这条${label}吗？删了就找不回来了。`)) return
    save(async () => { await pb.collection(col).delete(id) })
  }

  return (
    <Modal open onClose={close} typewriter={false} title={TITLE[kind] || ''}
      footer={kind === 'appearance' ? (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {([['light', '浅色'], ['dark', '深色'], ['auto', '跟随系统']] as const).map(([v, t]) => (
            <Button key={v} type={mode === v ? 'primary' : 'default'} ghost={mode !== v}
              onClick={() => { setMode(v); close() }}>{mode === v ? '✓ ' : ''}{t}</Button>
          ))}
        </div>
      ) : undefined}>
      {kind === 'appearance' && <div className="mut" style={{ lineHeight: 1.85 }}>
        三种模式选一个：浅色 / 深色固定不变；跟随系统会跟着手机或电脑的深浅色自动切换。
        右上角的 ☀️ / 🌙 按钮也能随时快速切到浅色或深色。
      </div>}
      {kind === 'search' && <>
        <Input placeholder="搜日常 / 相册 / 清单 / 祝福 / 日子…" autoFocus value={f.q || ''} onChange={(e: any) => setF({ ...f, q: e.target.value })} />
        <div style={{ marginTop: 10 }}>
          {(f.q || '').trim().length >= 1 && (() => {
            const q = f.q.trim()
            const D = data.diaries.filter((x: any) => (x.text + ' ' + (x.title || '')).includes(q)).slice(0, 6)
            const A = data.albums.filter((x: any) => x.name.includes(q)).slice(0, 4)
            const W = data.wishes.filter((x: any) => x.text.includes(q)).slice(0, 6)
            const M = data.messages.filter((x: any) => x.text.includes(q)).slice(0, 6)
            const N = (data.moments || []).filter((x: any) => (x.name || '').includes(q)).slice(0, 6)
            const P = (data.checkins || []).filter((x: any) => (x.name || '').includes(q)).slice(0, 6)
            const C = (data.comments || []).filter((x: any) => (x.text || '').includes(q)).slice(0, 6)
            const total = D.length + A.length + W.length + M.length + N.length + P.length + C.length
            return <>
              {D.map((x: any) => (
                <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('diary') }}>
                  <span className="dot"><Ic v={MOOD_IC[x.mood] || '📔'} /></span>
                  <span className="grow"><b>{x.title || x.text.slice(0, 20)}</b><div className="mut">日常 · {fmtDT(x.created)}</div></span>
                </div>))}
              {A.map((x: any) => (
                <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('album') }}>
                  <span className="dot"><Ic v="🎬" /></span>
                  <span className="grow"><b>{x.name}</b><div className="mut">相册 · {(x.photos || []).length} 张</div></span>
                </div>))}
              {W.map((x: any) => (
                <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('promise') }}>
                  <span className="dot"><Ic v={x.done ? '✅' : '⏳'} /></span>
                  <span className="grow">{x.text}<div className="mut">清单</div></span>
                </div>))}
              {M.map((x: any) => (
                <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('message') }}>
                  <span className="dot"><Ic v="💌" /></span>
                  <span className="grow">{x.text.slice(0, 30)}<div className="mut">祝福</div></span>
                </div>))}
              {N.map((x: any) => (
                <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('countdown') }}>
                  <span className="dot"><Ic v={x.emoji || '💗'} /></span>
                  <span className="grow">{x.name}<div className="mut">日子</div></span>
                </div>))}
              {P.map((x: any) => (
                <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('checkin') }}>
                  <span className="dot"><Ic v={x.emoji || '📌'} /></span>
                  <span className="grow">{x.name}<div className="mut">打卡计划</div></span>
                </div>))}
              {C.map((x: any) => (
                <div className="li" key={x.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go('diary') }}>
                  <span className="dot"><Ic v="💬" /></span>
                  <span className="grow">{x.text.slice(0, 30)}<div className="mut">评论</div></span>
                </div>))}
              {!total && <div className="mut" style={{ textAlign: 'center', padding: 16 }}>没搜到「{q}」相关内容</div>}
            </>
          })()}
        </div>
      </>}
      {kind === 'lockIn' && <>
        <div className="mut" style={{ marginBottom: 10 }}>输入私密口令后，本次浏览会话内不再重复询问</div>
        <input className="ta2" type="password" placeholder="解锁口令" autoFocus value={f.pw || ''} onChange={(e) => setF({ ...f, pw: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={async () => {
            setBusy(true)
            try {
              const salt = data.setting?.lockSalt
              const h = salt ? await hashPwd((f.pw || '').trim(), salt) : await sha256((f.pw || '').trim())
              if (h === data.setting?.lockHash) { sessionStorage.setItem('lk', '1'); setUnlocked(true); close() }
              else setF((x: any) => ({ ...x, msg: '口令不对，再试试' }))
            } catch (e: any) { setF((x: any) => ({ ...x, msg: String(e?.message || e) })) }
            setBusy(false)
          }}>解 锁</Button>
        </div>
        {f.msg && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{f.msg}</div>}
      </>}
      {kind === 'lockSet' && <>
        <div className="mut" style={{ marginBottom: 10 }}>设一个两人知道的口令。之后所有「私密」日常对 TA 上锁，输入口令才可见。</div>
        <input className="ta2" type="password" placeholder="新口令（至少 4 位）" value={f.p1 || ''} onChange={(e) => setF({ ...f, p1: e.target.value })} />
        <input className="ta2" type="password" placeholder="再输一次" value={f.p2 || ''} onChange={(e) => setF({ ...f, p2: e.target.value })} />
        {!data.setting?.lockHash ? null : (
          <div className="li" style={{ border: 0, marginTop: 6 }}>
            <button className={'tick' + (f.on ? ' on' : '')} onClick={() => setF({ ...f, on: !f.on })}>{f.on ? '✓' : ''}</button>
            <span style={{ fontSize: 14 }}>启用私密口令锁</span>
          </div>)}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => save(async () => {
            const st = data.setting || {}
            if (f.p1 && f.p1 !== f.p2) throw new Error('两次口令不一致，请重输')
            const patch: any = { lockOn: f.p1 ? true : !!f.on }
            if (f.p1) { const salt = st.lockSalt || newSalt(); patch.lockSalt = salt; patch.lockHash = await hashPwd(f.p1.trim(), salt) }
            if (st.id) await pb.collection('settings').update(st.id, patch)
            else await pb.collection('settings').create(patch)
          })}>{data.setting?.lockHash ? '保存设置' : '设 置'}</Button>
        </div>
        {f.msg && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{f.msg}</div>}
      </>}
      {kind === 'notice' && <>
        {buildNotices(data, me).map((n: any) => (
          <div className="li" key={n.id} style={{ cursor: 'pointer' }} onClick={() => { close(); go(n.go) }}>
            <span className="dot"><Ic v={n.ic} /></span>
            <span className="grow"><b>{n.t}</b>{n.s ? <div className="mut">{n.s}</div> : null}</span>
            <span className="mut">›</span>
          </div>))}
        {!buildNotices(data, me).length && <div className="mut" style={{ textAlign: 'center', padding: 18 }}>今天没有特别的事，去写点日常吧 🌿</div>}
      </>}
      {kind === 'days' && <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <b style={{ fontSize: 44, color: 'var(--accent)' }}>{data.setting ? daysSince(data.setting.startDate) : 0}</b>
        <div className="mut">起始日 {dayStr(data.setting?.startDate) || '未设置'}，可在「关于我们」修改</div>
      </div>}
      {kind === 'diary' && <>
        <Input placeholder="标题（可留空）" value={f.title || ''} onChange={(e: any) => setF({ ...f, title: e.target.value })} />
        <textarea className="ta" style={{ margin: '4px 0 10px' }} value={f.text || ''} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="今天发生了什么值得记住的事？" />
        <div className="chips" style={{ marginBottom: 10 }}>
          {MOODS.map((m) => <Tag key={m} color={f.mood === m ? 'app-pink' : MOOD_TAG[m]} onClick={() => setF({ ...f, mood: m })} style={{ cursor: 'pointer' }}><Ic v={MOOD_IC[m]} size={13} /> {MOOD_CN[m]}</Tag>)}
        </div>
        <div className="li" style={{ border: 0 }}>
          <button className={"tick" + (f.private ? " on" : "")} onClick={() => setF({ ...f, private: !f.private })}>{f.private ? "✓" : ""}</button>
          <span style={{ fontSize: 14 }}>🔒 仅自己可见</span>
          <span className="grow" />
          <label className="picbtn"><Ic v="📎" size={13} /> 附图
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => { const f0 = e.target.files?.[0]; setF({ ...f, photo: f0 ? await compressImg(f0) : null }) }} /></label>
        </div>
        {f.photo && <div className="mut" style={{ margin: '4px 0' }}>已选：{f.photo.name}</div>}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.text || '').trim()} onClick={() => save(async () => {
            const fd: any = { text: f.text.trim(), mood: f.mood, title: f.title || '', private: !!f.private, member: pb.authStore.record?.id }
            if (f.photo) { fd.photo = f.photo; const ex = await readExif(f.photo); if (ex) fd.exif = JSON.stringify(ex) }
            await pb.collection('diaries').create(fd)
          })}>保 存</Button>
        </div>
      </>}
      {kind === 'album' && <>
        <Input placeholder="相册名，比如：第一次旅行" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <textarea className="ta" placeholder="写两句此刻的心情…（可选）" value={f.note || ''} onChange={(e: any) => setF({ ...f, note: e.target.value })} style={{ minHeight: 46 }} />
        <label className="picbtn" style={{ display: 'inline-block', marginTop: 6 }}>选择照片（可多选）
          <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => {
            const fs = [...(e.target.files || [])]
            e.currentTarget.value = ''
            setF({ ...f, files: fs })
          }} /></label>
        <div className="mut" style={{ margin: '8px 0 0' }}>{f.files?.length ? `已选 ${f.files.length} 张` : '也可以建好后再加图'}</div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim()} onClick={() => save(async () => {
            const fd: any = { name: f.name.trim() }
            const meRec = pb.authStore.record; if (meRec) fd.member = meRec.id
            if ((f.note || '').trim()) fd.note = f.note.trim()
            const exInfo: any = {}
            const up: File[] = []
            if (f.files?.length) {
              // 先读原图 EXIF，再逐张压缩（JPEG 压缩会丢掉 EXIF；串行也避免手机端并发解码爆内存）
              for (const x of f.files) { const r = await readExif(x); if (r) exInfo[x.name] = r; up.push(await compressImg(x)) }
              fd.photos = up; fd.cover = up[0]
            }
            const rec = await pb.collection('albums').create(fd)
            // 存储名会加随机前缀，创建后按 photos 顺序把 exif 重新挂到真实文件名上
            if (up.length && Object.keys(exInfo).length) {
              const ex: any = {}
              up.forEach((x, i) => { const stored = rec.photos?.[i]; const r = exInfo[x.name]; if (stored && r) ex[stored] = r })
              if (Object.keys(ex).length) await pb.collection('albums').update(rec.id, { exifs: JSON.stringify(ex) }).catch(() => {})
            }
          })}>创 建</Button>
        </div>
      </>}
      {kind === 'wish' && <>
        <Input placeholder="想和 TA 一起做的事…" value={f.text || ''} onChange={(e: any) => setF({ ...f, text: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.text || '').trim()} onClick={() => save(() => pb.collection('wishes').create({ text: f.text.trim(), done: false }))}>加入清单</Button>
        </div>
      </>}
      {kind === 'moment' && <>
        <Input placeholder="日子名称，比如：女孩的生日" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <div className="chips" style={{ margin: '10px 0 0' }}>
          <Tag color={!f.lunar ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, lunar: false })} style={{ cursor: 'pointer' }}>阳历日期</Tag>
          <Tag color={f.lunar ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, lunar: true })} style={{ cursor: 'pointer' }}>农历日期</Tag>
        </div>
        {!f.lunar ? (
          <div className="mdate"><span>日期</span><input type="date" value={f.day || ''} onChange={(e) => setF({ ...f, day: e.target.value })} /></div>
        ) : (
          <div className="mdate"><span>农历月/日</span>
            <input type="number" min={1} max={12} placeholder="月" style={{ width: 64 }} value={f.lm || ''} onChange={(e) => setF({ ...f, lm: e.target.value })} />
            <input type="number" min={1} max={30} placeholder="日" style={{ width: 64 }} value={f.ld || ''} onChange={(e) => setF({ ...f, ld: e.target.value })} />
          </div>
        )}
        <div className="chips" style={{ margin: '10px 0 0' }}>
          <Tag color={f.yearly !== false ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, yearly: true })} style={{ cursor: 'pointer' }}>每年重复</Tag>
          <Tag color={f.yearly === false ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, yearly: false })} style={{ cursor: 'pointer' }}>仅一次</Tag>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim() || (f.lunar ? !(f.lm && f.ld) : !f.day)} onClick={() => save(() => pb.collection('moments').create(
            f.lunar
              ? { name: f.name.trim(), lunar: true, lunarMD: `${Number(f.lm)}-${Number(f.ld)}`, day: new Date().toISOString().slice(0, 10), yearly: f.yearly !== false }
              : { name: f.name.trim(), day: f.day, yearly: f.yearly !== false }))}>保 存</Button>
        </div>
      </>}
      {kind === 'checkin' && <>
        <Input placeholder="图标（一个 emoji），如 🌙" value={f.emoji || ''} onChange={(e: any) => setF({ ...f, emoji: e.target.value })} />
        <Input placeholder="计划名，如：早睡打卡" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim()} onClick={() => save(() => pb.collection('checkins').create({ name: f.name.trim(), emoji: f.emoji || '📌' }))}>创 建</Button>
        </div>
      </>}
      {kind === 'profile' && <>
        <div className="avrow">
          <Av rec={pb.authStore.record} size={64} fb="💗" />
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 14 }}>我的头像</div>
            <label className="picbtn" style={{ marginTop: 6 }}>
              {f.avBusy ? '上传中…' : f.avDone ? '✓ 已更新' : '选择图片'}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                const fl = [...(e.target.files || [])]
                if (!fl.length) return
                fl[0] = await compressImg(fl[0])
                setF({ ...f, avBusy: true })
                try {
                  const rec = await pb.collection('members').update(pb.authStore.record!.id, { avatar: fl[0] })
                  try { pb.authStore.save(pb.authStore.token, rec) } catch { /* 本地缓存刷新失败不影响上传结果 */ }
                  setF({ ...f, avBusy: false, avDone: true }); reload()
                } catch (err: any) { setF({ ...f, avBusy: false }); showToast('头像没传上：' + String(err?.message || err).slice(0, 40)) }
              }} />
            </label>
          </div>
        </div>
        <div className="aivz" />
        <Input placeholder="昵称" value={f.nickName || ''} onChange={(e: any) => setF({ ...f, nickName: e.target.value })} />
        <div className="chips" style={{ marginTop: 6 }}>
          {['男', '女'].map((g) => <Tag key={g} color={f.gender === g ? 'app-pink' : 'app-teal'} onClick={() => setF({ ...f, gender: g })} style={{ cursor: 'pointer' }}>{g}</Tag>)}
        </div>
        <div className="aivz" />
        <Input type="password" placeholder="当前密令（修改密令时必填）" value={f.pw0 || ''} onChange={(e: any) => setF({ ...f, pw0: e.target.value })} />
        <div style={{ height: 6 }} />
        <Input type="password" placeholder="新密令（至少 8 位，留空则不修改）" value={f.p1 || ''} onChange={(e: any) => setF({ ...f, p1: e.target.value })} />
        <div style={{ height: 6 }} />
        <Input type="password" placeholder="再输一次新密令" value={f.p2 || ''} onChange={(e: any) => setF({ ...f, p2: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => {
            const body: any = { nickName: f.nickName, gender: f.gender }
            if ((f.p1 || '').length) {
              if (!(f.pw0 || '').length) { showToast('改密令要先输当前密令'); return }
              if (f.p1 !== f.p2) { showToast('两次密令不一样，检查一下'); return }
              body.oldPassword = f.pw0; body.password = f.p1; body.passwordConfirm = f.p2
            }
            save(async () => {
              const rec = await pb.collection('members').update(pb.authStore.record!.id, body)
              try { if (body.password) pb.authStore.save(pb.authStore.token, rec) } catch { /* 本地缓存刷新失败不影响改密结果 */ }
              if (body.password) { setF({ ...f, pw0: '', p1: '', p2: '' }); showToast('密令已更新') }
            })
          }}>保 存</Button>
        </div>
      </>}
      {kind === 'diary-edit' && rec && <>
        <Input placeholder="标题（可留空）" value={f.title || ''} onChange={(e: any) => setF({ ...f, title: e.target.value })} />
        <textarea className="ta" style={{ margin: '4px 0 10px' }} value={f.text || ''} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="今天发生了什么值得记住的事？" />
        <div className="chips" style={{ marginBottom: 10 }}>
          {MOODS.map((m) => <Tag key={m} color={f.mood === m ? 'app-pink' : MOOD_TAG[m]} onClick={() => setF({ ...f, mood: m })} style={{ cursor: 'pointer' }}><Ic v={MOOD_IC[m]} size={13} /> {MOOD_CN[m]}</Tag>)}
        </div>
        <div className="li" style={{ border: 0 }}>
          <button className={'tick' + (f.private ? ' on' : '')} onClick={() => setF({ ...f, private: !f.private })}>{f.private ? '✓' : ''}</button>
          <span style={{ fontSize: 14 }}>🔒 仅自己可见</span>
          <span className="grow" />
          <label className="picbtn"><Ic v="📎" size={13} /> {rec.photo ? '换图' : '附图'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const f0 = e.target.files?.[0]
              if (!f0) return
              const ex = await readExif(f0)
              const c = await compressImg(f0)
              setF((x: any) => ({ ...x, photo: c, photoEx: ex }))
            }} /></label>
        </div>
        {f.photo && <div className="mut" style={{ margin: '4px 0' }}>已选：{f.photo.name}</div>}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.text || '').trim()} onClick={() => {
            const body: any = { text: f.text.trim(), mood: f.mood, title: f.title || '', private: !!f.private }
            if (f.photo) body.photo = f.photo
            if (f.photoEx) body.exif = JSON.stringify(f.photoEx)
            save(async () => { await pb.collection('diaries').update(rec.id, body) })
          }}>保 存</Button>
        </div>
        <div style={{ height: 10 }} />
        <Button danger block onClick={() => del('diaries', rec.id, '日常')}>删除这篇</Button>
      </>}
      {kind === 'wish-edit' && rec && <>
        <Input placeholder="想和 TA 一起做的事…" value={f.text || ''} onChange={(e: any) => setF({ ...f, text: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.text || '').trim()} onClick={() => save(async () => { await pb.collection('wishes').update(rec.id, { text: f.text.trim() }) })}>保 存</Button>
        </div>
        <div style={{ height: 10 }} />
        <Button danger block onClick={() => del('wishes', rec.id, '约定')}>删 除</Button>
      </>}
      {kind === 'moment-edit' && rec && <>
        <Input placeholder="日子名称" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <div className="chips" style={{ margin: '10px 0 0' }}>
          <Tag color={!f.lunar ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, lunar: false })} style={{ cursor: 'pointer' }}>阳历日期</Tag>
          <Tag color={f.lunar ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, lunar: true })} style={{ cursor: 'pointer' }}>农历日期</Tag>
        </div>
        {!f.lunar ? (
          <div className="mdate"><span>日期</span><input type="date" value={f.day || ''} onChange={(e) => setF({ ...f, day: e.target.value })} /></div>
        ) : (
          <div className="mdate"><span>农历月/日</span>
            <input type="number" min={1} max={12} placeholder="月" style={{ width: 64 }} value={f.lm || ''} onChange={(e) => setF({ ...f, lm: e.target.value })} />
            <input type="number" min={1} max={30} placeholder="日" style={{ width: 64 }} value={f.ld || ''} onChange={(e) => setF({ ...f, ld: e.target.value })} />
          </div>
        )}
        <div className="chips" style={{ margin: '10px 0 0' }}>
          <Tag color={f.yearly !== false ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, yearly: true })} style={{ cursor: 'pointer' }}>每年重复</Tag>
          <Tag color={f.yearly === false ? 'app-pink' : 'app-yellow'} onClick={() => setF({ ...f, yearly: false })} style={{ cursor: 'pointer' }}>仅一次</Tag>
        </div>
        <Input placeholder="图标（一个 emoji）" value={f.emoji || ''} onChange={(e: any) => setF({ ...f, emoji: e.target.value })} />
        <Input placeholder="备注（可留空）" value={f.note || ''} onChange={(e: any) => setF({ ...f, note: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim() || (f.lunar ? !(f.lm && f.ld) : !f.day)} onClick={() => save(() => pb.collection('moments').update(rec.id,
            f.lunar
              ? { name: f.name.trim(), emoji: f.emoji || '💗', note: f.note || '', lunar: true, lunarMD: `${Number(f.lm)}-${Number(f.ld)}`, yearly: f.yearly !== false }
              : { name: f.name.trim(), emoji: f.emoji || '💗', note: f.note || '', day: f.day, lunar: false, yearly: f.yearly !== false }))}>保 存</Button>
        </div>
        <div style={{ height: 10 }} />
        <Button danger block onClick={() => del('moments', rec.id, '日子')}>删 除</Button>
      </>}
      {kind === 'album-edit' && rec && <>
        <Input placeholder="相册名" value={f.name || ''} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
        <textarea className="ta" placeholder="备注（可选）" value={f.note || ''} onChange={(e: any) => setF({ ...f, note: e.target.value })} style={{ minHeight: 46 }} />
        <div className="mut" style={{ margin: '8px 0 4px' }}>选一张做封面</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(rec.photos || []).map((p: string) => (
            <img key={p} src={pb.files.getURL(rec, p, { thumb: '200x200' })} alt="" onClick={() => setF({ ...f, cover: p })}
              style={{ width: 66, height: 66, objectFit: 'cover', borderRadius: 12, cursor: 'pointer', outline: f.cover === p ? '3px solid #e8608a' : '2px solid transparent' }} />
          ))}
          {!(rec.photos || []).length && <span className="mut">这本还没有照片</span>}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} disabled={!(f.name || '').trim()} onClick={() => save(async () => {
            await pb.collection('albums').update(rec.id, { name: f.name.trim(), note: f.note || '', cover: f.cover || rec.cover })
          })}>保 存</Button>
        </div>
        <div style={{ height: 10 }} />
        <Button danger block onClick={() => del('albums', rec.id, '相册（照片一起删）')}>删 除整本</Button>
      </>}
      {kind === 'checkin-more' && rec && <>
        <div className="mut" style={{ marginBottom: 8 }}>{rec.emoji} {rec.name} · 最近 30 天</div>
        {(() => {
          const recs = (data.ckrecords || []).filter((r: any) => r.plan === rec.id)
          const z = (n: number) => String(n).padStart(2, '0')
          const days: any[] = []
          for (let i = 0; i < 30; i++) {
            const d = new Date(); d.setDate(d.getDate() - i)
            const k = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
            days.push({ k, who: recs.filter((r: any) => r.day === k).map((r: any) => r.who) })
          }
          return days.map((x) => (
            <div className="li" key={x.k} style={{ padding: '6px 0' }}>
              <span className="grow" style={{ fontSize: 13.5 }}>{x.k}{x.k === today() ? ' · 今天' : ''}</span>
              {x.who.length ? <Tag size="small" color="lime-green">{x.who.join(' / ')}</Tag> : <span className="mut">—</span>}
            </div>))
        })()}
        <div style={{ height: 6 }} />
        <Button danger block onClick={() => del('checkins', rec.id, '打卡计划（记录一起删）')}>删除计划</Button>
      </>}
      {kind === 'msg-del' && rec && <>
        <div style={{ padding: '4px 0 14px', fontSize: 14.5, lineHeight: 1.7 }}>{rec.text}</div>
        <Button danger block loading={busy} onClick={() => del('messages', rec.id, '祝福')}>删 除</Button>
      </>}
      {kind === 'sitename' && <>
        <Input placeholder="情侣小站" value={f.siteName || ''} onChange={(e: any) => setF({ ...f, siteName: e.target.value })} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => save(async () => {
            const s = data.setting
            if (s) await pb.collection('settings').update(s.id, { siteName: f.siteName || '情侣小站' })
            else await pb.collection('settings').create({ siteName: f.siteName || '情侣小站' })
          })}>保 存</Button>
        </div>
      </>}
      {kind === 'about' && <>
        <Input placeholder="两人称呼" value={f.names || ''} onChange={(e: any) => setF({ ...f, names: e.target.value })} />
        <Input placeholder="男孩昵称" value={f.boyName || ''} onChange={(e: any) => setF({ ...f, boyName: e.target.value })} />
        <Input placeholder="女孩昵称" value={f.girlName || ''} onChange={(e: any) => setF({ ...f, girlName: e.target.value })} />
        <Input placeholder="一句话签名" value={f.quote || ''} onChange={(e: any) => setF({ ...f, quote: e.target.value })} />
        <div className="mdate"><span>在一起的日子</span><input type="date" value={f.startDate || ''} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
        <div style={{ marginTop: 10 }}><div className="mdate-span">我们的故事</div>
          <textarea className="ta" value={f.story || ''} onChange={(e) => setF({ ...f, story: e.target.value })} /></div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button type="primary" block loading={busy} onClick={() => {
            const body: any = { ...f }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '')) body.startDate = dayStr(data.setting?.startDate || '')
            if (!body.startDate) { showToast('请先选择在一起的日子'); return }
            save(async () => {
              const s = data.setting
              if (s) await pb.collection('settings').update(s.id, body)
              else await pb.collection('settings').create(body)
            })
          }}>保 存</Button>
        </div>
      </>}
    </Modal>
  )
}

export { ModalCard }
