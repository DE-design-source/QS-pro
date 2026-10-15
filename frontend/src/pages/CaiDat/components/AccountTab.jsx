import { cardStyle, titleStyle, primaryBtnStyle, Field } from './shared'

/* Tab "Tài khoản" — thông tin cá nhân (các nút không có xử lý, giống bản HTML) */
export default function AccountTab() {
  return (
    <div style={cardStyle}>
      <h3 style={titleStyle(16)}>Thông tin tài khoản</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flex: 'none' }}>TA</div>
        <div>
          <button style={{ border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text)', padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Đổi ảnh đại diện</button>
        </div>
      </div>
      <Field label="Họ tên" type="text" defaultValue="Trần Anh" />
      <Field label="Email" type="text" defaultValue="tran.anh@siteflow.vn" />
      <Field label="Chức vụ" type="text" defaultValue="Quản lý dự án" />
      <Field label="Số điện thoại" type="text" defaultValue="0909 111 222" last />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={primaryBtnStyle}>Lưu thay đổi</button>
      </div>
    </div>
  )
}
