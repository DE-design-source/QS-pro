import { useState } from 'react'
import Icon from '../../../../components/ui/Icon'
import { dashSearch_ } from '../../lib/dashModel.js'
import { openProjDlg } from '../project/projectActions'
import ProjectCard from './ProjectCard'

/* Danh sách dự án (port dashProjSection_ / dashProjCards_, PUB/dash.js:196-212, 249): tìm theo tên dự án, khách hàng, SĐT.
   Props: groups = projectGroups(projects) (mỗi nhóm = 1 dự án, nhiều bản nháp), curMa = mã bản nháp đang mở. */
export default function ProjectList({ groups, curMa }) {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase().trim()
  const shown = dashSearch_(groups, query)

  return (
    <div className="qs-card qs-dash-list">
      <div className="qs-dash-list-head">
        <Icon name="home" size={18} className="qs-dash-accent" />
        <h3 className="qs-dash-title">Danh sách dự án</h3>
        <span className="qs-dash-count">{groups.length}</span>
        <span style={{ flex: 1 }} />
        <div className="qs-dash-search">
          <Icon name="search" size={14} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm dự án, khách hàng…" />
        </div>
        <button type="button" className="qs-dash-create" onClick={() => openProjDlg('create')}><Icon name="plus" size={14} />Tạo dự án</button>
      </div>
      {shown.length
        ? (
          <div className="qs-dash-project-grid">
            {shown.map(g => <ProjectCard key={g.drafts[0].maDA} group={g} curMa={curMa} />)}
          </div>
        )
        : (
          <div className="qs-dash-empty">
            {q ? `Không tìm thấy dự án khớp "${q}".` : <>Chưa có dự án. Bấm <b>Tạo dự án</b> để bắt đầu.</>}
          </div>
        )}
    </div>
  )
}
