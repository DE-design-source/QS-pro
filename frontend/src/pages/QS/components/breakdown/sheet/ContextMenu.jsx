import Pop from './Pop'
import Icon from '../../../../../components/ui/Icon'
import { tkSheetSua_ } from './tkModel'

const NUMK = ['soLuong', 'giaNCC', 'giaDaiLy', 'donGia', 'donGiaCK', 'thanhTien', 'lnVnd', 'chietKhau', 'lnPct', 'ckKhach', 'donGiaBan', 'thanhTienBan', 'thanhTienVon']

/* Menu chuột phải của bảng Bóc tách, mỗi chế độ một menu như bản gốc:
     plain = Bảng thường: tkCtx PUB/app.js:210-269 (ô / dòng / cột / tô màu / tìm / xuất).
     sheet = Bảng tính: tkSheetMenu_ bangtinh.js:576-606 (dòng / tầng / cột / thêm tầng / tìm).
   Mọi việc làm qua `act` do BreakdownTab truyền vào.
   Props: mode, at {x, y} (toạ độ chuột), entry (dòng của lưới), col ({key, label}), text (chữ của ô), ids (dòng đang chọn,
          Bảng tính), cf (luật tô màu), sortKey, freezeN, frzRows, act {...}, onClose() */
export default function ContextMenu({ mode = 'plain', at, entry, col, text, ids, cf, sortKey, freezeN, frzRows, act, onClose }) {
  const item = entry && entry.type === 'item' ? entry.r : null
  const group = entry && entry.type === 'group' ? entry.g : null
  const key = col ? col.key : ''
  const run = fn => () => { onClose(); fn() }
  const Mi = ({ ic, label, fn, hint, danger }) => (
    <div className={`qs-tk-cmi${danger ? ' danger' : ''}`} onClick={run(fn)}>
      <Icon name={ic} size={14} /><span>{label}</span>{hint && <i className="qs-tk-cmik">{hint}</i>}
    </div>
  )
  const Sec = ({ t }) => <div className="qs-tk-cmh">{t}</div>
  const Sep = () => <div className="qs-tk-cmsep" />
  const groupSec = group && (
    <>
      <Sec t={'Tầng / phòng: ' + group.name} />
      <Mi ic="plus" label="Thêm hạng mục trống vào tầng này" fn={() => act.addToFloor(group)} />
      {group.id !== 'CHƯA PHÂN TẦNG' && <Mi ic="edit" label="Đổi tên tầng" fn={() => act.renameFloor(group)} />}
      <Sep />
    </>
  )

  if (mode === 'sheet') {
    return (
      <Pop anchor={at} width={260} className="qs-tk-ctx" onClose={onClose}>
        {item && (
          <>
            <Sec t="Dòng" />
            <Mi ic="search" label="Đổi sản phẩm từ danh mục…" fn={() => act.pick(item, at)} />
            <Mi ic="copy" label="Nhân bản dòng" fn={() => act.dupRow(item)} />
            <Mi ic="plus" label="Chèn dòng trống bên dưới" fn={() => act.insertRow(item)} />
            <Mi ic="trash" label="Xoá các dòng đang chọn" fn={() => act.delSel(ids || [])} danger />
            <Sep />
          </>
        )}
        {groupSec}
        {key && (
          <>
            <Sec t={'Cột: ' + col.label} />
            <Mi ic="sortAsc" label="Sắp xếp tăng dần" fn={() => act.sort(key, 'asc')} />
            <Mi ic="sortDesc" label="Sắp xếp giảm dần" fn={() => act.sort(key, 'desc')} />
            {sortKey && <Mi ic="x" label="Bỏ sắp xếp" fn={act.resetSort} />}
            {item && tkSheetSua_(key) && <Mi ic="importDown" label="Điền giá trị ô này xuống cả cột" fn={() => act.fillDownSheet(item, key, text, col.label)} />}
            {key !== 'ten' && <Mi ic="eye" label="Ẩn cột này" fn={() => act.hideCol(key)} />}
            <Mi ic="sliders" label="Chọn cột hiển thị…" fn={act.openCols} />
            <Sep />
          </>
        )}
        <Mi ic="plus" label="Thêm tầng / phòng" fn={act.addFloor} />
        <Mi ic="search" label="Tìm & thay thế" fn={act.findReplace} hint="Ctrl+F" />
      </Pop>
    )
  }

  const r = cf || {}
  const Ck = ({ rule, cls, label }) => (
    <div className={`qs-tk-cmi qs-tk-cmck${r[rule] ? ' on' : ''}`} onClick={run(() => act.cfToggle(rule))}>
      <span className="bx">{r[rule] ? '✓' : ''}</span><span className={`qs-tk-cfdot ${cls}`} /><span>{label}</span>
    </div>
  )
  const cell = item && key
  return (
    <Pop anchor={at} width={260} className="qs-tk-ctx" onClose={onClose}>
      {cell && (
        <>
          <Sec t="Ô đang chọn" />
          <Mi ic="copy" label="Sao chép ô" fn={() => act.copyCell(text)} hint="Ctrl+C" />
          <Mi ic="copy" label="Sao chép cả dòng" fn={() => act.copyRow(item)} />
          <Mi ic="edit" label="Dán vào ô" fn={() => act.pasteCell(item, key)} hint="Ctrl+V" />
          <Mi ic="trash" label="Xoá nội dung ô" fn={() => act.clearCell(item, key)} hint="Del" />
          <Sep />
        </>
      )}
      {item && (
        <>
          <Sec t="Dòng" />
          <Mi ic="check" label="Chọn dòng này" fn={() => act.selectRow(item)} />
          <Mi ic="list" label="Chọn tất cả dòng đang hiện" fn={act.selectAll} />
          <Mi ic="copy" label="Nhân bản dòng" fn={() => act.dupRow(item)} />
          <Mi ic="plus" label="Chèn dòng trống bên dưới" fn={() => act.insertRow(item)} />
          <Mi ic="trash" label="Xoá dòng này" fn={() => act.delRow(item)} danger />
          <Sep />
        </>
      )}
      {key && (
        <>
          <Sec t={'Cột: ' + col.label} />
          <Mi ic="sortAsc" label="Sắp xếp tăng dần" fn={() => act.sort(key, 'asc')} />
          <Mi ic="sortDesc" label="Sắp xếp giảm dần" fn={() => act.sort(key, 'desc')} />
          {sortKey && <Mi ic="x" label="Bỏ sắp xếp" fn={act.resetSort} />}
          {cell && <Mi ic="importDown" label="Điền giá trị ô này xuống cả cột" fn={() => act.fillDown(item, key, text)} />}
          {NUMK.indexOf(key) >= 0 && <Mi ic="gauge" label="Tính tổng cột" fn={() => act.sumCol(key, col.label)} />}
          <Mi ic="lock" label="Cố định đến cột này" fn={() => act.freezeTo(key)} />
          {freezeN > 0 && <Mi ic="x" label="Bỏ cố định cột" fn={act.unfreeze} />}
          {item && <Mi ic="lock" label="Cố định đến hàng này" fn={() => act.freezeRowTo(item)} />}
          {frzRows > 0 && <Mi ic="x" label="Bỏ cố định hàng" fn={act.unfreezeRows} />}
          <Mi ic="eye" label="Ẩn cột này" fn={() => act.hideCol(key)} />
          <Mi ic="list" label="Hiện lại tất cả cột" fn={act.showAllCols} />
          <Sep />
        </>
      )}
      <Sec t="Tô màu điều kiện" />
      <Ck rule="ln0" cls="cf-red" label="Lợi nhuận < 0" />
      <Ck rule="noPrice" cls="cf-yellow" label="Chưa có giá bán" />
      <Ck rule="sl0" cls="cf-grey" label="Số lượng = 0" />
      <Sep />
      <Mi ic="search" label="Tìm & thay thế" fn={act.findReplace} hint="Ctrl+F" />
      <Mi ic="download" label="Xuất bảng ra Excel" fn={act.gotoExport} />
    </Pop>
  )
}
