import { useEffect, useRef, useState } from 'react'
import { VALID_PAIR_CODE } from '../../../data/bimData'
import { Icon } from './shared'

const STEPS = [
  <>Cài đặt &amp; mở <strong>Dezon Bim</strong> trong SketchUp (Extensions ▸ Dezon Bim).</>,
  <>Trong Dezon Bim, đăng nhập cùng tài khoản / tổ chức SiteFlow của bạn.</>,
  <>Bấm <strong>"Scan / Đồng bộ"</strong> trong Dezon Bim — một mã liên kết 6 số sẽ hiện ra.</>,
]

/* Màn hình chưa liên kết: nhập mã ghép nối từ Dezon Bim */
export default function UnlinkedView({ visible, onLinked }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pairing, setPairing] = useState(false)
  const [checking, setChecking] = useState(false)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  // Mỗi lần quay lại màn hình này: xoá mã & lỗi cũ (giống showBimUnlinked)
  useEffect(() => { if (visible) { setCode(''); setError('') } }, [visible])

  function pair() {
    const value = code.trim()
    if (!value) { setError('Vui lòng nhập mã liên kết hiển thị trong Dezon Bim.'); return }
    setPairing(true)
    setError('')
    timers.current.push(setTimeout(() => {
      setPairing(false)
      if (value === VALID_PAIR_CODE) onLinked()
      else setError('Mã liên kết không đúng hoặc đã hết hạn. Vui lòng lấy mã mới trong Dezon Bim (demo dùng mã 482913).')
    }, 900))
  }

  function autoCheck() {
    setChecking(true)
    timers.current.push(setTimeout(() => { setChecking(false); onLinked() }, 1400))
  }

  return (
    <div className="bim-view" style={{ display: visible ? 'flex' : 'none' }}>
      <div className="bim-card" style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bim-tint)', color: 'var(--bim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
          <Icon name="cube" size={26} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Chưa liên kết mô hình SketchUp</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>Liên kết một file .skp đã cài Dezon Bim để đồng bộ Objects, Level, Room/Space, Material và BOQ về đây.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <div className="bim-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 className="bim-card-title">Các bước liên kết</h3>
          {STEPS.map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <div className="bim-level-chip active" style={{ borderRadius: '50%', flex: 'none' }}>{i + 1}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, paddingTop: 5 }}>{text}</div>
            </div>
          ))}
          <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 12, fontWeight: 600, color: 'var(--bim)', textDecoration: 'none' }}>Tải Dezon Bim cho SketchUp ›</a>
        </div>

        <div className="bim-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 className="bim-card-title">Nhập mã liên kết</h3>
          <div className="bim-field">
            <label>Mã hiển thị trong Dezon Bim</label>
            <input
              type="text"
              placeholder="VD: 482913"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') pair() }}
              style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.12em', textAlign: 'center', fontFamily: 'var(--bim-mono)' }}
            />
          </div>
          <button className="bim-btn-dark" disabled={pairing} onClick={pair}>
            <Icon name="link" size={15} stroke="#fff" />
            <span>{pairing ? 'Đang xác thực mã...' : 'Liên kết ngay'}</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>HOẶC</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <button className="bim-btn-ghost" disabled={checking} onClick={autoCheck}>
            <Icon name="refresh" />
            <span>{checking ? 'Đang kiểm tra đồng bộ từ Dezon Bim...' : 'Tôi đã đồng bộ trong Dezon Bim, kiểm tra lại'}</span>
          </button>
          {error && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{error}</div>}
        </div>
      </div>
    </div>
  )
}
