import { cardStyle, titleStyle, primaryBtnStyle, Field, RowText, ToggleSwitch } from './shared'

/* Tab "Bảo mật" — đổi mật khẩu & 2FA */
export default function SecurityTab() {
  return (
    <>
      <div style={cardStyle}>
        <h3 style={titleStyle(14)}>Đổi mật khẩu</h3>
        <Field label="Mật khẩu hiện tại" type="password" placeholder="••••••••" />
        <Field label="Mật khẩu mới" type="password" placeholder="••••••••" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={primaryBtnStyle}>Cập nhật mật khẩu</button>
        </div>
      </div>
      <div style={cardStyle}>
        <div className="cd-settings-row" style={{ borderBottom: 'none', paddingTop: 0 }}>
          <RowText title="Xác thực hai lớp (2FA)" desc="Yêu cầu mã OTP khi đăng nhập thiết bị mới" />
          <ToggleSwitch />
        </div>
      </div>
    </>
  )
}
