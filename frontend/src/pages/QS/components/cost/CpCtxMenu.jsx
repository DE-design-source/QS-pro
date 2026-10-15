import Icon from '../../../../components/ui/Icon'
import Pop from '../breakdown/sheet/Pop'
import { cpLabel_ } from '../../lib/columns.js'

/* Menu chuột phải chung của Chi phí / Dự án ở Bảng tính (btMenuChung_ PUB/bangtinh.js:765-787): Dòng · Cột · Sao chép · Tìm & thay.
   Bảng thường của bản gốc không có menu riêng (chỉ #tkTable của Bóc tách gắn tkCtx) nên tab chỉ mở menu này ở Bảng tính.
   Props: at {x, y}, entry (dòng lưới), col ({key}), ids (dòng đang chọn), keys (cột của vùng chọn, nếu SheetBody báo), sortKey, act {...}, onClose() */
export default function CpCtxMenu({ at, entry, col, ids, keys, sortKey, act, onClose }) {
  const ck = col ? col.key : ''
  const run = fn => () => { onClose(); fn() }
  const Mi = ({ ic, label, fn, hint, danger }) => (
    <div className={`qs-tk-cmi${danger ? ' danger' : ''}`} onClick={run(fn)}>
      <Icon name={ic} size={14} /><span>{label}</span>{hint && <i className="qs-tk-cmik">{hint}</i>}
    </div>
  )
  const Sep = () => <div className="qs-tk-cmsep" />
  return (
    <Pop anchor={at} width={260} className="qs-tk-ctx" onClose={onClose}>
      {entry && entry.type === 'item' && (
        <>
          <div className="qs-tk-cmh">Dòng</div>
          <Mi ic="plus" label="Chèn dòng trống bên dưới" fn={() => act.insertRow(ids)} />
          <Mi ic="copy" label="Nhân bản dòng" fn={() => act.dupRows(ids)} />
          <Mi ic="trash" label="Xoá các dòng đang chọn" fn={() => act.delRows(ids)} danger />
          <Sep />
        </>
      )}
      {ck && ck !== 'stt' && (
        <>
          <div className="qs-tk-cmh">{'Cột: ' + cpLabel_(ck)}</div>
          <Mi ic="sortAsc" label="Sắp xếp tăng dần" fn={() => act.sort(ck, 'asc')} />
          <Mi ic="sortDesc" label="Sắp xếp giảm dần" fn={() => act.sort(ck, 'desc')} />
          {sortKey && <Mi ic="x" label="Bỏ sắp xếp" fn={act.resetSort} />}
          <Mi ic="importDown" label="Điền xuống (Ctrl+D)" fn={() => act.fillDown(keys && keys.length ? keys : [ck], ids)} />
          {ck !== 'ten' && <Mi ic="eye" label="Ẩn cột này" fn={() => act.hideCol(ck)} />}
          <Sep />
        </>
      )}
      <Mi ic="copy" label="Sao chép" fn={act.copy} hint="Ctrl+C" />
      <Mi ic="search" label="Tìm & thay thế" fn={act.find} hint="Ctrl+F" />
    </Pop>
  )
}
