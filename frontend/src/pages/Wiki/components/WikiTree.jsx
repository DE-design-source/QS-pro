import { Fragment } from 'react'
import { WIKI, WIKI_TREE } from '../../../data/wikiData'

/* Icon của từng mục trong cây (giống wiki.html) */
const TREE_ICONS = {
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  check: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
}

/* Cột trái: nút "Trang mới", cây trang wiki (lọc theo ô tìm kiếm) và mục lục "Trong trang này" */
export default function WikiTree({ activeSlug, searchTerm, toc, onSelect, onTocClick }) {
  const term = searchTerm.trim().toLowerCase()

  return (
    <div className="wk-tree">
      {/* Bản HTML: nút "Trang mới" chưa gắn chức năng */}
      <div className="wk-new-page">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Trang mới
      </div>

      {WIKI_TREE.map(group => (
        <Fragment key={group.cat}>
          <div className="wk-cat">{group.cat}</div>
          {group.items.map((item, i) => {
            if (item.divider) return <div key={`d${i}`} className="wk-tree-divider" />
            const page = WIKI[item.slug]
            /* Tìm kiếm: chỉ ẩn/hiện mục theo tiêu đề, tiêu đề nhóm luôn hiện */
            const match = !term || page.title.toLowerCase().includes(term)
            return (
              <a
                key={item.slug}
                className={`wk-link${item.slug === activeSlug ? ' active' : ''}`}
                style={{ display: match ? 'flex' : 'none' }}
                onClick={e => { e.preventDefault(); onSelect(item.slug) }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{TREE_ICONS[item.icon]}</svg>
                {page.title}
              </a>
            )
          })}
        </Fragment>
      ))}

      {/* TRONG TRANG NÀY — ẩn khi đang xem biểu mẫu */}
      <div className="wk-toc" style={toc ? undefined : { display: 'none' }}>
        <div className="wk-toc-title">Trong trang này</div>
        <div className="wk-toc-list">
          {toc && toc.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Không có mục lục.</span>}
          {toc && toc.map(h => (
            <a
              key={h.id}
              href={`#${h.id}`}
              style={h.t === 'h3'
                ? { fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'none', lineHeight: 1.4, paddingLeft: 12 }
                : { fontSize: 12.5, textDecoration: 'none', lineHeight: 1.4, fontWeight: 600, color: 'var(--text)' }}
              onClick={e => { e.preventDefault(); onTocClick(h.id) }}
            >
              {h.text}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
