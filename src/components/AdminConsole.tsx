import { useEffect, useState, type FormEvent } from 'react'
import { getCurrentUser, isPawCreamApiEnabled, signInPawCream, signOutPawCream, type PawCreamUser } from '../pawcreamApi'
import '../admin.css'

type Section = 'overview' | 'users' | 'invites' | 'notes' | 'photos' | 'audit'
type Overview = {
  users: { total: number; disabled: number }
  notes: { total: number; hidden: number }
  photos: { total: number; hidden: number }
}
type AdminUser = {
  id: string; email: string; displayName: string; role: 'user' | 'admin'
  createdAt: string; disabled: boolean; disabledAt: string | null; disabledReason: string | null
  noteCount: number; photoCount: number
}
type AdminNote = { id: string; text: string; authorName: string; hidden: boolean; createdAt: string; ownerEmail: string; ownerDisabled: boolean }
type AdminPhoto = { id: string; frameName: string; authorName: string; hidden: boolean; createdAt: string; ownerEmail: string; ownerDisabled: boolean }
type Invite = { id:string; lastFour:string; createdAt:string; usedAt:string|null; revokedAt:string|null; usedBy:string|null }
type NewlyCreatedInvite = { id:string; code:string }
type Audit = { id: number; actorEmail: string; action: string; targetType: string; targetId: string; details: { reason?: string | null }; createdAt: string }
type Page<T> = { items: T[]; total: number; offset: number; limit: number }

const PAGE_SIZE = 20
const menu: { key: Section; name: string; hint: string }[] = [
  { key: 'overview', name: '总览', hint: 'Overview' },
  { key: 'users', name: '用户', hint: 'Accounts' },
  { key: 'invites', name: '邀请码', hint: 'Invitations' },
  { key: 'notes', name: '留言', hint: 'Notes' },
  { key: 'photos', name: '返图', hint: 'Photos' },
  { key: 'audit', name: '审计', hint: 'Audit log' },
]

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
  return payload
}

const shortDate = (date: string) => new Date(date).toLocaleString('zh-CN', { hour12: false })
const shortId = (id: string) => id.slice(0, 8)
const label = (hidden: boolean) => hidden ? '已隐藏' : '可见'

