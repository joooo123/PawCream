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
const TYPEWRITER_URL = `${import.meta.env.BASE_URL}assets/signin/${encodeURIComponent('打字机.png')}?v=3b38e2c6`

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
    height: mobile ? 27 : 32,
    boxSizing: 'border-box' as const,
    border: '1px solid rgba(176, 204, 222, .74)',
    borderRadius: mobile ? 9 : 10,
    background: 'rgba(252,254,255,.95)',
    color: '#5f7d92',
    outline: 'none',
    padding: mobile ? '4px 8px' : '5px 10px',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: mobile ? 12 : 14,
    boxShadow: '0 4px 14px rgba(117, 157, 184, .10), inset 0 1px 0 rgba(255,255,255,.96)',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
  }

  const actionStyle = {
    minWidth: mobile ? 62 : 78,
    height: mobile ? 28 : 32,
    border: '1px solid rgba(166, 198, 219, .64)',
    borderRadius: mobile ? 10 : 11,
    background: 'rgba(251,253,255,.95)',
    color: '#66859c',
    cursor: 'pointer',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: mobile ? 12 : 13,
    boxShadow: '0 4px 12px rgba(117, 157, 184, .10)',
    transition: 'transform 160ms ease, background 160ms ease, box-shadow 160ms ease',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: mobile ? 7 : 9,
    color: '#6f8da2',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: mobile ? 11 : 13,
    fontWeight: 600,
    letterSpacing: '.02em',
  }

  const primaryActionStyle = {
    ...actionStyle,
    background: 'rgba(224, 238, 247, .97)',
    color: '#58778d',
    boxShadow: '0 5px 14px rgba(117, 157, 184, .14)',
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
            bottom: mobile ? 62 : 82,
            zIndex: 78,
            width: mobile
              ? 'min(370px, calc(100vw - 14px), calc((100svh - 64px) * .914))'
              : 'min(520px, calc(100vw - 34px), calc((100svh - 78px) * .914))',
            aspectRatio: '1199 / 1312',
            transform: 'translateX(-50%)',
            filter: 'drop-shadow(0 24px 32px rgba(7, 18, 25, .24))',
          }}
        >
          <style>{`
            @keyframes pawcream-signin-drop {
              from { opacity: 0; transform: translate(-50%, 28px) scale(.965); }
              to { opacity: 1; transform: translate(-50%, 0) scale(1); }
            }
            .pawcream-signin-drop {
              animation: pawcream-signin-drop 320ms cubic-bezier(.2,.82,.24,1) both;
            }
            .pawcream-signin-input:focus {
              border-color: rgba(126, 171, 201, .78) !important;
              background: rgba(255,255,255,.99) !important;
              box-shadow: 0 0 0 3px rgba(188, 215, 232, .22), 0 6px 16px rgba(117, 157, 184, .12) !important;
            }
            .pawcream-signin-action:hover {
              background: rgba(230,241,248,.99) !important;
              box-shadow: 0 6px 16px rgba(117, 157, 184, .14) !important;
              transform: translateY(-1px);
            }
            .pawcream-signin-close:hover {
              background: rgba(232,243,250,.96) !important;
            }
          `}</style>

          <img
            src={TYPEWRITER_URL}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: '25.8%',
              top: mobile ? '10.1%' : '10.5%',
              width: '48.4%',
              color: '#66859a',
              fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            <button
              type="button"
              className="pawcream-signin-close"
              aria-label={copy.close}
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute',
                right: 0,
                top: -2,
                width: mobile ? 24 : 28,
                height: mobile ? 24 : 28,
                border: '1px solid rgba(166, 198, 219, .58)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,.90)',
                color: '#7996aa',
                boxShadow: '0 4px 12px rgba(117, 157, 184, .10)',
                cursor: 'pointer',
                padding: 0,
                fontSize: mobile ? 15 : 17,
                lineHeight: 1,
              }}
            >
              ×
            </button>

            <header style={{ paddingRight: mobile ? 30 : 36, marginBottom: mobile ? 9 : 11 }}>
              <div style={{ fontSize: mobile ? 14 : 17, fontWeight: 600, letterSpacing: '.04em', color: '#64849a' }}>
                {copy.title}
              </div>
              <div style={{ marginTop: 6, borderTop: '1px solid rgba(176, 204, 222, .72)' }} />
            </header>

            <form onSubmit={submit}>
              <label style={labelStyle}>
                <span style={{ display: 'block', marginBottom: mobile ? 3 : 4 }}>{copy.email}</span>
                <input
                  className="pawcream-signin-input"
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.currentTarget.value); setStatus('') }}
                  autoComplete="email"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={{ display: 'block', marginBottom: mobile ? 3 : 4 }}>{copy.password}</span>
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
                <label style={labelStyle}>
                  <span style={{ display: 'block', marginBottom: mobile ? 3 : 4 }}>{copy.invite}</span>
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

              <div style={{ display: 'flex', gap: mobile ? 7 : 9, marginTop: mobile ? 8 : 10 }}>
                {mode === 'login' ? (
                  <>
                    <button type="submit" className="pawcream-signin-action" style={primaryActionStyle}>{copy.login}</button>
                    <button type="button" className="pawcream-signin-action" onClick={() => switchMode('register')} style={actionStyle}>{copy.register}</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="pawcream-signin-action" onClick={() => switchMode('login')} style={actionStyle}>{copy.login}</button>
                    <button type="submit" className="pawcream-signin-action" style={primaryActionStyle}>{copy.register}</button>
                  </>
                )}
              </div>

              <div
                aria-live="polite"
                style={{
                  minHeight: mobile ? 22 : 27,
                  marginTop: mobile ? 6 : 8,
                  padding: status ? (mobile ? '5px 7px' : '6px 9px') : 0,
                  border: status ? '1px solid rgba(190, 214, 230, .55)' : '1px solid transparent',
                  borderRadius: mobile ? 8 : 9,
                  background: status ? 'rgba(238, 247, 252, .66)' : 'transparent',
                  boxShadow: status ? '0 4px 12px rgba(117, 157, 184, .07)' : 'none',
                  fontSize: mobile ? 10.5 : 12,
                  lineHeight: 1.4,
                  color: '#7894a7',
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
