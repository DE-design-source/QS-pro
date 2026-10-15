import { Fragment } from 'react'
import { Link } from 'react-router-dom'

/* Icon của hộp ghi chú (.wiki-callout) trong wiki.html */
const CALLOUT_ICONS = {
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 3a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.4c1 .4 2 .6 3 .7a2 2 0 0 1 1.6 2z" />,
  shield: <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></>,
}

/* Render nội dung inline: chuỗi, strong, em, liên kết route, liên kết nội bộ Wiki (data-page-link) */
function Inline({ c, onPageLink }) {
  if (!Array.isArray(c)) c = [c]
  return c.map((seg, i) => {
    if (typeof seg === 'string') return <Fragment key={i}>{seg}</Fragment>
    if (seg.b) return <strong key={i}>{seg.b}</strong>
    if (seg.em) return <em key={i}>{seg.em}</em>
    if (seg.route) return <Link key={i} to={seg.route} style={seg.style}>{seg.text}</Link>
    if (seg.page) {
      return <a key={i} href="#" style={seg.style} onClick={e => { e.preventDefault(); onPageLink(seg.page) }}>{seg.text}</a>
    }
    return null
  })
}

function Block({ b, headingRef, onPageLink }) {
  switch (b.t) {
    case 'p': return <p><Inline c={b.c} onPageLink={onPageLink} /></p>
    case 'h2': return <h2 id={b.id} ref={headingRef(b.id)}>{b.text}</h2>
    case 'h3': return <h3 id={b.id} ref={headingRef(b.id)}>{b.text}</h3>
    case 'ul':
    case 'ol': {
      const Tag = b.t
      return <Tag>{b.items.map((it, i) => <li key={i}><Inline c={it} onPageLink={onPageLink} /></li>)}</Tag>
    }
    case 'table':
      /* HTML gốc không có <thead>; trình duyệt tự bọc các hàng trong <tbody> */
      return (
        <table>
          <tbody>
            {b.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (cell && cell.th !== undefined
                  ? <th key={ci}><Inline c={cell.th} onPageLink={onPageLink} /></th>
                  : <td key={ci}><Inline c={cell} onPageLink={onPageLink} /></td>))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'callout':
      return (
        <div className="wk-callout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{CALLOUT_ICONS[b.icon]}</svg>
          <span><Inline c={b.c} onPageLink={onPageLink} /></span>
        </div>
      )
    default: return null
  }
}

/* Thẻ tải biểu mẫu (trang isForm) */
function FormCard({ page }) {
  return (
    <>
      <div className="wk-doc-card">
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{page.fileName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{page.fileSize} · Cập nhật {page.updated}</div>
        </div>
        {/* Bản HTML: hai nút này chưa gắn chức năng */}
        <button style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Xem trước</button>
        <button style={{ border: 'none', background: 'var(--wiki)', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Tải xuống</button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Biểu mẫu chuẩn dùng chung toàn công ty. Vui lòng không chỉnh sửa cấu trúc mẫu khi điền thông tin.</p>
    </>
  )
}

/* Cột nội dung: danh mục, tiêu đề, người cập nhật và thân bài */
export default function ArticleView({ page, contentRef, headingRef, onPageLink }) {
  return (
    <div className="wk-content" ref={contentRef}>
      <div style={{ maxWidth: 'none' }}>
        <div className="wk-page-category">{page.cat}</div>
        <h1 className="wk-page-title">{page.title}</h1>
        <div className="wk-page-meta">
          <span className="wk-page-avatar">TA</span>
          <span>Cập nhật bởi Trần Anh · {page.updated}</span>
        </div>
        <div className="wk-body">
          {page.isForm
            ? <FormCard page={page} />
            : page.blocks.map((b, i) => <Block key={i} b={b} headingRef={headingRef} onPageLink={onPageLink} />)}
        </div>
      </div>
    </div>
  )
}
