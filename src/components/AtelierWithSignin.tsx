import { type FormEvent, useEffect, useState } from 'react'
import AtelierWithCollection from './AtelierWithCollection'

type DeviceProfile = 'desktop' | 'mobile'
type Language = 'zh' | 'en'
type AuthMode = 'login' | 'register'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'
const TYPEWRITER_URL = `${import.meta.env.BASE_URL}assets/signin/${encodeURIComponent('打字机.png')}`

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
}

export default function AtelierWithSignin(props: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  const [language, setLanguage] = useState<Language>(readLanguage)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [status, setStatus] = useState('')

  const mobile = props.deviceProfile === 'mobile'
  const copy = language === 'zh'
    ? {
        title: 'PawCream 账号',
        email: '邮箱',
        password: '密码',
        invite: '邀请码',
        login: '登入',
        register: '注册',
        close: '关闭登入',
        badEmail: '请输入正确的邮箱地址',
        badPassword: '密码至少需要 6 位',
        badInvite: '请输入邀请码',
        pendingLogin: '账号服务尚未接入，登入界面已准备好',
        pendingRegister: '账号服务尚未接入，注册界面已准备好',
      }
    : {
        title: 'PawCream Account',
        email: 'Email',
        password: 'Password',
        invite: 'Invite code',
        login: 'Sign in',
        register: 'Register',
        close: 'Close sign in',
        badEmail: 'Please enter a valid email address',
        badPassword: 'Password must be at least 6 characters',
        badInvite: 'Please enter an invite code',
        pendingLogin: 'Account service is not connected yet. The sign-in UI is ready.',
        pendingRegister: 'Account service is not connected yet. The registration UI is ready.',
      }

  useEffect(() => {
    const image = new Image()
    image.decoding = 'async'
    image.src = TYPEWRITER_URL
  }, [])

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target) return

      const toolbar = target.closest('nav[aria-label="PawCream Atelier toolbar"]')
      const button = target.closest('button')
      if (toolbar && button) {
        const text = button.textContent?.trim()
        if (text === '登入' || text === 'Sign in') {
          event.preventDefault()
          event.stopPropagation()
          setLanguage(readLanguage())
          setStatus('')
          setOpen((value) => !value)
          return
        }

        const ariaLabel = button.getAttribute('aria-label')
        if (ariaLabel === '收起' || ariaLabel === 'Hide') {
          setOpen(false)
        }
      }

      const light = target.closest('img[alt="Light"]')
      if (light && open) setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('click', onClickCapture, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onClickCapture, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setStatus('')
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = email.trim()
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

    if (!validEmail) {
      setStatus(copy.badEmail)
      return
    }
    if (password.length < 6) {
      setStatus(copy.badPassword)
      return
    }
    if (mode === 'register' && !inviteCode.trim()) {
      setStatus(copy.badInvite)
      return
    }

    setStatus(mode === 'login' ? copy.pendingLogin : copy.pendingRegister)
  }

  const inputStyle = {
    width: '100%',
    height: mobile ? 28 : 34,
    boxSizing: 'border-box' as const,
    border: '1px solid rgba(152, 181, 201, .42)',
    borderRadius: 2,
    background: 'rgba(255,255,255,.94)',
    color: '#587184',
    outline: 'none',
    padding: mobile ? '4px 7px' : '5px 9px',
    fontFamily: "'Courier New', ui-monospace, monospace",
    fontSize: mobile ? 10 : 12,
    boxShadow: 'inset 0 1px 2px rgba(96, 125, 145, .05)',
  }

  const actionStyle = {
    minWidth: mobile ? 58 : 72,
    height: mobile ? 27 : 31,
    border: '1px solid rgba(121, 158, 184, .34)',
    borderRadius: 2,
    background: 'rgba(245,250,253,.94)',
    color: '#66859c',
    cursor: 'pointer',
    fontFamily: "'Courier New', ui-monospace, monospace",
    fontSize: mobile ? 10 : 11,
  }

  return (
    <>
      <AtelierWithCollection {...props} />

      {open && (
        <div
          className="pawcream-signin-drop"
          role="dialog"
          aria-label={copy.title}
          onClick={(event) => event.stopPropagation()}
          style={{
            position: 'fixed',
            left: '50%',
            top: mobile ? 54 : 68,
            zIndex: 78,
            width: mobile
              ? 'min(370px, calc(100vw - 14px), calc((100svh - 64px) * .914))'
              : 'min(520px, calc(100vw - 34px), calc((100svh - 78px) * .914))',
            aspectRatio: '1199 / 1312',
            transform: 'translateX(-50%)',
            filter: 'drop-shadow(0 24px 32px rgba(7, 18, 25, .26))',
          }}
        >
          <style>{`
            @keyframes pawcream-signin-drop {
              from { opacity: 0; transform: translate(-50%, -34px) scale(.965); }
              to { opacity: 1; transform: translate(-50%, 0) scale(1); }
            }
            .pawcream-signin-drop { animation: pawcream-signin-drop 380ms cubic-bezier(.2,.82,.24,1) both; }
            .pawcream-signin-input:focus { border-color: rgba(108,151,181,.74) !important; box-shadow: 0 0 0 2px rgba(179,207,226,.18) !important; }
            .pawcream-signin-action:hover { background: rgba(226,239,247,.98) !important; transform: translateY(-1px); }
            .pawcream-signin-close:hover { background: rgba(226,239,247,.92) !important; }
          `}</style>

          <img
            src={TYPEWRITER_URL}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
          />

          <div
            style={{
              position: 'absolute',
              left: '25.5%',
              top: mobile ? '8.5%' : '9.2%',
              width: '49%',
              color: '#5c7486',
              fontFamily: "'Courier New', ui-monospace, monospace",
            }}
          >
            <button
              type="button"
              className="pawcream-signin-close"
              aria-label={copy.close}
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute',
                right: -4,
                top: -3,
                width: mobile ? 24 : 28,
                height: mobile ? 24 : 28,
                border: '1px solid rgba(129,164,188,.28)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,.82)',
                color: '#7793a6',
                cursor: 'pointer',
                padding: 0,
                fontSize: mobile ? 15 : 17,
                lineHeight: 1,
              }}
            >
              ×
            </button>

            <div style={{ paddingRight: mobile ? 28 : 34, marginBottom: mobile ? 9 : 13 }}>
              <div style={{ fontSize: mobile ? 12 : 15, letterSpacing: '.04em' }}>{copy.title}</div>
              <div style={{ marginTop: 4, borderTop: '1px solid rgba(92,116,134,.48)' }} />
            </div>

            <form onSubmit={submit}>
              <label style={{ display: 'block', marginBottom: mobile ? 7 : 10, fontSize: mobile ? 9 : 11, fontWeight: 700 }}>
                <span style={{ display: 'block', marginBottom: 4 }}>{copy.email}</span>
                <input
                  className="pawcream-signin-input"
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.currentTarget.value); setStatus('') }}
                  autoComplete="email"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'block', marginBottom: mobile ? 7 : 10, fontSize: mobile ? 9 : 11, fontWeight: 700 }}>
                <span style={{ display: 'block', marginBottom: 4 }}>{copy.password}</span>
                <input
                  className="pawcream-signin-input"
                  type="password"
                  value={password}
                  onChange={(event) => { setPassword(event.currentTarget.value); setStatus('') }}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  style={inputStyle}
                />
              </label>

              {mode === 'register' && (
                <label style={{ display: 'block', marginBottom: mobile ? 7 : 10, fontSize: mobile ? 9 : 11, fontWeight: 700 }}>
                  <span style={{ display: 'block', marginBottom: 4 }}>{copy.invite}</span>
                  <input
                    className="pawcream-signin-input"
                    type="text"
                    value={inviteCode}
                    onChange={(event) => { setInviteCode(event.currentTarget.value); setStatus('') }}
                    autoComplete="off"
                    style={inputStyle}
                  />
                </label>
              )}

              <div style={{ display: 'flex', gap: mobile ? 6 : 8, marginTop: mobile ? 8 : 12 }}>
                {mode === 'login' ? (
                  <>
                    <button type="submit" className="pawcream-signin-action" style={{ ...actionStyle, background: '#dcebf5', color: '#536f83' }}>{copy.login}</button>
                    <button type="button" className="pawcream-signin-action" onClick={() => switchMode('register')} style={actionStyle}>{copy.register}</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="pawcream-signin-action" onClick={() => switchMode('login')} style={actionStyle}>{copy.login}</button>
                    <button type="submit" className="pawcream-signin-action" style={{ ...actionStyle, background: '#dcebf5', color: '#536f83' }}>{copy.register}</button>
                  </>
                )}
              </div>

              <div
                aria-live="polite"
                style={{
                  minHeight: mobile ? 24 : 30,
                  marginTop: mobile ? 7 : 9,
                  fontSize: mobile ? 8 : 9,
                  lineHeight: 1.4,
                  color: '#7f99aa',
                }}
              >
                {status}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
