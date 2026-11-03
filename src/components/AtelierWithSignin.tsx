import { type FormEvent, useEffect, useState } from 'react'
import {
  AUTH_CHANGED_EVENT,
  OPEN_SIGNIN_EVENT,
  isPawCreamApiEnabled,
  getCurrentUser,
  updatePawCreamNickname,
  registerPawCream,
  requestPawCreamEmailCode,
  signInPawCream,
} from '../pawcreamApi'
import AtelierWithCollection from './AtelierWithCollection'

type DeviceProfile = 'desktop' | 'mobile'
type Language = 'zh' | 'en'
type AuthMode = 'login' | 'register' | 'profile'
type SigninTune = {
  printerScale: number
  fontBoost: number
}
type SigninTuneByDevice = Record<DeviceProfile, SigninTune>

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'
const LEGACY_SIGNIN_TUNE_STORAGE_KEY = 'pawcream-signin-tune-v1'
const SIGNIN_TUNE_STORAGE_KEY = 'pawcream-signin-tune-v2'
const TYPEWRITER_LOGIN_URL = `${import.meta.env.BASE_URL}assets/signin/${encodeURIComponent('打字机.png')}?v=3b38e2c6`
const TYPEWRITER_REGISTER_URL = `${import.meta.env.BASE_URL}assets/signin/${encodeURIComponent('打印机注册.png')}?v=718c91a0`
// Both images fill the same-width, bottom-anchored frame. The registration
// asset has more paper above the carriage, not a differently placed base.
const TYPEWRITER_LOGIN_RATIO = '1199 / 1312'
const TYPEWRITER_REGISTER_RATIO = '1122 / 1402'
const DEFAULT_TUNE: SigninTune = { printerScale: 116, fontBoost: 11 }
const DEFAULT_TUNE_BY_DEVICE: SigninTuneByDevice = {
  desktop: { ...DEFAULT_TUNE },
  mobile: { ...DEFAULT_TUNE },
}

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sanitizeTune(tune?: Partial<SigninTune>): SigninTune {
  return {
    printerScale: clamp(Number(tune?.printerScale ?? DEFAULT_TUNE.printerScale), 70, 130),
    fontBoost: clamp(Number(tune?.fontBoost ?? DEFAULT_TUNE.fontBoost), 0, 12),
  }
}

function readTuneByDevice(): SigninTuneByDevice {
  if (typeof window === 'undefined') return DEFAULT_TUNE_BY_DEVICE

  try {
    const raw = window.localStorage.getItem(SIGNIN_TUNE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<DeviceProfile, Partial<SigninTune>>>
      return {
        desktop: sanitizeTune(parsed.desktop),
        mobile: sanitizeTune(parsed.mobile),
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_SIGNIN_TUNE_STORAGE_KEY)
    if (legacyRaw) {
      const legacyTune = sanitizeTune(JSON.parse(legacyRaw) as Partial<SigninTune>)
      return {
        desktop: { ...legacyTune },
        mobile: { ...legacyTune },
      }
    }
  } catch {
    return DEFAULT_TUNE_BY_DEVICE
  }

  return DEFAULT_TUNE_BY_DEVICE
}

function readTuneMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('signinTune') === '1'
}

