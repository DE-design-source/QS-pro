/* CSS tài liệu báo giá - QS_DOC_CSS của bản gốc (PUB/baogia.js:590-694) chép nguyên văn, rồi:
     - đổi tên class qua docClass_ (.qs-page -> .qsd-pg, .qs-doc -> .qsd-doc, qx-/qp-/qc-/qd/qsum/qpager/qpg -> qsd-...) [F1];
     - màu chủ đạo thay 5 sắc navy như bgDocCss_ (696);
     - trên màn hình: mọi selector có tiền tố vùng xem trước (scopeCss), thẻ <style> nằm trong component, không vào document.head;
     - bản in (printDoc 699-715): CSS riêng trong cửa sổ in. */
import { docClass_ } from './docModel'
import { BG_MAU_DS } from '../../lib/quote.js'

const QS_DOC_CSS = ''
+ '.qs-doc{display:flex;justify-content:center;margin:16px 0 4px;overflow-x:auto;padding-bottom:6px}'
+ '.qs-page{width:1123px;min-height:794px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;box-shadow:0 8px 30px rgba(20,40,80,.10);padding:54px 60px 48px;box-sizing:border-box;position:relative;font-family:Arial,Helvetica,sans-serif;color:#1f2937}'
+ '.qp-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#9aa4b2;border-bottom:1px solid #eef1f4;padding-bottom:9px;margin-bottom:28px}'
+ '.qp-proj{font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.4px}'
+ '.qp-foot{position:absolute;left:60px;right:60px;bottom:22px;display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:10px;color:#aab3c0;border-top:1px solid #eef1f4;padding-top:8px}'
+ '.qp-foot .qp-mid{flex:1;text-align:center;color:#6b7280;font-weight:600;letter-spacing:.02em}'
+ '.qp-title{font-size:19px;font-weight:800;letter-spacing:.5px;text-align:center;margin:4px 0 24px;color:#1f2937}'
+ '.qp-title.sm{font-size:15px;margin:2px 0 16px;text-align:left;color:#0f2942}'
+ '.qc-cover{text-align:center;margin:2px 0 20px}'
+ '.qc-title{font-size:22px;font-weight:800;letter-spacing:.6px;color:#0f2942}'
+ '.qc-sub{font-size:12.5px;font-style:italic;color:#64748b;margin-top:3px}'
+ '.qc-code{font-size:12px;color:#475569;margin-top:8px}'
+ '.qc-info{width:100%;border-collapse:collapse;margin-top:16px;text-align:left;table-layout:fixed}'
+ '.qc-info td{border:1px solid #dfe4ea;padding:8px 10px;font-size:12px;vertical-align:middle}'
+ '.qc-info td.k{background:#f4f6f9;color:#5b6b7b;font-weight:600;width:20%}'
+ '.qc-info td.v{color:#1f2937;font-weight:600;width:30%}'
+ '.qsum-card{border:1px solid #ececec;border-radius:12px;padding:12px 26px}'
+ '.qx-img{width:100%;height:auto;max-height:240px;object-fit:contain;display:block;margin:0 auto;background:#fff}'
+ '.qx-ma{display:block;font-size:8px;color:#9aa3af;font-weight:400;margin-top:1px}'
+ '.qx-cover td.hm{font-weight:700}'
+ '.qx-cover tr.lv1 td{font-weight:700;background:#fafbfc}'
+ '.qx-cover tr.lv3 td:first-child{padding-left:14px}'
+ '.qsum{width:100%;border-collapse:collapse}'
+ '.qsum td{padding:9px 2px;vertical-align:baseline}'
+ '.qsum .amt{width:150px;color:#374151;font-variant-numeric:tabular-nums}'
+ '.qsum .pct{width:78px;text-align:right;color:#374151}'
+ '.qsum tr.lv1 td{font-weight:700;font-size:14px;border-top:1px solid #ededed}'
+ '.qsum tr.lv1:first-child td{border-top:none}'
+ '.qsum tr.lv2 td{font-weight:400;font-size:12.5px;color:#6b7280}'
+ '.qsum tr.lv2 .nm{padding-left:22px}'
+ '.qsum tr.qsum-tot td{border-top:2px solid #222;font-weight:800;font-size:14px;padding-top:12px}'
+ '.qd{width:100%;border-collapse:collapse;font-size:12px}'
+ '.qd-h th{background:#0f2942;color:#fff;font-weight:600;padding:9px 8px;text-align:left;font-size:11px;letter-spacing:.3px}'
+ '.qd-h th.num{text-align:right}'
+ '.qd td{padding:8px;border-bottom:1px solid #eef1f4;vertical-align:top}'
+ '.qd td.num{text-align:right;font-variant-numeric:tabular-nums}'
+ '.qd td.ct{text-align:center;color:#64748b}'
+ '.qd .qd-sec td{background:#f1f5f9;font-weight:700;color:#0f2942;padding:7px 8px}'
+ '.qd-br{color:#94a3b8;font-weight:400;font-size:11px}'
+ '.qd-desc{color:#94a3b8;font-size:10.5px;margin-top:2px;line-height:1.35}'
+ '.qd-sum td{font-size:13px;padding:10px 8px}'
+ '.qd-sum .qd-grand td{border-top:2px solid #0f2942;font-weight:800;font-size:15px;color:#0f2942}'
+ '.qpager{display:flex;gap:8px;justify-content:center;align-items:center;margin:14px 0 30px}'
+ '.qpg{min-width:34px;height:34px;padding:0 8px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;font-weight:600;color:#475569;cursor:pointer;font-size:14px}'
+ '.qpg:hover{border-color:#c3ccd8}'
+ '.qpg.on{background:#111827;color:#fff;border-color:#111827}'
+ '.qpg-ell{color:#94a3b8;padding:0 2px}'
+ '.qx-page{padding:34px 38px 42px}'
+ '.qx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:4px}'
+ '.qx-brand{font-size:26px;font-weight:700;letter-spacing:.16em;color:#0f2942;line-height:1}'
+ '.qx-org{font-size:9.5px;color:#5b6b7b;line-height:1.65;margin-top:8px;letter-spacing:.01em}'
+ '.qx-titlebox{background:#12314f;color:#fff;text-align:center;padding:13px 22px;min-width:280px}'
+ '.qx-titlebox .t1{font-size:12.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase}'
+ '.qx-titlebox .t2{font-size:11px;font-weight:500;margin-top:5px;letter-spacing:.04em;color:#c7d6e6}'
+ '.qx-info{width:100%;border-collapse:collapse;margin:20px 0 0;table-layout:fixed;border-top:1px solid #dbe1e9;border-bottom:1px solid #dbe1e9}'
+ '.qx-info td{padding:8px 12px;font-size:10.5px;vertical-align:top;border-bottom:1px solid #eef1f5}' + '.qx-info tr:last-child td{border-bottom:none}'
+ '.qx-info td.k{font-weight:600;color:#8a96a5;width:16%;font-size:9px;letter-spacing:.06em;text-transform:uppercase;padding-top:10px}'
+ '.qx-info td.v{color:#1f2937;width:34%;font-weight:500}'
+ '.qx-secttl{font-size:10.5px;font-weight:600;color:#12233a;letter-spacing:.12em;text-transform:uppercase;margin:22px 0 8px;padding-bottom:6px;border-bottom:1px solid #dbe1e9}'
+ '.qx-tbl{width:100%;border-collapse:collapse;font-size:10.5px}'
+ '.qx-tbl th{background:#12314f;color:#fff;font-weight:600;padding:9px 8px;text-align:left;font-size:9px;vertical-align:middle;border-right:1px solid #ffffff1f;text-transform:uppercase;letter-spacing:.05em;line-height:1.25}'
+ '.qx-tbl th.num{text-align:right}.qx-tbl th.ct{text-align:center}'
+ '.qx-tbl th:last-child{border-right:none}'
+ '.qx-tbl td{padding:8px;border-right:1px solid #e6eaef;border-bottom:1px solid #eef1f5;vertical-align:top;line-height:1.45}'
+ '.qx-tbl td:last-child{border-right:none}'
+ '.qx-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}'
+ '.qx-tbl td.ct{text-align:center}'
+ '.qx-tbl td.it{font-style:italic;color:#4b5563}'
+ '.qx-tbl tr.sec td{background:#eef1f5;font-weight:600;color:#12233a;letter-spacing:.02em;border-top:1px solid #d5dce4;border-bottom:1px solid #d5dce4}'
+ '.qx-desc{color:#6b7280;font-size:9.5px;line-height:1.35;margin-top:2px}'
+ '.qx-totbox{margin-top:0}'
+ '.qx-totbox td{background:#12314f;color:#fff;padding:9px 12px;font-size:11.5px;font-weight:600;border-right:none;border-bottom:1px solid #ffffff1a;font-variant-numeric:tabular-nums}' + '.qx-totbox tr:last-child td{background:#0e2740;font-size:12.5px;font-weight:700}'
+ '.qx-totbox td.lbl{text-align:right;letter-spacing:.06em;text-transform:uppercase;font-size:10px;font-weight:500;color:#c7d6e6}'
+ '.qx-notes{background:#f7f9fb;border:1px solid #e6eaef;padding:12px 16px;margin-top:18px;font-size:10px;color:#4b5563;line-height:1.6}'
+ '.qx-notes .h{font-weight:600;margin-bottom:5px;color:#12233a;letter-spacing:.05em;text-transform:uppercase;font-size:9px}'
+ '.qx-notes ol{margin:0;padding-left:20px}.qx-notes li{margin:3px 0}'
+ '.qx-sign{display:flex;margin-top:18px;border:1px solid #e6eaef}'
+ '.qx-tbl{table-layout:fixed}'
+ '.qx-tbl th,.qx-tbl td{overflow-wrap:anywhere;word-break:break-word}'
+ '.qx-tbl th{position:relative}'
+ '.qx-tbl.qx-dense{font-size:9.5px}.qx-tbl.qx-dense th{font-size:8px;padding:7px 5px}.qx-tbl.qx-dense td{padding:6px 5px}'
+ '.qx-tbl.qx-dense2{font-size:8.5px}.qx-tbl.qx-dense2 th{font-size:7.5px;padding:6px 3px;letter-spacing:0}.qx-tbl.qx-dense2 td{padding:5px 3px}'
+ '.qx-tbl th[draggable]{cursor:grab}.qx-tbl th[draggable]:active{cursor:grabbing}'
+ '.qxrsz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:2}'
+ '.qxrsz:hover{background:#ffffff55}'
+ '@media print{.qxrsz{display:none}}'
+ '.qx-sign .col{flex:1}.qx-sign .col:first-child{border-right:1px solid #d9dee5}'
+ '.qx-sign .hd{background:#f7f9fb;font-weight:600;font-size:10px;padding:9px;color:#12233a;text-align:center;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #e6eaef}'
+ '.qx-sign .sp{height:90px}'
+ '.qx-sign .nm{text-align:center;font-size:10.5px;font-weight:600;color:#12233a;padding:0 8px 10px;min-height:22px}'
+ '.qx-logo{max-height:46px;max-width:190px;object-fit:contain;display:block;margin-bottom:6px}'
+ '.qx-brand.sm{font-size:15px;letter-spacing:.06em}'
+ '.qx-titlebox .t3{font-size:10px;margin-top:7px;color:#c7d6e6;letter-spacing:.02em}.qx-titlebox .t3 b{color:#fff}'
+ '.qx-totbox tr.grand td{background:#0b2438;font-size:12.5px;font-weight:700}.qx-totbox tr.grand td.lbl{color:#fff;font-size:10.5px}'
+ '.qx-bangchu{border:1px solid #e6eaef;border-top:none;padding:8px 12px;font-size:10.5px;color:#12233a;background:#fbfcfd}'
+ '.qx-bangchu i{color:#6b7785}'
+ '.qx-dot{margin-top:14px;border:1px solid #e6eaef}'
+ '.qx-dot .h{background:#f7f9fb;padding:7px 12px;font-size:9px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#12233a}'
+ '.qx-dot table{width:100%;border-collapse:collapse;font-size:10.5px}'
+ '.qx-dot th{font-size:9px;font-weight:600;color:#6b7785;text-align:left;padding:6px 12px;border-top:1px solid #eef1f4}'
+ '.qx-dot td{padding:6px 12px;border-top:1px solid #eef1f4;color:#1f2d3d}'
+ '.qx-dot .num{text-align:right;font-variant-numeric:tabular-nums}'

