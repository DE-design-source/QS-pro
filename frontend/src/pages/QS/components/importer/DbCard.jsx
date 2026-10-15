import QsIcon from '../common/QsIcon'

/* Thẻ nhóm của form Nhập dữ liệu (port dbCard_, PUB/nhap.js:456-459). Props: title, ic (tên QsIcon), note, children. */
export default function DbCard({ title, ic, note, children }) {
  return (
    <div className="qsi-dbcard">
      <div className="qsi-dbcard-h"><span className="qsi-dbcard-ic"><QsIcon name={ic} size={18} /></span><h3>{title}</h3></div>
      <div className="qsi-dbcard-b">{note && <p className="qsi-dbnote">{note}</p>}{children}</div>
    </div>
  )
}
