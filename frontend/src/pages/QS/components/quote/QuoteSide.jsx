import { useState } from 'react'
import Icon from '../../../../components/ui/Icon'
import QsIcon from '../common/QsIcon'
import ChangeInput from './ChangeInput'
import NodePicker from './NodePicker'
import { PresetPopover } from '../breakdown/sheet/ColsTools'
import { toggleCol, myCols } from '../breakdown/sheet/tkCols'
import { setVat } from '../breakdown/sheet/bocActions'
import { COLS, COLSET, csQuickLabel_ } from '../../lib/columns.js'
import { money, tkNum_ } from '../../lib/format.js'
import { currentGroup, draftName_ } from '../../lib/dashModel.js'
import {
  BG_MAU_DS, BG_NOI_BO, bgNoiBoXuat_, bgNoiBoBat_, bgBiaCanh_, bgLines_, bgPTRows_, bgOpt_, bgTong_, computeQuoteLocal, bgGhiChu_, docSoVN_,
} from '../../lib/quote.js'
import { bgDocCols_ } from './docModel'
import {
  useQuoteUi, setQ, setCoverMau, bgSetPer_, bgTogglePerSec_, bgColReset_, bgColTuyBien_,
} from './quoteState'
import { bgChot, bgMauDat, bgNoiBoDat, bgOptSet, bgOrgEdit, bgDotSet, bgDotAdd, bgDotDel } from './quoteActions'

const PER_OPTS = [['0', 'Tự động'], ['8', '8'], ['10', '10'], ['12', '12'], ['15', '15'], ['18', '18'], ['20', '20'], ['25', '25'], ['30', '30']]

/* Thẻ đánh số của cột trái (bgThe_ PUB/baogia.js:525-527) */
function The({ so, ten, phu, className = '', children }) {
  return (
    <section className={`qsq-card${className ? ' ' + className : ''}`}>
      <header><i>{so}</i><div><b>{ten}</b>{phu ? <span>{phu}</span> : null}</div></header>
      {children}
    </section>
  )
}
/* Công tắc bật / tắt (bgCongTac_ 528-530) */
function CongTac({ on, nhan, tip, onToggle }) {
  return (
    <label className="qsq-sw" title={tip}>
      <span>{nhan}</span><input type="checkbox" checked={on} onChange={e => onToggle(e.target.checked)} /><em />
    </label>
  )
}

