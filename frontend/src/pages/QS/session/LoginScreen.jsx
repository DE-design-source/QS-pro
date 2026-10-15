import { useEffect, useRef, useState } from 'react'
import { useQsSession } from './QsSession'

/* Màn đăng nhập QS — port #loginScreen (PUB/index.html:6612-6640, CSS 1305-1324) và doLogin_ (PUB/app.js:2456-2470).
   Phủ vùng .qs-page (position:absolute), thanh bên SiteFlow vẫn dùng được.
   Props: message (vd. "Phiên đã hết, mời đăng nhập lại."). */
export default function LoginScreen({ message }) {
  const { login } = useQsSession()
  const [user, setUser] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(message || '')
  const userRef = useRef(null)
  const pwRef = useRef(null)

  useEffect(() => { setErr(message || '') }, [message])
  useEffect(() => { const t = setTimeout(() => userRef.current && userRef.current.focus(), 60); return () => clearTimeout(t) }, [])

  async function submit() {
    if (busy) return
    if (!user.trim() || !pw) { setErr('Nhập tên đăng nhập và mật khẩu'); return }
    setBusy(true)
    try {
      await login(user, pw)
      setPw('')
    } catch (e) {
      setErr((e && e.message) || 'Đăng nhập thất bại')
      setBusy(false)
    }
  }
  const onKey = e => { if (e.key === 'Enter') submit() }

  return (
    <div className="qs-login">
      <div className="qs-login-card">
        <div className="qs-login-brand">
          <div className="qs-login-logo">DEZON<span>&nbsp;PRO</span></div>
          <div className="qs-login-tag">Hệ thống dự toán &amp; báo giá chuyên nghiệp</div>
        </div>
        <div className="qs-login-body">
          <div className="qs-login-h">Đăng nhập</div>
          <div className="qs-login-sub">Nhập tài khoản để tiếp tục</div>
          {err ? <div className="qs-login-msg" role="alert">{err}</div> : null}
          <div className="qs-login-field">
            <svg className="qs-login-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <input ref={userRef} autoComplete="username" placeholder="Tên đăng nhập" value={user}
              onChange={e => setUser(e.target.value)} onKeyDown={onKey} />
          </div>
          <div className="qs-login-field">
            <svg className="qs-login-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <input ref={pwRef} type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Mật khẩu" value={pw}
              onChange={e => setPw(e.target.value)} onKeyDown={onKey} />
            <span className={'qs-login-eye' + (show ? ' on' : '')} title="Hiện/ẩn mật khẩu"
              onClick={() => { setShow(s => !s); if (pwRef.current) pwRef.current.focus() }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            </span>
          </div>
          <button className="qs-login-btn" disabled={busy} onClick={submit}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          <div className="qs-login-foot">© Dezon Pro · Dự toán chuyên nghiệp</div>
        </div>
      </div>
    </div>
  )
}
