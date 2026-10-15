import { useEffect, useRef, useState } from 'react'
import * as api from '../../api/qsApi'
import { isAbort } from '../../api/http'
import { mediaUrl } from '../../api/files'
import { qsToast, qsAsk } from '../common/dialogs'
import QsIcon from '../common/QsIcon'
import AdmDlg from '../admin/AdmDlg'
import { CT_FEATURES } from '../admin/adminUtil'
import { MauChinhField, MAU_RE, MAU_ERR, EMAIL_RE } from '../admin/CompanyCard'
import { downscaleImage_, uploadImg_ } from './logoUpload'

/* Hộp Tạo / Phân quyền công ty #ctOv (port ctForm_, ctLogo*, ctTab_, ctToggleAll_, ctLoadUsers_, ctAddUser_, ctSave,
   PUB/congty.js:90-257). Props: c (null = tạo mới), onClose(), onSaved() (tải lại danh sách công ty). */
export default function CongTyForm({ c, onClose, onSaved }) {
  const isNew = !c
  const c0 = c || { tinhNang: CT_FEATURES.map(f => f[0]), gioiHanUser: 10, active: true }
  const [tab, setTab] = useState('info')
  const [f, setF] = useState(() => ({
    ten: c0.ten || '', ma: c0.ma || '', email: c0.email || '', sdt: c0.sdt || '',
    limit: String(c0.gioiHanUser || 10), han: c0.hanDung || '', active: c0.active !== false ? '1' : '0', ghiChu: c0.ghiChu || '',
    share: !!c0.dungSpDezon, adU: '', adE: '', adN: '', adP: '', mau: c0.mauChinh || '',
  }))
  const [feats, setFeats] = useState(() => CT_FEATURES.map(x => x[0]).filter(k => (c0.tinhNang || []).indexOf(k) >= 0))
  const [logo, setLogo] = useState(c0.logoUrl || '')
  const [logoUrlIn, setLogoUrlIn] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usersSeq, setUsersSeq] = useState(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const v = k => String(f[k] == null ? '' : f[k]).trim()
  const old = k => String(c0[k] == null ? '' : c0[k]).trim()

  /* ---- Logo: kéo/thả · bấm chọn · hoặc link ---- */
  function logoPick() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = () => { const fl = (inp.files || [])[0]; if (fl) logoUpload(fl) }
    inp.click()
  }
  async function logoUpload(file) {
    setLogoBusy(true)
    try {
      const dataUrl = await downscaleImage_(file, 512, 0.9)
      if (!dataUrl || dataUrl === '__DECODE_FAIL__') { qsToast('Không đọc được ảnh — thử PNG/JPG khác'); return }
      const tok = await uploadImg_(dataUrl, 'logo-' + Date.now() + '.png')
      if (!alive.current) return
      setLogo(tok); qsToast('Đã tải logo lên')
    } catch (e) { qsToast('Lỗi tải logo: ' + e.message) } finally { if (alive.current) setLogoBusy(false) }
  }
  function logoAddUrl() {
    const t = String(logoUrlIn).trim(); if (!t) return
    setLogo(t); setLogoUrlIn(''); qsToast('Đã dùng link ảnh làm logo')
  }
  function logoDrop(e) {
    e.preventDefault(); setDrag(false)
    const fl = [].slice.call((e.dataTransfer && e.dataTransfer.files) || []).filter(x => !x.type || /^image\//.test(x.type))[0]
    if (fl) logoUpload(fl)
  }

  async function save() {
    const d = {
      ten: v('ten'), logoUrl: String(logo || '').trim(), email: v('email'), sdt: v('sdt'), tinhNang: feats.slice(),
      gioiHanUser: Number(v('limit')) || 0, hanDung: v('han') || null,
      active: v('active') === '1', ghiChu: v('ghiChu'), dungSpDezon: !!f.share,
    }
    if (!d.ten) { qsToast('Chưa nhập tên công ty'); setTab('info'); return }
    if (!feats.length) { qsToast('Chọn ít nhất 1 tính năng cho công ty'); setTab('goi'); return }
    const mau = v('mau')
    // Chỉ kiểm dạng khi đổi (sửa công ty): email / màu cũ lưu nguyên văn không chặn việc sửa trường khác
    const mauDoi = isNew || mau !== old('mauChinh')
    if (mauDoi && mau && !MAU_RE.test(mau)) { qsToast(MAU_ERR); setTab('info'); return }
    if (d.email && (isNew || d.email !== old('email')) && !EMAIL_RE.test(d.email)) { qsToast('Email không hợp lệ'); setTab('info'); return }
    if (isNew) {
      // Email đăng nhập của quản trị (M14.1): trim + chữ thường, kiểm dạng; trống thì máy chủ dùng email công ty (đã kiểm ở trên)
      d.ma = v('ma'); d.adminUser = v('adU'); d.adminHoTen = v('adN'); d.adminPass = v('adP')
      d.adminEmail = (v('adE') || d.email).toLowerCase()
      if (d.adminUser && d.adminEmail && !EMAIL_RE.test(d.adminEmail)) { qsToast('Email đăng nhập không hợp lệ'); setTab('ad'); return }
      if (d.adminUser && String(d.adminPass).length < 4) { qsToast('Mật khẩu quản trị tối thiểu 4 ký tự'); setTab('ad'); return }
    }
    setSaving(true)
    try {
      if (!isNew) { if (mauDoi) d.mauChinh = mau; await api.updateCongTy(c.id, d); qsToast('Đã cập nhật công ty') }
      else {
        const r = await api.createCongTy(d)
        // createCongTy (như Node) không lưu màu chính -> lưu riêng bằng updateCongTy ngay sau khi tạo
        let mauLoi = ''
        if (mau && r && r.id) { try { await api.updateCongTy(r.id, { mauChinh: mau }) } catch (e) { mauLoi = e.message } }
        qsToast('Đã tạo "' + (r && r.ten) + '"' + (d.adminUser ? (' — đăng nhập: ' + d.adminUser) : '')
          + (mauLoi ? (' — chưa lưu được màu chính: ' + mauLoi) : ''))
      }
      onClose(); onSaved()
    } catch (e) { qsToast('Lỗi: ' + e.message); if (alive.current) setSaving(false) }
  }

  const tabs = [['info', 'Thông tin'], ['goi', 'Gói & tính năng'], isNew ? ['ad', 'Tài khoản quản trị'] : ['users', 'Người dùng']]
  return (
    <AdmDlg icon="building" title={isNew ? 'Tạo công ty mới' : c.ten} className="qsco-dlg" onClose={onClose}>
      <div className="qsco-tabs">
        {tabs.map(t => <button key={t[0]} type="button" className={`qsco-tab${tab === t[0] ? ' on' : ''}`} onClick={() => setTab(t[0])}>{t[1]}</button>)}
      </div>

      {tab === 'info' ? (
        <div className="qsco-form">
          <Fld label="Tên công ty *"><input value={f.ten} onChange={e => set('ten', e.target.value)} placeholder="VD: Nội thất An Phát" /></Fld>
          <Fld label="Mã công ty"><input value={f.ma} onChange={e => set('ma', e.target.value)} placeholder="tự tạo từ tên" readOnly={!isNew} /></Fld>
          <Fld label="Email liên hệ"><input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="ketoan@congty.vn" /></Fld>
          <Fld label="Điện thoại"><input value={f.sdt} onChange={e => set('sdt', e.target.value)} placeholder="09xx xxx xxx" /></Fld>
          <Fld label="Màu chính" wide><MauChinhField value={f.mau} onChange={x => set('mau', x)} /></Fld>
          <Fld label="Logo công ty" wide>
            <div className="qsco-logo-wrap" onClick={logoPick}
              onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={e => { e.preventDefault(); setDrag(false) }} onDrop={logoDrop}>
              {logoBusy ? <div className="qsco-logo-box loading"><div className="qsco-logo-t">Đang tải logo lên…</div></div>
                : logo ? (
                  <div className={`qsco-logo-box has${drag ? ' drag' : ''}`}>
                    <LogoImg src={mediaUrl(logo)} />
                    <button type="button" className="qsco-logo-x" title="Xoá logo" onClick={e => { e.stopPropagation(); setLogo('') }}>✕</button>
                    <span className="qsco-logo-swap"><QsIcon name="edit" size={12} /> Đổi logo</span>
                  </div>
                ) : (
                  <div className={`qsco-logo-box${drag ? ' drag' : ''}`}>
                    <div className="qsco-logo-ic"><QsIcon name="camera" size={24} /></div>
                    <div className="qsco-logo-t">Kéo/thả hoặc bấm để tải logo</div>
                    <div className="qsco-logo-s">PNG nền trong suốt · tối đa 5MB</div>
                  </div>
                )}
            </div>
            <div className="qsco-upurl">
              <span className="qsco-upurl-ic"><QsIcon name="link" size={13} /></span>
              <input value={logoUrlIn} onChange={e => setLogoUrlIn(e.target.value)} placeholder="Hoặc dán link ảnh…"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); logoAddUrl() } }} />
              <button type="button" className="qsco-upurl-btn" onClick={logoAddUrl}>Dùng link</button>
            </div>
          </Fld>
        </div>
      ) : null}

      {tab === 'goi' ? (
        <div>
          <div className="qsco-form">
            <Fld label="Số người dùng tối đa"><input type="number" min="1" value={f.limit} onChange={e => set('limit', e.target.value)} /></Fld>
            <Fld label={<>Hạn dùng <i className="qsco-hint">(trống = không giới hạn)</i></>}><input type="date" value={f.han} onChange={e => set('han', e.target.value)} /></Fld>
            <Fld label="Trạng thái">
              <select value={f.active} onChange={e => set('active', e.target.value)}>
                <option value="1">Đang hoạt động</option><option value="0">Tạm khoá</option>
              </select>
            </Fld>
            <Fld label="Ghi chú"><input value={f.ghiChu} onChange={e => set('ghiChu', e.target.value)} placeholder="Gói/hợp đồng…" /></Fld>
          </div>
          <div className="qsco-share">
            <label className={`qsco-sw${f.share ? ' on' : ''}`}>
              <input type="checkbox" checked={f.share} onChange={e => set('share', e.target.checked)} />
              <span className="qsco-sw-b" />
              <span className="qsco-sw-t"><b>Cho dùng danh sách sản phẩm của Dezon</b>
                <i>Công ty thấy thêm kho SP mẫu của Dezon (chỉ xem, không sửa/xoá được). Vẫn nhập được SP riêng.</i></span>
            </label>
          </div>
          <div className="qsco-feat">
            <div className="qsco-feat-h">Tính năng được dùng
              <button type="button" className="qsco-all" onClick={() => setFeats(CT_FEATURES.map(x => x[0]))}>Chọn hết</button>
              <button type="button" className="qsco-all" onClick={() => setFeats([])}>Bỏ hết</button>
            </div>
            <div className="qsco-feat-b">
              {CT_FEATURES.map(x => {
                const on = feats.indexOf(x[0]) >= 0
                return (
                  <label key={x[0]} className={`qsco-fchk${on ? ' on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={e => setFeats(p => (e.target.checked
                      ? CT_FEATURES.map(y => y[0]).filter(k => k === x[0] || p.indexOf(k) >= 0) : p.filter(k => k !== x[0])))} />
                    <span>{x[1]}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'ad' && isNew ? (
        <div>
          <p className="qsco-note">Tạo sẵn tài khoản quản trị để bàn giao cho công ty. Họ đăng nhập được bằng <b>tên đăng nhập hoặc email</b>.</p>
          <div className="qsco-form">
            <Fld label="Tên đăng nhập"><input value={f.adU} onChange={e => set('adU', e.target.value)} placeholder="vd: anphat.admin" /></Fld>
            <Fld label="Email đăng nhập"><input type="email" value={f.adE} onChange={e => set('adE', e.target.value)} placeholder="admin@congty.vn" /></Fld>
            <Fld label="Họ tên"><input value={f.adN} onChange={e => set('adN', e.target.value)} placeholder="Nguyễn Văn A" /></Fld>
            <Fld label="Mật khẩu"><input type="password" value={f.adP} onChange={e => set('adP', e.target.value)} placeholder="≥4 ký tự" /></Fld>
          </div>
        </div>
      ) : null}

      {tab === 'users' && !isNew ? <CtUsers c={c} seq={usersSeq} onAdded={() => { setUsersSeq(s => s + 1); onSaved() }} /> : null}

      <div className="qsco-f-btn">
        <button type="button" className="qsa-btn ghost sm" onClick={onClose}>Huỷ</button>
        <button type="button" className="qsa-btn blue" disabled={saving} onClick={save}>
          {saving ? 'Đang lưu…' : <><QsIcon name="check" size={15} /> {isNew ? 'Tạo công ty' : 'Lưu thay đổi'}</>}
        </button>
      </div>
    </AdmDlg>
  )
}

function Fld({ label, wide, children }) {
  return <div className={`qsco-f${wide ? ' wide' : ''}`}><label>{label}</label>{children}</div>
}

function LogoImg({ src }) {
  const [bad, setBad] = useState(false)
  return <img src={src} alt="" style={bad ? { visibility: 'hidden' } : undefined} onError={() => setBad(true)} />
}

/* Thẻ "Người dùng" khi sửa công ty (ctLoadUsers_ / ctAddUser_, PUB/congty.js:206-233) */
function CtUsers({ c, seq, onAdded }) {
  const [st, setSt] = useState({ phase: 'loading', us: [], err: '' })
  useEffect(() => {
    const ac = new AbortController()
    setSt(s => ({ ...s, phase: 'loading' }))
    api.listCongTyUsers(c.id, ac.signal).then(us => setSt({ phase: 'ready', us: us || [], err: '' }),
      e => { if (!isAbort(e)) setSt({ phase: 'error', us: [], err: e.message }) })
    return () => ac.abort()
  }, [c.id, seq])

  async function addUser() {
    const r = await qsAsk({
      title: 'Thêm tài khoản cho ' + c.ten, confirmText: 'Tạo tài khoản', required: false, fields: [
        { key: 'u', label: 'Tên đăng nhập' }, { key: 'e', label: 'Email (đăng nhập được)' },
        { key: 'n', label: 'Họ tên' }, { key: 'p', label: 'Mật khẩu (≥4 ký tự)', type: 'password' }],
    })
    if (!r) return
    if (!r.u || String(r.p).length < 4) { qsToast('Cần tên đăng nhập và mật khẩu ≥4 ký tự'); return }
    const em = String(r.e || '').trim().toLowerCase()   // như hộp Thêm tài khoản (M14.1)
    if (em && !EMAIL_RE.test(em)) { qsToast('Email không hợp lệ'); return }
    try {
      await api.createCongTyUser(c.id, { username: r.u, email: em, hoTen: r.n, password: r.p, role: 'staff', perms: [] })
      qsToast('Đã tạo tài khoản ' + r.u); onAdded()
    } catch (e) { qsToast('Lỗi: ' + e.message) }
  }

  if (st.phase === 'error') return <div className="qsa-empty" style={{ padding: 20 }}>Lỗi: {st.err}</div>
  if (st.phase !== 'ready') return <div className="qsa-empty" style={{ padding: 20 }}>Đang tải…</div>
  const lbl = {}
  CT_FEATURES.forEach(x => { lbl[x[0]] = x[1] })
  return (
    <div>
      <div className="qsco-uhead"><span>{st.us.length} / {c.gioiHanUser || '∞'} tài khoản</span>
        <button type="button" className="qsa-btn blue xs" onClick={addUser}><QsIcon name="plus" size={13} /> Thêm tài khoản</button></div>
      <div className="qsa-tblwrap">
        <table className="qsa-tbl">
          <thead><tr><th>Đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Quyền</th><th style={{ textAlign: 'center' }}>Trạng thái</th></tr></thead>
          <tbody>
            {st.us.length ? st.us.map(u => {
              const role = { super: 'Quản trị hệ thống', admin: 'Quản trị công ty', staff: 'Nhân viên' }[u.role] || u.role
              const p = u.perms || []
              return (
                <tr key={u.id}>
                  <td><b>{u.username}</b>{u.email ? <span className="qsco-ma">{u.email}</span> : null}</td>
                  <td>{u.hoTen || ''}</td><td>{role}</td>
                  <td>{u.role === 'staff'
                    ? (p.length ? p.map((k, i) => <span key={i}>{i ? ' ' : ''}<span className="qsa-permchip">{lbl[k] || k}</span></span>) : <span className="qsa-st-lk">Chưa cấp</span>)
                    : <span className="qsa-muted">Toàn quyền</span>}</td>
                  <td style={{ textAlign: 'center' }}><span className={`qsco-badge ${u.active ? 'ok' : 'locked'}`}>{u.active ? 'Hoạt động' : 'Khoá'}</span></td>
                </tr>
              )
            }) : <tr><td colSpan={5} className="qsa-empty" style={{ padding: 18 }}>Công ty chưa có tài khoản nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