/* Khối "Tổng kết & điều khoản" (bgTkPanel_ 1131-1159) đặt trong thẻ 5 */
function TkPanel({ ctx, open, onToggle }) {
  const o = bgOpt_(ctx.bgCfg)
  const q = bgTong_(computeQuoteLocal(false, ctx).subtotal, ctx.bgCfg, ctx.cur && ctx.cur.vat)
  const tongDot = o.dot.reduce((a, d) => a + (Number(d[1]) || 0), 0)
  const ghi = o.ghiChu != null ? o.ghiChu : bgGhiChu_(q, ctx.bgCfg).join('\n')
  return (
    <div>
      <div className="qsq-tk-h" onClick={onToggle}>
        <QsIcon name="money" size={15} /><span style={{ flex: 1 }} />
        <button type="button" className="qs-qt-btn" title="Tên, logo, địa chỉ in trên báo giá" onClick={e => { e.stopPropagation(); bgOrgEdit() }}>
          <Icon name="building" size={14} />Thông tin công ty</button>
        <span className="qsq-tk-car">{open ? '▴' : '▾'}</span>
        <span className="qsq-tk-sum">Tạm tính <b>{money(q.sub)}</b>{q.ck ? <> · CK <b>−{money(q.ck)}</b></> : null} · VAT <b>{money(q.vat)}</b> · Tổng <b className="g">{money(q.total)} đ</b></span>
      </div>
      {open && (
        <div className="qsq-tk-b">
          <div className="qsq-tk-c">
            <label>Chiết khấu tổng đơn</label>
            <div className="qsq-tk-ck">
              <ChangeInput type="text" inputMode="decimal" value={o.ckKieu === 'vnd' ? money(o.ck) : o.ck} onCommit={v => bgOptSet('ck', tkNum_(v))} />
              <select value={o.ckKieu} onChange={e => bgOptSet('ckKieu', e.target.value)}><option value="pct">%</option><option value="vnd">đ</option></select>
            </div>
            <label>Ngày báo giá</label>
            <ChangeInput type="date" value={o.ngay} onCommit={v => bgOptSet('ngay', v)} />
            <label>Hiệu lực (ngày)</label>
            <ChangeInput type="number" min="0" value={o.hieuLuc} onCommit={v => bgOptSet('hieuLuc', Number(v) || 0)} />
            <div className="qsq-tk-chu">{docSoVN_(q.total)}</div>
          </div>
          <div className="qsq-tk-c">
            <label>Tiến độ thanh toán <span className={Math.round(tongDot) === 100 ? 'ok' : 'bad'}>tổng {tongDot}%</span></label>
            {o.dot.map((d, i) => (
              <div key={i} className="qsq-tk-dot">
                <span className="n">{i + 1}</span>
                <ChangeInput value={d[0]} onCommit={v => bgDotSet(i, 0, v)} />
                <ChangeInput className="pc" type="number" min="0" max="100" step="any" value={Number(d[1]) || 0} onCommit={v => bgDotSet(i, 1, v)} /><i>%</i>
                <span className="tien">{money(Math.round(q.total * (Number(d[1]) || 0) / 100))} đ</span>
                <button type="button" className="x" title="Xoá đợt" onClick={() => bgDotDel(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="qs-qt-btn" onClick={bgDotAdd}>＋ Thêm đợt</button>
          </div>
          <div className="qsq-tk-c">
            <label>Ghi chú &amp; điều khoản <small>(mỗi dòng 1 ý — hiệu lực báo giá tự thêm)</small></label>
            <ChangeInput as="textarea" rows={6} value={ghi} onCommit={v => bgOptSet('ghiChu', v)} />
            {o.ghiChu != null && <button type="button" className="qs-qt-btn" onClick={() => bgOptSet('ghiChu', null)}>Dùng ghi chú mặc định</button>}
          </div>
        </div>
      )}
    </div>
  )
}

/* Cột trái của "Xem trước & Xuất" (bgSideHTML_ PUB/baogia.js:539-580): cảnh báo tờ bìa + 5 thẻ + 2 nút xuất cố định.
   m = quoteModel(...) của trạng thái hiện tại · pages = số trang · tk = cột Bóc tách {cols, order} · projects = danh sách dự án
   onExport(fmt) · onHist() mở Lịch sử */
export default function QuoteSide({ m, pages, tk, projects, onExport, onHist }) {
  const q = useQuoteUi()
  const [presetAt, setPresetAt] = useState(null)
  const ctx = m.ctx
  const vi = m.ver
  const nHist = m.hist.length
  const soDong = bgLines_(ctx).length + bgPTRows_(ctx)
  let nhap = ''
  try { const gr = currentGroup(projects, ctx.cur); nhap = draftName_(ctx.cur, gr ? gr.idx : 0) } catch (e) { nhap = '' }
  const nCot = bgDocCols_(ctx, m.ui).length
  const mau = m.mau
  const noiBo = bgNoiBoXuat_(ctx.bgCfg)
  const nb = bgNoiBoBat_(tk.cols)
  const canh = bgBiaCanh_(ctx)
  const ql = csQuickLabel_(COLSET.tk, tk.cols, myCols())

  return (
    <aside className="qsq-side">
      {canh && (
        <div className="qsq-warn"><Icon name="bell" size={15} />
          <span>Tổng tờ bìa <b>{money(canh.bia)} đ</b> khác tổng trang cuối <b>{money(canh.cuoi)} đ</b> (chưa CK/VAT) — vì {canh.ly.join(', ')}. Kiểm tra trước khi gửi khách.</span>
        </div>
      )}

      <The so={1} ten="Phiên bản báo giá" phu={(nhap || 'Bản nháp') + ' · ' + soDong + ' dòng đã bóc'}>
        <div className="qsq-ma" title="Mã báo giá · phiên bản. Sửa mã ở chế độ Chỉnh sửa (ô Mã báo giá số)"><span>Mã</span><b>{vi.ma}</b><em>v{vi.ver}</em></div>
        <div className="qsq-row2">
          <button type="button" className="qs-qt-btn" disabled={vi.trung}
            title={vi.trung ? 'Nội dung chưa đổi so với bản đã chốt' : 'Lưu nội dung báo giá hiện tại thành 1 phiên bản'}
            onClick={() => bgChot('chot')}><Icon name="check" size={14} />{vi.trung ? 'Đã chốt v' + vi.ver : 'Chốt v' + vi.ver}</button>
          <button type="button" className="qs-qt-btn" title="Xem lại / so sánh các phiên bản đã chốt hoặc đã xuất" onClick={onHist}>
            <Icon name="layers" size={14} />Lịch sử{nHist ? ' (' + nHist + ')' : ''}</button>
        </div>
      </The>

      <The so={2} ten="Nội dung các trang">
        <label className="qsq-lb">Trang 1 · Tờ bìa</label>
        <div className="qs-qt-mode qsq-seg2">
          <button type="button" className={q.coverMau === 'm1' ? 'on' : ''} onClick={() => setCoverMau('m1')}>Mẫu 1</button>
          <button type="button" className={q.coverMau === 'm1' ? '' : 'on'} onClick={() => setCoverMau('m2')}>Mẫu 2</button>
        </div>
        <label className="qsq-lb">Trang 2+ · Bảng chi tiết</label>
        <NodePicker ctx={ctx} />
        <div className="qsq-row2 lb">
          <div><label className="qsq-lb">Dòng / trang</label>
            <select className="qsq-in" title="Số dòng tối đa trên mỗi trang giấy" value={String(Number(q.bgPer) || 0)} onChange={e => bgSetPer_(e.target.value)}>
              {PER_OPTS.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
            </select></div>
          <div><label className="qsq-lb">Số trang</label><div className="qsq-in ro">{pages} trang</div></div>
        </div>
        <CongTac on={q.bgPerSec !== false} nhan="Mỗi hạng mục một trang mới" tip="Mỗi hạng mục bắt đầu ở một trang mới" onToggle={bgTogglePerSec_} />
        {bgColTuyBien_(q) && (
          <button type="button" className="qs-qt-btn qsq-full" title="Trả rộng và thứ tự cột về mặc định" onClick={bgColReset_}>
            <Icon name="x" size={13} />Đặt lại rộng / thứ tự cột</button>
        )}
      </The>

      <The so={3} ten="Cột xuất" phu={'Đang in ' + nCot + ' cột'}>
        <button type="button" className={`qs-bd-preset${presetAt ? ' on' : ''}`} title="Bật cả một bộ cột theo mục đích / bộ cột của tôi"
          onClick={e => setPresetAt(presetAt ? null : e.currentTarget)}>
          <Icon name="sliders" size={13} /><span>{ql.nhan}</span><b>{ql.on}/{ql.total}</b><i style={{ fontStyle: 'normal' }}>▾</i>
        </button>
        {presetAt && <PresetPopover anchor={presetAt} cols={tk.cols} onClose={() => setPresetAt(null)} />}
        <button type="button" className="qsq-link" onClick={() => setQ(s => ({ colMo: !s.colMo }))}>Bật / tắt từng cột <i>{q.colMo ? '▴' : '▾'}</i></button>
        {q.colMo && (
          <div className="qsq-chips">
            {COLS.map(c => <button type="button" key={c[0]} className={tk.cols[c[0]] ? 'on' : ''} onClick={() => toggleCol(c[0])}>{c[1]}</button>)}
          </div>
        )}
        <CongTac on={noiBo} nhan="Xuất kèm cột nội bộ (bản nội bộ)" tip="Giá bán lẻ NCC, CK đại lý, giá đại lý, lợi nhuận… — không gửi khách" onToggle={bgNoiBoDat} />
        <p className={`qsq-note${noiBo ? ' warn' : ''}`}>
          <Icon name="lock" size={12} /> {noiBo
            ? 'ĐANG in kèm cột nội bộ' + (nb.length ? ' (' + nb.map(k => BG_NOI_BO[k]).join(', ') + ')' : '') + ' và giá nhà thầu Phần thô — không gửi bản này cho khách.'
            : 'Cột Giá bán lẻ NCC, CK đại lý, Giá đại lý, % lợi nhuận, Margin, Lợi nhuận (VNĐ) không in trên báo giá gửi khách.'}
        </p>
      </The>

      <The so={4} ten="Giao diện báo giá" phu="Không bắt buộc · áp dụng cho cả bản in.">
        <div className="qsq-mau-h"><label className="qsq-lb">Màu tiêu đề &amp; bảng</label><code>{mau.toUpperCase()}</code>
          <ChangeInput type="color" value={mau} title="Chọn màu khác" onCommit={v => bgMauDat(v)} /></div>
        <div className="qsq-mau">
          {BG_MAU_DS.map(c => <button type="button" key={c} className={c === mau ? 'on' : ''} style={{ background: c }} title={c.toUpperCase()} onClick={() => bgMauDat(c)} />)}
        </div>
      </The>

      <The so={5} ten="Tổng kết & điều khoản" phu="VAT · chiết khấu · thanh toán · ghi chú" className="tk">
        <div className="qsq-vat"><label className="qsq-lb">VAT của dự án</label>
          <span><ChangeInput className="qsq-in" type="number" step="any" min="0" value={Number(ctx.cur && ctx.cur.vat) || 0}
            title="Dùng chung với Bóc tách / Chi phí" onCommit={v => setVat(v)} /> %</span></div>
        <TkPanel ctx={ctx} open={!!q.tkOpen} onToggle={() => setQ(s => ({ tkOpen: !s.tkOpen }))} />
      </The>

      <div className="qsq-xuat">
        <button type="button" className="qs-qt-btn green" disabled={q.exporting} onClick={() => onExport('xlsx')}>
          <Icon name="download" size={15} />{q.exporting ? 'Đang xuất…' : 'Xuất Excel'}</button>
        <button type="button" className="qs-qt-btn red" onClick={() => onExport('pdf')}><Icon name="download" size={15} />Xuất PDF / In</button>
      </div>
    </aside>
  )
}

