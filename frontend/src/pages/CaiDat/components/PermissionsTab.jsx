import { useState } from 'react'
import { PERM_MODULES, permOnly, createRoleGroups } from '../../../data/caiDatData'
import { cardStyle, listCardStyle, listHeadStyle, titleStyle, descStyle, smallPrimaryBtnStyle } from './shared'

/* Tab "Phân quyền" — nhóm chức vụ, ma trận quyền xem module, quyền giao việc / duyệt */
export default function PermissionsTab() {
  const [groups, setGroups] = useState(createRoleGroups)

  /* Cập nhật một nhóm theo chỉ số (tạo object mới để React render lại) */
  function patchGroup(idx, fn) {
    setGroups(prev => prev.map((g, i) => i === idx ? fn(g) : g))
  }

  function removeGroup(idx) {
    if (!window.confirm('Xoá nhóm chức vụ "' + groups[idx].name + '"?')) return
    setGroups(prev => prev.filter((_, i) => i !== idx))
  }

  function addGroup() {
    const name = window.prompt('Tên nhóm chức vụ mới (VD: Trưởng phòng, Giám sát công trường...):', '')
    if (name === null || !name.trim()) return
    const members = parseInt(window.prompt('Số thành viên trong nhóm:', '1'), 10) || 1
    setGroups(prev => [...prev, { name: name.trim(), members, canAssign: false, canApprove: false, perms: permOnly(['newsfeed', 'chat', 'wiki']) }])
  }

  const togglePerm = (gi, key) => patchGroup(gi, g => ({ ...g, perms: { ...g.perms, [key]: !g.perms[key] } }))
  const toggleFlag = (gi, flag) => patchGroup(gi, g => ({ ...g, [flag]: !g[flag] }))

  return (
    <>
      <div style={listCardStyle}>
        <div style={listHeadStyle}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700 }}>Nhóm chức vụ</h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>Gom nhân sự theo chức vụ để cấp quyền hàng loạt thay vì từng người.</p>
          </div>
          <button style={{ ...smallPrimaryBtnStyle, whiteSpace: 'nowrap' }} onClick={addGroup}>+ Thêm nhóm chức vụ</button>
        </div>
        <div>
          {groups.map((g, i) => (
            <div key={i} className="cd-role-group-row">
              <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.members} thành viên</div>
              <button className="cd-role-group-remove" onClick={() => removeGroup(i)}>Xoá</button>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={titleStyle(4)}>Phân quyền xem module theo nhóm</h3>
        <p style={descStyle}>Chọn những module mà mỗi nhóm chức vụ được phép xem (HR, Tài chính, các phòng ban khác...).</p>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table className="cd-perm-matrix mono" style={{ borderCollapse: 'collapse', fontSize: 11.5, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th>Nhóm chức vụ</th>
                {PERM_MODULES.map(m => <th key={m.key}>{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => (
                <tr key={gi}>
                  <td>{g.name}</td>
                  {PERM_MODULES.map(m => (
                    <td key={m.key}><span className={`cd-perm-check${g.perms[m.key] ? ' on' : ''}`} onClick={() => togglePerm(gi, m.key)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={titleStyle(4)}>Giao việc &amp; duyệt đề xuất</h3>
        <p style={descStyle}>Quy định nhóm chức vụ nào được giao việc cho người khác, và nhóm nào được duyệt đề xuất / đơn mua hàng.</p>
        <div className="cd-settings-row" style={{ borderBottom: '1px solid var(--border)', alignItems: 'flex-start', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Được phép giao việc / tạo nhiệm vụ cho người khác</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g, i) => (
              <button key={i} className={`cd-perm-chip${g.canAssign ? ' on' : ''}`} onClick={() => toggleFlag(i, 'canAssign')}>{g.name}</button>
            ))}
          </div>
        </div>
        <div className="cd-settings-row" style={{ borderBottom: 'none', alignItems: 'flex-start', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Được phép duyệt đề xuất / đơn mua hàng</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g, i) => (
              <button key={i} className={`cd-perm-chip${g.canApprove ? ' on' : ''}`} onClick={() => toggleFlag(i, 'canApprove')}>{g.name}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
