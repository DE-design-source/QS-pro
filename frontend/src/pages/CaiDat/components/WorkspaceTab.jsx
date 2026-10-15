import { WORKSPACE_MEMBERS } from '../../../data/caiDatData'
import { cardStyle, listCardStyle, listHeadStyle, titleStyle, smallPrimaryBtnStyle, Field } from './shared'

const gridCols = { display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr', gap: 10 }

/* Tab "Workspace" — thông tin công ty & danh sách thành viên */
export default function WorkspaceTab() {
  return (
    <>
      <div style={cardStyle}>
        <h3 style={titleStyle(14)}>Thông tin công ty</h3>
        <Field label="Tên công ty" type="text" defaultValue="Công ty CP Xây dựng SiteFlow" />
        <Field label="Múi giờ" last>
          <option>(GMT+7) Hồ Chí Minh</option>
        </Field>
      </div>
      <div style={listCardStyle}>
        <div style={listHeadStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700 }}>Thành viên workspace</h3>
          <button style={smallPrimaryBtnStyle}>+ Mời thành viên</button>
        </div>
        <div style={{ ...gridCols, padding: '8px 4px', fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          <span>Họ tên</span><span>Vai trò</span><span>Quyền</span>
        </div>
        {WORKSPACE_MEMBERS.map((m, i) => (
          <div key={m.name} style={{ ...gridCols, alignItems: 'center', padding: '10px 4px', ...(i < WORKSPACE_MEMBERS.length - 1 ? { borderBottom: '1px solid var(--border)' } : {}) }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.role}</span>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: m.admin ? 'var(--primary-tint)' : 'var(--surface-alt)', color: m.admin ? 'var(--primary)' : 'var(--text-muted)', fontSize: 10.5, fontWeight: 600, justifySelf: 'start' }}>{m.perm}</span>
          </div>
        ))}
      </div>
    </>
  )
}