export default function AdminConsole() {
  const [viewer, setViewer] = useState<PawCreamUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [section, setSection] = useState<Section>('overview')
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [working, setWorking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [newCodes, setNewCodes] = useState<NewlyCreatedInvite[]>([])
  const [inviteCount, setInviteCount] = useState(1)
  const [notes, setNotes] = useState<AdminNote[]>([])
  const [photos, setPhotos] = useState<AdminPhoto[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!isPawCreamApiEnabled()) { setChecking(false); return }
    void getCurrentUser().then(setViewer).catch(() => setAuthError('无法连接认证服务')).finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (viewer?.role !== 'admin') return
    let alive = true
    setLoading(true)
    setError('')
    const offset = page * PAGE_SIZE
    const f = filter === 'all' ? '' : `&status=${encodeURIComponent(filter)}`
    const load = async () => {
      if (section === 'overview') {
        const response = await adminRequest<Overview>('/overview')
        if (alive) setOverview(response)
      } else if (section === 'users') {
        const response = await adminRequest<Page<AdminUser>>(`/users?offset=${offset}&q=${encodeURIComponent(query)}`)
        if (alive) { setUsers(response.items); setTotal(response.total) }
      } else if (section === 'invites') {
        const response = await adminRequest<Page<Invite>>(`/invites?offset=${offset}`)
        if (alive) { setInvites(response.items); setTotal(response.total) }
      } else if (section === 'notes') {
        const response = await adminRequest<Page<AdminNote>>(`/notes?offset=${offset}${f}`)
        if (alive) { setNotes(response.items); setTotal(response.total) }
      } else if (section === 'photos') {
        const response = await adminRequest<Page<AdminPhoto>>(`/photos?offset=${offset}${f}`)
        if (alive) { setPhotos(response.items); setTotal(response.total) }
      } else {
        const response = await adminRequest<Page<Audit>>(`/audit?offset=${offset}`)
        if (alive) { setAudits(response.items); setTotal(response.total) }
      }
    }
    void load().catch(e => {
      if (alive) {
        setError(e instanceof Error ? e.message : '数据加载失败')
        if (String(e?.message).includes('需要管理员权限') || String(e?.message).includes('请先登录')) {
          setViewer(null)
        }
      }
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [viewer, section, page, query, filter, refresh])

  const changeSection = (next: Section) => {
    setSection(next)
    setNewCodes([])
    setPage(0)
    setFilter('all')
    setError('')
  }

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setWorking(true)
    setAuthError('')
    try {
      const { user } = await signInPawCream(email.trim(), password)
      if (user.role !== 'admin') {
        await signOutPawCream()
        setAuthError('此账号没有管理员权限')
        return
      }
      setViewer(user)
      setPassword('')
    } catch (e) { setAuthError(e instanceof Error ? e.message : '登录失败') }
    finally { setWorking(false) }
  }

  const logout = async () => {
    setWorking(true)
    try { await signOutPawCream(); setViewer(null); setEmail(''); setPassword('') }
    catch (e) { setError(e instanceof Error ? e.message : '退出失败') }
    finally { setWorking(false) }
  }

  const change = async (path: string, payload: object) => {
    setWorking(true)
    setError('')
    try {
      await adminRequest(path, { method: 'PATCH', body: JSON.stringify(payload) })
      setRefresh(v => v + 1)
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败') }
    finally { setWorking(false) }
  }

  const generateInvites = async () => {
    if (!window.confirm(`生成 ${inviteCount} 个一次性邀请码？注册码只会在本次生成后完整显示。`)) return
    setWorking(true)
    setError('')
    setNewCodes([])
    try {
      const result = await adminRequest<{ codes: NewlyCreatedInvite[] }>('/invites', {
        method: 'POST', body: JSON.stringify({ count: inviteCount }),
      })
      setNewCodes(result.codes)
      setPage(0)
      setRefresh(n => n + 1)
    } catch (e) { setError(e instanceof Error ? e.message : '生成失败') }
    finally { setWorking(false) }
  }

  const revokeInvite = async (item: Invite) => {
    if (!window.confirm(`确认撤销尾号 ${item.lastFour} 的邀请码？撤销后无法用于注册。`)) return
    setWorking(true)
    setError('')
    try {
      await adminRequest(`/invites/${item.id}/revoke`, { method: 'PATCH' })
      setRefresh(n => n + 1)
    } catch (e) { setError(e instanceof Error ? e.message : '撤销失败') }
    finally { setWorking(false) }
  }

  const userAction = (item: AdminUser) => {
    const next = !item.disabled
    if (item.role === 'admin') return
    const reason = next ? window.prompt(`封禁 ${item.email} 的原因（至少 3 个字）：`) : window.prompt(`解除 ${item.email} 的封禁，填写备注（可留空）：`, '')
    if (reason === null) return
    if (next && reason.trim().length < 3) { setError('封禁原因至少 3 个字符'); return }
    if (!window.confirm(next ? '封禁后此用户会立即失去登录权限，公开内容也会隐藏。继续？' : '解禁后用户可以重新登录，未单独隐藏的内容也会恢复可见。继续？')) return
    void change(`/users/${item.id}/status`, { disabled: next, reason: reason.trim() })
  }

  const visibilityAction = (kind: 'notes' | 'photos', item: AdminNote | AdminPhoto) => {
    const next = !item.hidden
    const reason = window.prompt(next ? '请输入隐藏原因（至少 3 个字）：' : '请输入恢复备注（可留空）：', '')
    if (reason === null) return
    if (next && reason.trim().length < 3) { setError('隐藏原因至少 3 个字符'); return }
    if (!window.confirm(next ? '确认隐藏这项公开内容？' : '确认恢复公开显示？')) return
    void change(`/${kind}/${item.id}/visibility`, { hidden: next, reason: reason.trim() })
  }

  return (
    <div className="pc-admin">
      {(!isPawCreamApiEnabled()) ? (
        <div className="pc-auth-shell"><div className="pc-auth-card"><h1>PawCream 管理台</h1><p>管理后台仅在已连接真实后端的站点中启用，GitHub Pages 预览不支持登录。</p><a href="/">返回网站</a></div></div>
      ) : checking ? (
        <div className="pc-auth-shell"><p>正在核验管理员身份…</p></div>
      ) : viewer?.role !== 'admin' ? (
        <div className="pc-auth-shell">
          <form className="pc-auth-card" onSubmit={login}>
            <div className="pc-logo">PawCream <span>Studio</span></div>
            <span className="pc-eyebrow">PRIVATE CONTROL ROOM</span>
            <h1>欢迎回来</h1>
            <p>管理员专用入口。所有操作会记录在审计日志中。</p>
            <label>管理员邮箱<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></label>
            <label>密码<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
            {authError && <div className="pc-error" role="alert">{authError}</div>}
            <button className="pc-primary" type="submit" disabled={working}>{working ? '正在验证…' : '登录管理后台'}</button>
            <a className="pc-back" href="/">← 返回 PawCream 网站</a>
          </form>
        </div>
      ) : (
        <div className="pc-layout">
          <aside className="pc-sidebar">
            <div className="pc-logo">PawCream <span>Studio</span></div>
            <div className="pc-sidebar-sub">管理工作台 / Admin</div>
            <nav aria-label="管理模块">
              {menu.map(item => (
                <button type="button" key={item.key} className={`pc-nav ${section === item.key ? 'active' : ''}`} onClick={() => changeSection(item.key)} aria-current={section === item.key ? 'page' : undefined}>
                  <strong>{item.name}</strong><small>{item.hint}</small>
                </button>
              ))}
            </nav>
            <div className="pc-sidebar-bottom"><div className="pc-avatar">PC</div><div className="pc-sidebar-email">{viewer.email}<small>Administrator</small></div></div>
          </aside>
          <main className="pc-main">
            <header className="pc-topbar">
              <div><span className="pc-eyebrow">PAWCREAM OPERATIONS</span><h1>{menu.find(x => x.key === section)?.name}</h1></div>
              <div className="pc-actions"><a href="/">查看网站 ↗</a><button type="button" onClick={() => void logout()} disabled={working}>退出登录</button></div>
            </header>
            {error && <div className="pc-error" role="alert">{error}</div>}
            {section === 'overview' && (
              <>
                <p className="pc-lead">这里汇总了真实数据库的用户和公开内容数据。被封禁用户的内容会自动从公共展示中消失。</p>
                <div className="pc-stats">
                  <div className="pc-stat"><span>注册用户</span><strong>{overview?.users.total ?? '—'}</strong><small>已封禁 {overview?.users.disabled ?? 0}</small></div>
                  <div className="pc-stat"><span>用户留言</span><strong>{overview?.notes.total ?? '—'}</strong><small>人工隐藏 {overview?.notes.hidden ?? 0}</small></div>
                  <div className="pc-stat"><span>公开返图</span><strong>{overview?.photos.total ?? '—'}</strong><small>人工隐藏 {overview?.photos.hidden ?? 0}</small></div>
                </div>
                <section className="pc-panel"><h2>运营提醒</h2><p>内容隐藏不会直接删除 OSS 对象或数据库记录，可以复核后恢复。封禁用户会终止已有会话，撤销登录资格。</p><p>本版优先实现可撤销的封禁与隐藏；用户永久注销、数据彻底删除和举报工单需单独设计，以免误删私有照片或审计记录。</p></section>
              </>
            )}
            {section === 'users' && (
              <section className="pc-panel">
                <div className="pc-panel-head"><div><h2>用户列表</h2><p>账号状态实时读取数据库，禁止封禁管理员。</p></div>
                  <form className="pc-search" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(search.trim()) }}><input aria-label="查找邮箱或昵称" value={search} onChange={e => setSearch(e.target.value)} placeholder="邮箱或昵称" /><button type="submit">搜索</button></form>
                </div>
                <div className="pc-table-wrap"><table><thead><tr><th>用户</th><th>角色 / 状态</th><th>内容</th><th>加入日期</th><th>管理</th></tr></thead><tbody>
                  {users.map(item => <tr key={item.id}>
                    <td><strong>{item.displayName}</strong><small>{item.email}</small></td>
                    <td><span className={`pc-pill ${item.disabled ? 'danger' : ''}`}>{item.disabled ? '已封禁' : item.role === 'admin' ? '管理员' : '正常'}</span>{item.disabledReason && <small title={item.disabledReason}>{item.disabledReason}</small>}</td>
                    <td>留言 {item.noteCount}<small>返图 {item.photoCount}</small></td>
                    <td>{shortDate(item.createdAt)}</td>
                    <td><button type="button" className="pc-table-action" disabled={working || item.role === 'admin'} onClick={() => userAction(item)}>{item.role === 'admin' ? '受保护' : item.disabled ? '解除封禁' : '封禁用户'}</button></td>
                  </tr>)}
                </tbody></table></div>
                {!users.length && !loading && <p className="pc-empty">没有符合条件的用户</p>}
              </section>
            )}
            {section === 'invites' && (
              <>
                <section className="pc-panel">
                  <div className="pc-panel-head"><div><h2>一次性邀请码</h2>
                    <p>统一格式 PC-XXXX-XXXX；随机生成，只有第一次创建时显示完整邀请码。每码仅限一个账号。</p>
                  </div></div>
                  <div className="pc-invite-actions">
                    <label>生成数量{' '}
                      <select value={inviteCount} onChange={e => setInviteCount(Number(e.target.value))}>
                        {[1, 3, 5, 10, 20].map(n => <option key={n} value={n}>{n} 个</option>)}
                      </select>
                    </label>
                    <button className="pc-primary" style={{ width:'auto', margin:0 }} type="button" disabled={working} onClick={() => void generateInvites()}>
                      {working ? '正在处理…' : '生成邀请码'}
                    </button>
                  </div>
                  {!!newCodes.length && <div className="pc-codes-created">
                    <strong>新邀请码（仅本次显示，请立即安全保存）</strong>
                    <div className="pc-invite-tags">
                      {newCodes.map(entry => <div key={entry.id} className="pc-invite-tag">
                        <code>{entry.code}</code>
                        <button type="button" onClick={() => void navigator.clipboard.writeText(entry.code).catch(() => setError('复制失败，请手动选中邀请码'))}>复制</button>
                      </div>)}
                    </div>
                    <button type="button" className="pc-table-action" onClick={() => setNewCodes([])}>已保存，清除屏幕上的邀请码</button>
                  </div>}
                </section>
                <section className="pc-panel" style={{marginTop:18}}>
                  <div className="pc-panel-head"><div><h2>邀请码记录</h2><p>为保护邀请码安全，此处只显示后四位。已使用和已撤销的码均不能再次注册。</p></div></div>
                  <div className="pc-table-wrap"><table>
                    <thead><tr><th>编号</th><th>创建时间</th><th>状态</th><th>关联用户</th><th>操作</th></tr></thead>
                    <tbody>{invites.map(item => (
                      <tr key={item.id}>
                        <td><strong>PC-****-{item.lastFour}</strong></td>
                        <td>{shortDate(item.createdAt)}</td>
                        <td><span className={`pc-pill ${item.revokedAt ? 'danger':''}`}>{item.usedAt ? '已使用' : item.revokedAt ? '已撤销' : '可使用'}</span></td>
                        <td>{item.usedBy || '—'}</td>
                        <td><button type="button" className="pc-table-action" disabled={working || Boolean(item.usedAt || item.revokedAt)}
                          onClick={() => void revokeInvite(item)}>撤销</button></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                  {!invites.length && !loading && <p className="pc-empty">暂时还没有邀请码，请先生成</p>}
                </section>
              </>
            )}
            {section === 'notes' && (
              <section className="pc-panel">
                <div className="pc-panel-head"><div><h2>留言审核</h2><p>隐藏内容后不会再出现在公开留言板。</p></div><StatusFilter value={filter} onChange={v => { setPage(0); setFilter(v) }} /></div>
                <div className="pc-note-list">{notes.map(item => (
                  <article className="pc-note" key={item.id}>
                    <div className="pc-note-meta"><span>{item.authorName}</span><span className={`pc-pill ${item.hidden ? 'danger' : ''}`}>{label(item.hidden)}</span><time>{shortDate(item.createdAt)}</time></div>
                    <p>{item.text}</p><div className="pc-note-footer"><small>{item.ownerEmail} {item.ownerDisabled ? '· 已封禁用户' : ''}</small><button type="button" className="pc-table-action" disabled={working} onClick={() => visibilityAction('notes', item)}>{item.hidden ? '恢复显示' : '隐藏留言'}</button></div>
                  </article>
                ))}</div>
                {!notes.length && !loading && <p className="pc-empty">没有符合条件的留言</p>}
              </section>
            )}
            {section === 'photos' && (
              <section className="pc-panel">
                <div className="pc-panel-head"><div><h2>返图审核</h2><p>图片只通过管理员授权 API 读取，私有 OSS 对象不会直接暴露。</p></div><StatusFilter value={filter} onChange={v => { setPage(0); setFilter(v) }} /></div>
                <div className="pc-photo-grid">{photos.map(item => (
                  <article className="pc-photo" key={item.id}>
                    <img src={`/api/admin/photos/${item.id}/image`} alt={`来自 ${item.authorName} 的返图`} loading="lazy" />
                    <div className="pc-photo-body"><div className="pc-note-meta"><strong>{item.authorName}</strong><span className={`pc-pill ${item.hidden ? 'danger' : ''}`}>{label(item.hidden)}</span></div>
                      <small>{item.frameName} · {shortDate(item.createdAt)}</small><small className="pc-email">{item.ownerEmail}</small><button type="button" className="pc-table-action" disabled={working} onClick={() => visibilityAction('photos', item)}>{item.hidden ? '恢复显示' : '隐藏返图'}</button>
                    </div>
                  </article>
                ))}</div>
                {!photos.length && !loading && <p className="pc-empty">没有符合条件的返图</p>}
              </section>
            )}
            {section === 'audit' && (
              <section className="pc-panel"><div className="pc-panel-head"><div><h2>操作审计</h2><p>封禁、解禁、隐藏和恢复均记录操作者与原因。</p></div></div>
                <div className="pc-table-wrap"><table><thead><tr><th>时间</th><th>管理员</th><th>操作</th><th>对象</th><th>原因</th></tr></thead><tbody>
                  {audits.map(item => <tr key={item.id}><td>{shortDate(item.createdAt)}</td><td>{item.actorEmail}</td><td><span className="pc-pill">{item.action}</span></td><td>{item.targetType}<small>{shortId(item.targetId)}</small></td><td>{item.details?.reason || '—'}</td></tr>)}
                </tbody></table></div>
                {!audits.length && !loading && <p className="pc-empty">还没有管理操作记录</p>}
              </section>
            )}
            {section !== 'overview' && <div className="pc-pagination"><span>共 {total} 项 · 第 {page + 1} 页</span><div><button type="button" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>上一页</button><button type="button" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage(p => p + 1)}>下一页</button></div></div>}
            {loading && <p className="pc-loading" role="status">正在读取数据…</p>}
          </main>
        </div>
      )}
    </div>
  )
}

function StatusFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select aria-label="内容状态筛选" className="pc-filter" value={value} onChange={e => onChange(e.target.value)}>
    <option value="all">全部状态</option><option value="visible">正常显示</option><option value="hidden">已隐藏</option>
  </select>
}