export default function AtelierWithSignin(props: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  const [language, setLanguage] = useState<Language>(readLanguage)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [profileName, setProfileName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [registerStage, setRegisterStage] = useState<'details'|'verify'>('details')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [status, setStatus] = useState('')
  const [tuneByDevice, setTuneByDevice] = useState<SigninTuneByDevice>(readTuneByDevice)
  const [copied, setCopied] = useState(false)
  const tuneMode = readTuneMode()

  const mobile = props.deviceProfile === 'mobile'
  const tune = tuneByDevice[props.deviceProfile]
  const registerPaper = mode === 'register'
  // The long registration sheet should fit mobile WebViews without a scrollbar.
  const printerScale = tune.printerScale / 100 * (mobile && registerPaper ? 0.90 : 1)
  const formFontBoost = mobile && registerPaper ? Math.min(tune.fontBoost, 2) : tune.fontBoost
  const typewriterUrl = registerPaper ? TYPEWRITER_REGISTER_URL : TYPEWRITER_LOGIN_URL
  const typewriterAspectRatio = registerPaper ? TYPEWRITER_REGISTER_RATIO : TYPEWRITER_LOGIN_RATIO
  // Use the taller image as the viewport-fit limit in BOTH modes. This way
  // switching modes never moves or rescales the typewriter's bottom hardware.
  const longPaperWidthPerHeight = (1122 / 1402 / printerScale).toFixed(4)
  const copy = language === 'zh'
    ? {
        title: 'PawCream 账号',
        email: '邮箱',
        password: '密码',
        confirmPassword: '确认密码',
        passwordMismatch: '两次输入的密码不一致',
        showPassword: '显示密码',
        hidePassword: '隐藏密码',
        invite: '邀请码',
        emailCode: '邮箱验证码',
        displayName: '昵称',
        displayNamePlaceholder: '给自己取个昵称 ♡',
        profileTitle: '修改昵称 ♡',
        saveNickname: '保存昵称',
        cancelNickname: '再想想',
        badDisplayName: '请输入 1–40 个字符的昵称',
        sendCode: '发送验证码',
        resendCode: '重新发送验证码',
        completeRegister: '验证并注册',
        editRegistration: '返回修改',
        codeSent: '验证码已发送，请查看邮箱（10 分钟有效）',
        invalidCode: '请输入收到的 6 位验证码',
        login: '登入',
        register: '注册',
        close: '关闭登入',
        badEmail: '请输入正确的邮箱地址',
        badPassword: '密码至少需要 6 位',
        badInvite: '请输入邀请码',
        preview: '当前是 GitHub Pages 预览，真实账号将在阿里云 API 接入后启用',
        working: '正在连接 PawCream 账号…',
        success: '账号已连接 ♡',
        failed: '账号操作失败，请稍后再试',
      }
    : {
        title: 'PawCream Account',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm password',
        passwordMismatch: 'Passwords do not match',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
        invite: 'Invite code',
        emailCode: 'Email verification code',
        displayName: 'Nickname',
        displayNamePlaceholder: 'Choose your nickname ♡',
        profileTitle: 'Edit nickname ♡',
        saveNickname: 'Save nickname',
        cancelNickname: 'Cancel',
        badDisplayName: 'Enter a nickname of 1–40 characters',
        sendCode: 'Send code',
        resendCode: 'Resend verification',
        completeRegister: 'Register',
        editRegistration: 'Edit',
        codeSent: 'Check your inbox (valid for 10 minutes)',
        invalidCode: 'Enter your 6-digit email code',
        login: 'Sign in',
        register: 'Register',
        close: 'Close sign in',
        badEmail: 'Please enter a valid email address',
        badPassword: 'Password must be at least 6 characters',
        badInvite: 'Please enter an invite code',
        preview: 'GitHub Pages preview mode. Real accounts will activate when the Alibaba Cloud API is connected.',
        working: 'Connecting to PawCream…',
        success: 'Account connected ♡',
        failed: 'Account request failed. Please try again.',
      }

  useEffect(() => {
    // Avoid the old short-paper image flashing when switching to registration.
    for (const src of [TYPEWRITER_LOGIN_URL, TYPEWRITER_REGISTER_URL]) {
      const image = new Image()
      image.decoding = 'async'
      image.src = src
    }
  }, [])

  useEffect(() => {
    if (tuneMode) setOpen(true)
  }, [tuneMode])

  useEffect(() => {
    document.documentElement.classList.toggle('pawcream-signin-open', open)
    return () => document.documentElement.classList.remove('pawcream-signin-open')
  }, [open])

  useEffect(() => {
    const onOpenSignin = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: AuthMode }>).detail
      const nextMode = detail?.mode === 'profile'
        ? 'profile' : detail?.mode === 'register' ? 'register' : 'login'
      setMode(nextMode)
      setLanguage(readLanguage())
      setStatus('')
      setOpen(true)
      if (nextMode === 'profile') {
        void getCurrentUser().then(user => {
          if (!user) {
            setMode('login')
            setStatus('请先登录 PawCream 账号')
          } else {
            setProfileName(user.displayName)
          }
        }).catch(error => setStatus(error instanceof Error ? error.message : '无法读取账号昵称'))
      }
    }

    window.addEventListener(OPEN_SIGNIN_EVENT, onOpenSignin)
    return () => window.removeEventListener(OPEN_SIGNIN_EVENT, onOpenSignin)
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

  const updateTune = (patch: Partial<SigninTune>) => {
    setTuneByDevice((current) => {
      const next: SigninTuneByDevice = {
        ...current,
        [props.deviceProfile]: {
          ...current[props.deviceProfile],
          ...patch,
        },
      }
      window.localStorage.setItem(SIGNIN_TUNE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const resetTune = () => {
    setTuneByDevice((current) => {
      const next: SigninTuneByDevice = {
        ...current,
        [props.deviceProfile]: { ...DEFAULT_TUNE },
      }
      window.localStorage.setItem(SIGNIN_TUNE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const copyTuneParameters = async () => {
    const text = [
      'PawCream Signin Tune',
      `desktop: printerScale=${tuneByDevice.desktop.printerScale}%, fontBoost=+${tuneByDevice.desktop.fontBoost}px`,
      `mobile: printerScale=${tuneByDevice.mobile.printerScale}%, fontBoost=+${tuneByDevice.mobile.fontBoost}px`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setRegisterStage('details')
    setEmailCode('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setStatus('')
  }

  const sendEmailCode = async () => {
    const normalizedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setStatus(copy.badEmail); return }
    if (password.length < 6) { setStatus(copy.badPassword); return }
    if (!inviteCode.trim()) { setStatus(copy.badInvite); return }
    if (!displayName.trim() || displayName.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(displayName)) {
      setStatus(copy.badDisplayName)
      return
    }
    if (!isPawCreamApiEnabled()) { setStatus(copy.preview); return }
    setSendingEmail(true)
    setStatus(copy.working)
    try {
      await requestPawCreamEmailCode(normalizedEmail, inviteCode.trim())
      setRegisterStage('verify')
      setStatus(copy.codeSent)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.failed)
    } finally { setSendingEmail(false) }
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nickname = profileName.trim()
    if (!nickname || nickname.length > 40 || /[\u0000-\u001f\u007f]/.test(nickname)) {
      setStatus(copy.badDisplayName)
      return
    }
    if (savingProfile) return
    setSavingProfile(true)
    setStatus(copy.working)
    try {
      await updatePawCreamNickname(nickname)
      setStatus(copy.success)
      window.setTimeout(() => {
        setOpen(false)
        setStatus('')
      }, 350)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.failed)
    } finally {
      setSavingProfile(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
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
    if (!isPawCreamApiEnabled()) {
      setStatus(copy.preview)
      return
    }

    if (mode === 'register' && registerStage === 'details') {
      await sendEmailCode()
      return
    }
    if (mode === 'register' && confirmPassword !== password) {
      setStatus(copy.passwordMismatch)
      return
    }
    if (mode === 'register' && (!displayName.trim() || displayName.trim().length > 40)) {
      setStatus(copy.badDisplayName)
      return
    }
    if (mode === 'register' && !/^[0-9]{6}$/.test(emailCode.trim())) {
      setStatus(copy.invalidCode)
      return
    }
    setStatus(copy.working)
    try {
      if (mode === 'login') {
        await signInPawCream(normalizedEmail, password)
      } else {
        await registerPawCream(normalizedEmail, password, inviteCode.trim(), emailCode.trim(), displayName.trim())
      }
      setStatus(copy.success)
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
      window.setTimeout(() => {
        setOpen(false)
        setPassword('')
        setConfirmPassword('')
        setShowPassword(false)
        setShowConfirmPassword(false)
        setInviteCode('')
        setEmailCode('')
        setDisplayName('')
        setRegisterStage('details')
      }, 420)
    } catch (error) {
      setStatus(error instanceof Error && error.message ? error.message : copy.failed)
    }
  }

  const inputStyle = {
    width: '100%',
    height: mobile && registerPaper ? 23 : mobile ? 27 : 32,
    boxSizing: 'border-box' as const,
    border: '1px solid rgba(176, 204, 222, .74)',
    borderRadius: mobile ? 9 : 10,
    background: 'rgba(252,254,255,.95)',
    color: '#5f7d92',
    outline: 'none',
    padding: mobile ? '4px 8px' : '5px 10px',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: (mobile ? 9 : 11) + formFontBoost,
    boxShadow: '0 4px 14px rgba(117, 157, 184, .10), inset 0 1px 0 rgba(255,255,255,.96)',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
  }

  const actionStyle = {
    minWidth: mobile && registerPaper ? 0 : mobile ? 62 : 78,
    height: mobile && registerPaper ? 24 : mobile ? 28 : 32,
    border: '1px solid rgba(166, 198, 219, .64)',
    borderRadius: mobile ? 10 : 11,
    background: 'rgba(251,253,255,.95)',
    color: '#66859c',
    cursor: 'pointer',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: (mobile ? 9 : 10) + formFontBoost,
    boxShadow: '0 4px 12px rgba(117, 157, 184, .10)',
    transition: 'transform 160ms ease, background 160ms ease, box-shadow 160ms ease',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: registerPaper ? (mobile ? 4 : 6) : (mobile ? 7 : 9),
    color: '#6f8da2',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: (mobile ? 8 : 10) + formFontBoost,
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
            zIndex: 210,
            width: mobile
              ? `min(370px, calc(100vw - 14px), calc((100svh - 82px) * ${longPaperWidthPerHeight}))`
              : `min(520px, calc(100vw - 34px), calc((100svh - 104px) * ${longPaperWidthPerHeight}))`,
            // Keep a shared width, bottom and transform origin between modes.
            // Switching aspect ratio grows the *paper upward*, with the base
            // remaining fixed above the same screen-bottom coordinate.
            aspectRatio: typewriterAspectRatio,
            transform: `translateX(-50%) scale(${printerScale})`,
            transformOrigin: 'bottom center',
            filter: 'drop-shadow(0 24px 32px rgba(7, 18, 25, .24))',
          }}
        >
          <style>{`
            @keyframes pawcream-signin-drop {
              from { opacity: 0; transform: translate(-50%, 24px) scale(${printerScale}); }
              to { opacity: 1; transform: translate(-50%, 0) scale(${printerScale}); }
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
            src={typewriterUrl}
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
              // The long registration sheet gains space above the carriage.
              // Its content starts higher; the login/profile typography and
              // positions are left untouched.
              left: registerPaper ? '25%' : '25.8%',
              top: registerPaper ? (mobile ? '3.5%' : '5.4%') : (mobile ? '10.1%' : '10.5%'),
              width: registerPaper ? '50%' : '48.4%',
              // Small laptop/mobile screens can still type into every field:
              // scroll *within the paper*, never push the typewriter base away.
              maxHeight: registerPaper ? '74%' : undefined,
              overflowY: 'visible',
              paddingBottom: registerPaper ? 4 : undefined,
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

            <header style={{
              paddingRight: mobile ? 30 : 36,
              marginBottom: registerPaper ? (mobile ? 5 : 7) : (mobile ? 9 : 11),
            }}>
              <div style={{ fontSize: (mobile ? 11 : 14) + tune.fontBoost, fontWeight: 600, letterSpacing: '.04em', color: '#64849a' }}>
                {copy.title}
              </div>
              <div style={{ marginTop: registerPaper ? 4 : 6, borderTop: '1px solid rgba(176, 204, 222, .72)' }} />
            </header>

            {mode === 'profile' ? (
              <form noValidate onSubmit={saveProfile}>
                <div style={{ color: '#64849a', fontSize: (mobile ? 9 : 12) + tune.fontBoost, marginBottom: 11 }}>
                  {copy.profileTitle}
                </div>
                <label style={labelStyle}>
                  <span style={{ display: 'block', marginBottom: mobile ? 3 : 4 }}>{copy.displayName}</span>
                  <input
                    className="pawcream-signin-input"
                    type="text"
                    autoComplete="nickname"
                    maxLength={40}
                    value={profileName}
                    onChange={(event) => { setProfileName(event.currentTarget.value); setStatus('') }}
                    placeholder={copy.displayNamePlaceholder}
                    style={inputStyle}
                  />
                </label>
                <div style={{ display: 'flex', gap: mobile ? 7 : 9, marginTop: 10 }}>
                  <button type="button" className="pawcream-signin-action" style={actionStyle}
                    onClick={() => setOpen(false)} disabled={savingProfile}>{copy.cancelNickname}</button>
                  <button type="submit" className="pawcream-signin-action" style={primaryActionStyle}
                    disabled={savingProfile}>{savingProfile ? copy.working : copy.saveNickname}</button>
                </div>
                <div aria-live="polite" style={{
                  minHeight: status ? (mobile ? 18 : 27) : 0, marginTop: status ? (mobile ? 3 : 8) : 0,
                  fontSize: (mobile ? 7.5 : 9) + formFontBoost, color: '#7894a7',
                }}>{status}</div>
              </form>
            ) : (
            <form noValidate onSubmit={submit}>
              {mode === 'register' && registerStage === 'verify' && (
                <div style={{ fontSize: (mobile ? 8 : 10) + tune.fontBoost, color:'#627f93', marginBottom: mobile ? 6 : 10, lineHeight:1.55 }}>
                  {email.trim()}
                </div>
              )}
              {(mode === 'login' || registerStage === 'details') && (
              <>
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

              <div style={labelStyle}>
                <label htmlFor="pawcream-password" style={{ display: 'block', marginBottom: mobile ? 3 : 4 }}>{copy.password}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="pawcream-password"
                    className="pawcream-signin-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => { setPassword(event.currentTarget.value); setStatus('') }}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    style={{ ...inputStyle, paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(value => !value)}
                    style={{
                      position: 'absolute', right: 3, top: 0, height: '100%', width: 30,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, border: 0, background: 'transparent',
                      color: '#66859c', cursor: 'pointer',
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="M3 3l18 18" />}
                    </svg>
                  </button>
                </div>
              </div>

              {mode === 'register' && registerStage === 'details' && (
                <label style={labelStyle}>
                  <span style={{ display: 'block', marginBottom: mobile ? 3 : 4 }}>{copy.displayName}</span>
                  <input
                    className="pawcream-signin-input"
                    type="text" autoComplete="nickname"
                    maxLength={40}
                    value={displayName}
                    onChange={e => { setDisplayName(e.currentTarget.value); setStatus('') }}
                    style={inputStyle}
                    placeholder={copy.displayNamePlaceholder}
                  />
                </label>
              )}
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
              </>
              )}
              {mode === 'register' && registerStage === 'verify' && (
                <div style={labelStyle}>
                  <label htmlFor="pawcream-confirm-password" style={{ display: 'block', marginBottom: mobile ? 3 : 4 }}>{copy.confirmPassword}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="pawcream-confirm-password"
                      className="pawcream-signin-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.currentTarget.value); setStatus('') }}
                      autoComplete="new-password"
                      style={{ ...inputStyle, paddingRight: 36 }}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? copy.hidePassword : copy.showPassword}
                      aria-pressed={showConfirmPassword}
                      onClick={() => setShowConfirmPassword(value => !value)}
                      style={{
                        position: 'absolute', right: 3, top: 0, height: '100%', width: 30,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, border: 0, background: 'transparent',
                        color: '#66859c', cursor: 'pointer',
                      }}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        aria-hidden="true">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {showConfirmPassword && <path d="M3 3l18 18" />}
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              {mode === 'register' && registerStage === 'verify' && (
                <label style={labelStyle}>
                  <span style={{ display:'block', marginBottom: mobile ? 3 : 4 }}>{copy.emailCode}</span>
                  <input
                    className="pawcream-signin-input"
                    type="text" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={6} pattern="[0-9]{6}"
                    value={emailCode}
                    onChange={e => { setEmailCode(e.currentTarget.value.replace(/\D/g,'').slice(0,6)); setStatus('') }}
                    style={inputStyle}
                    placeholder="123456"
                  />
                </label>
              )}

              <div style={{ display: 'flex', gap: mobile ? 7 : 9, marginTop: mobile ? 8 : 10 }}>
                {mode === 'login' ? (
                  <>
                    <button type="submit" className="pawcream-signin-action" style={primaryActionStyle}>{copy.login}</button>
                    <button type="button" className="pawcream-signin-action" onClick={() => switchMode('register')} style={actionStyle}>{copy.register}</button>
                  </>
                ) : registerStage === 'details' ? (
                  <>
                    <button type="button" className="pawcream-signin-action" onClick={() => switchMode('login')} style={actionStyle}>{copy.login}</button>
                    <button type="submit" disabled={sendingEmail} className="pawcream-signin-action" style={primaryActionStyle}>{sendingEmail ? copy.working : copy.sendCode}</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="pawcream-signin-action" style={actionStyle} onClick={() => {setRegisterStage('details');setStatus('')}}>{copy.editRegistration}</button>
                    <button type="submit" className="pawcream-signin-action" style={primaryActionStyle}>{copy.completeRegister}</button>
                  </>
                )}
              </div>
              {mode === 'register' && registerStage === 'verify' && (
                <button type="button" disabled={sendingEmail}
                  onClick={() => void sendEmailCode()}
                  style={{ display:'block', marginTop: mobile ? 4 : 7, padding:'2px 0', border:0,
                    background:'transparent', color:'#5f849f', fontSize:(mobile ? 7 : 9) + tune.fontBoost, cursor:'pointer' }}>
                  {sendingEmail ? copy.working : copy.resendCode}
                </button>
              )}

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
                  fontSize: (mobile ? 7.5 : 9) + tune.fontBoost,
                  lineHeight: 1.4,
                  color: '#7894a7',
                }}
              >
                {status}
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {tuneMode && (
        <aside
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            zIndex: 120,
            width: mobile ? 196 : 226,
            padding: mobile ? '10px 11px' : '12px 13px',
            border: '1px solid rgba(177, 205, 223, .78)',
            borderRadius: 14,
            background: 'rgba(248, 252, 255, .94)',
            boxShadow: '0 12px 30px rgba(65, 99, 122, .18)',
            backdropFilter: 'blur(10px)',
            color: '#5f7d92',
            fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>登入调试面板</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {(['desktop', 'mobile'] as const).map((profile) => {
              const active = props.deviceProfile === profile
              return (
                <button
                  key={profile}
                  type="button"
                  onClick={() => props.onDeviceChange(profile)}
                  style={{
                    height: 29,
                    border: '1px solid rgba(166, 198, 219, .68)',
                    borderRadius: 9,
                    background: active ? '#dfeef7' : '#f7fbfd',
                    color: active ? '#526f84' : '#7690a2',
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {profile === 'desktop' ? '电脑端' : '手机端'}
                </button>
              )
            })}
          </div>

          <div style={{ marginBottom: 10, padding: '7px 8px', borderRadius: 9, background: 'rgba(232,243,250,.72)', fontSize: 11 }}>
            当前：{mobile ? '手机端' : '电脑端'}
          </div>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span>打印机大小</span>
              <strong>{tune.printerScale}%</strong>
            </div>
            <input
              type="range"
              min="70"
              max="130"
              step="1"
              value={tune.printerScale}
              onChange={(event) => updateTune({ printerScale: Number(event.currentTarget.value) })}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span>字体大小</span>
              <strong>+{tune.fontBoost}px</strong>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={tune.fontBoost}
              onChange={(event) => updateTune({ fontBoost: Number(event.currentTarget.value) })}
              style={{ width: '100%' }}
            />
          </label>

          <button
            type="button"
            onClick={copyTuneParameters}
            style={{
              width: '100%',
              height: 31,
              marginBottom: 7,
              border: '1px solid rgba(139, 181, 209, .78)',
              borderRadius: 9,
              background: copied ? '#dceef8' : '#e8f4fb',
              color: '#58788f',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {copied ? '已复制 ✓' : '复制电脑端 + 手机端参数'}
          </button>

          <button
            type="button"
            onClick={resetTune}
            style={{
              width: '100%',
              height: 30,
              border: '1px solid rgba(166, 198, 219, .68)',
              borderRadius: 9,
              background: '#eef6fb',
              color: '#66859c',
              cursor: 'pointer',
            }}
          >
            重置当前端为 116% / +11px
          </button>
        </aside>
      )}
    </>
  )
}