/* Đổi tên class trong phần selector (phần khai báo không có ".chữ" nên regex không đụng tới) */
function renameCss_(css) {
  return css.replace(/\.([a-zA-Z][\w-]*)/g, (m, tok) => '.' + docClass_(tok))
}
const DOC_CSS = renameCss_(QS_DOC_CSS)

/* bgDocCss_: CSS theo MÀU chủ đạo (thẻ "Giao diện báo giá"), dùng cho cả màn hình lẫn bản in */
export function bgDocCss_(mau) {
  return !mau || mau === BG_MAU_DS[0] ? DOC_CSS : DOC_CSS.replace(/#0f2942|#12233a|#12314f|#0e2740|#0b2438/gi, mau)
}

/* Gắn tiền tố vùng cho mọi selector (kể cả trong @media) - CSS tài liệu chỉ áp trong vùng xem trước */
export function scopeCss(css, scope) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open < 0) break
    const sel = css.slice(i, open).trim()
    if (sel.charAt(0) === '@') {
      let depth = 1; let j = open + 1
      while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++ }
      out += sel + '{' + scopeCss(css.slice(open + 1, j - 1), scope) + '}'
      i = j
      continue
    }
    const close = css.indexOf('}', open)
    out += sel.split(',').map(s => scope + ' ' + s.trim()).join(',') + css.slice(open, close + 1)
    i = close + 1
  }
  return out
}

/* CSS trang xem trước: bỏ khối @media (chỉ có @media print ẩn tay kéo cột, bản in đã tự ẩn trong printCss_) để không thêm
   @media print nào vào trang SiteFlow, rồi gắn tiền tố vùng xem trước */
export function docScreenCss(mau, scope) {
  return scopeCss(bgDocCss_(mau).replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ''), scope)
}

/* printDoc: CSS của cửa sổ in (A4 ngang, bỏ khung, mỗi trang 1 tờ, ẩn tay kéo cột) */
export function printCss_(css) {
  return css
    + '@page{size:A4 landscape;margin:0}'
    + 'body{margin:0;background:#fff}'
    + '.qsd-doc{margin:0;display:block}'
    + '.qsd-pg{border:none;border-radius:0;box-shadow:none;margin:0 auto;page-break-after:always;width:297mm;min-height:209mm;padding:16mm 15mm 18mm}'
    + '.qsd-pg:last-child{page-break-after:auto}'
    + '.qsd-qp-foot{left:15mm;right:15mm;bottom:8mm}'
    + '.qsd-qxrsz{display:none}'
}
