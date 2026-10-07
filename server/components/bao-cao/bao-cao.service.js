'use strict';
const config = require('../../config');
const supa = require('../../libraries/supa');
const { nganhCua_, MUC_NGANH } = require('../san-pham/san-pham.mapper');

// Giờ Việt Nam (UTC+7) — dùng cho các báo cáo theo ngày bên dưới
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
function nowVN_() { return new Date(Date.now() + VN_OFFSET_MS); }

/* ═══════════════ BÁO CÁO SẢN PHẨM NHẬP MỚI → LARK ═══════════════
   Gửi vào group Lark qua ĐÚNG webhook đang dùng cho yêu cầu mua hàng.
   Lịch: THỨ 4 và THỨ 7, 8h00 sáng giờ VN.
   Khoảng thống kê tính NGƯỢC tới lần gửi trước (T4 gộp 4 ngày từ T7 trước,
   T7 gộp 3 ngày từ T4) nên server có ngủ dậy muộn cũng không sót sản phẩm nào.
   Chống gửi trùng: mỗi lần gửi ghi 1 dòng audit_log, trong ngày đã có thì thôi. */
const BAO_CAO_GIO_VN = 8;                       // 8h sáng giờ VN
const BAO_CAO_THU = [3, 6];                     // 3 = thứ 4, 6 = thứ 7
const BAO_CAO_ACTION = 'bao_cao_nhap_sp';
/* Lark ghép TÊN BOT vào trước mỗi tin ("<tên bot>: <tiêu đề thẻ>"). Bot đang dùng tên là
   "Yêu cầu mua hàng - QS pro" nên báo cáo nhập SP cũng bị dính chữ đó.
   -> Tạo thêm 1 bot riêng trong group (vd tên "Báo cáo Dezon Pro"), lấy webhook của nó
      đặt vào biến REPORT_WEBHOOK. Chưa đặt thì vẫn dùng chung webhook cũ như trước. */
const REPORT_WEBHOOK = config.reportWebhook;
function s_(v) { return String(v == null ? '' : v).trim(); }
/* Ngành hàng của 1 sản phẩm — dùng CHUNG cách nhận diện với app (cột nganh, không có thì
   đoán theo tên hạng mục): 'den' | 'vs' | 'son'. */
function tenNganh_(r) {
  try {
    const ng = nganhCua_(r.nganh, r.hang_muc);
    return MUC_NGANH[ng] || 'Thiết bị đèn';
  } catch (e) { return 'Thiết bị đèn'; }
}

// Mốc bắt đầu của kỳ này = 8h sáng của ngày gửi TRƯỚC đó trong lịch
function moBaoCaoTruoc_(vnNow) {
  const d = new Date(vnNow);
  d.setUTCHours(BAO_CAO_GIO_VN, 0, 0, 0);
  if (d > vnNow) d.setUTCDate(d.getUTCDate() - 1);          // chưa tới giờ hôm nay -> lùi 1 ngày
  do { d.setUTCDate(d.getUTCDate() - 1); }                  // lùi tới ngày gửi gần nhất trước đó
  while (BAO_CAO_THU.indexOf(d.getUTCDay()) < 0);
  return d;
}
function vnToUtcIso_(vnDate) { return new Date(vnDate.getTime() - VN_OFFSET_MS).toISOString(); }
function ddmm_(vnDate) {
  const p = function (n) { return String(n).padStart(2, '0'); };
  return p(vnDate.getUTCDate()) + '/' + p(vnDate.getUTCMonth() + 1);
}
/* Thẻ báo cáo cho MỘT công ty. Bám đúng ngôn ngữ thẻ Lark app đang dùng ở
   yêu cầu mua hàng: khối div/fields cho số liệu, column_set cho bảng.        */
function buildSpReportCard(tenCongTy, bang, tk, tuVN, denVN, khuyet, nganh) {
  const el = [];
  const md = function (t, align) { const e = { tag: 'markdown', content: t }; if (align) e.text_align = align; return e; };
  const col = function (t, w, align) {
    return { tag: 'column', width: 'weighted', weight: w, vertical_align: 'center', elements: [md(t, align)] };
  };
  const rowset = function (cols, bg) {
    const cs = { tag: 'column_set', flex_mode: 'none', horizontal_spacing: 'small', columns: cols };
    if (bg) cs.background_style = bg;
    return cs;
  };
  const fld = function (label, val) {
    return { is_short: true, text: { tag: 'lark_md', content: '<font color=\'grey\'>' + label + '</font>\n**' + val + '**' } };
  };
  // ── Khối số liệu ──
  el.push({ tag: 'div', fields: [
    fld('Sản phẩm nhập mới', String(tk.tongSP)),
    fld('Nhà cung cấp', String(tk.tongNCC)),
    fld('Người nhập', String(tk.tongNguoi)),
    fld('Kỳ báo cáo', ddmm_(tuVN) + ' → ' + ddmm_(denVN))
  ] });
  el.push({ tag: 'hr' });
  // ── Bảng: NGÀNH HÀNG · SP · NCC ── (nhập của kỳ này rơi vào ngành nào)
  if (nganh && nganh.length) {
    el.push(rowset([
      col('**NGÀNH HÀNG**', 6),
      col('**SP**', 2, 'right'),
      col('**NCC**', 2, 'right')
    ], 'grey'));
    nganh.forEach(function (n) {
      el.push(rowset([
        col(n.ten, 6),
        col('**' + n.soSP + '**', 2, 'right'),
        col(String(n.soNCC), 2, 'right')
      ]));
    });
    el.push({ tag: 'hr' });
  }
  // ── Bảng: người nhập · phòng ban · ngày · SP · NCC ──
  el.push(rowset([
    col('**NGƯỜI NHẬP**', 5),
    col('**NGÀY**', 3, 'center'),
    col('**SP**', 2, 'right'),
    col('**NCC**', 2, 'right')
  ], 'grey'));
  bang.forEach(function (p) {
    p.ngay.forEach(function (d, i) {
      el.push(rowset([
        col(i === 0
          ? ('**' + p.ten + '**\n<font color=\'grey\'>' + (p.phongBan || 'Chưa có phòng ban') + '</font>')
          : '', 5),
        col(d.ngay, 3, 'center'),
        col('**' + d.soSP + '**', 2, 'right'),
        col(String(d.soNCC), 2, 'right')
      ]));
    });
  });
  if (bang.length > 1 || bang[0].ngay.length > 1) {
    el.push(rowset([
      col('**Tổng cộng**', 5),
      col('', 3),
      col('**' + tk.tongSP + '**', 2, 'right'),
      col('**' + tk.tongNCC + '**', 2, 'right')
    ], 'grey'));
  }
  if (khuyet) el.push({ tag: 'note', elements: [{ tag: 'plain_text',
    content: '⚠️ ' + khuyet + ' sản phẩm cũ trong kỳ chưa ghi nhận người nhập — không tính vào báo cáo.' }] });
  el.push({ tag: 'note', elements: [{ tag: 'plain_text',
    content: 'Dezon Pro · Báo cáo tự động thứ 4 & thứ 7 lúc 8h00' }] });
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: tk.chuaGanCT ? 'orange' : 'blue',
        title: { tag: 'plain_text', content: '📦 Sản phẩm nhập mới · ' + tenCongTy },
        subtitle: { tag: 'plain_text',
          content: tk.tongSP + ' sản phẩm · ' + tk.tongNCC + ' nhà cung cấp · ' + ddmm_(tuVN) + ' → ' + ddmm_(denVN) }
      },
      elements: el
    }
  };
}
// Gom SP mới trong kỳ, TÁCH THEO CÔNG TY -> mỗi công ty một thẻ Lark riêng
async function baoCaoNhapSP(actor, opts) {
  opts = opts || {};
  const vn = nowVN_();
  // opts.tuVN cho phép chạy tay 1 kỳ tuỳ ý (qua API thì tới dưới dạng chuỗi ISO)
  const tuVN = opts.tuVN ? new Date(opts.tuVN) : moBaoCaoTruoc_(vn);
  if (isNaN(tuVN)) return { sent: false, count: 0, message: 'Mốc thời gian không hợp lệ' };
  const tuIso = vnToUtcIso_(tuVN);
  let rows = [];
  try {
    rows = await supa.select('db_san_pham', { select: 'id,ma_sp,ten_sp,nha_cung_cap,nguoi_tao,ngay_tao,cong_ty_id,nganh,hang_muc',
      filter: 'ngay_tao=gte.' + encodeURIComponent(tuIso), order: 'ngay_tao.desc', limit: 5000, noScope: true });
  } catch (e) { return { sent: false, count: 0, message: 'Không đọc được danh sách sản phẩm: ' + e.message }; }
  if (!rows.length) return { sent: false, count: 0, message: 'Kỳ này chưa có sản phẩm mới' };

  // Chỉ tính SP CÓ ghi nhận người nhập — đó mới là thứ báo cáo này nói tới.
  const khuyetAll = rows.filter(function (r) { return !s_(r.nguoi_tao); });
  rows = rows.filter(function (r) { return s_(r.nguoi_tao); });
  if (!rows.length) return { sent: false, count: 0, khuyet: khuyetAll.length,
    message: 'Kỳ này chưa có sản phẩm mới có ghi nhận người nhập' };

  let users = [];
  try { users = await supa.select('users', { select: '*', limit: 5000, noScope: true }); } catch (e) { users = []; }
  const uInfo = {};
  users.forEach(function (u) {
    uInfo[s_(u.username).toLowerCase()] = { ten: u.ho_ten || u.username, pb: u.phong_ban || '' };
  });
  let cty = [];
  try { cty = await supa.select('cong_ty', { select: 'id,ten,ma', limit: 500, noScope: true }); } catch (e) { cty = []; }
  const tenCty = {}; cty.forEach(function (c) { tenCty[String(c.id)] = c.ten || c.ma; });
  const ngayVN_ = function (iso) { return ddmm_(new Date(new Date(iso).getTime() + VN_OFFSET_MS)); };

  // ── tách theo công ty ──
  const theoCT = {};
  rows.forEach(function (r) {
    const k = String(r.cong_ty_id || '');
    (theoCT[k] = theoCT[k] || []).push(r);
  });
  const ketQua = [];
  for (const ctKey of Object.keys(theoCT)) {
    const ds = theoCT[ctKey];
    const ten = ctKey ? (tenCty[ctKey] || 'Công ty khác') : 'Chưa gắn công ty';
    const bag = {}, nccAll = {}, bagNg = {};
    ds.forEach(function (r) {
      const key = s_(r.nguoi_tao), ncc = s_(r.nha_cung_cap), ngay = ngayVN_(r.ngay_tao);
      if (ncc) nccAll[ncc] = 1;
      bag[key] = bag[key] || { ngay: {}, ncc: {} };
      bag[key].ngay[ngay] = bag[key].ngay[ngay] || { soSP: 0, ncc: {} };
      bag[key].ngay[ngay].soSP++;
      if (ncc) { bag[key].ngay[ngay].ncc[ncc] = 1; bag[key].ncc[ncc] = 1; }
      // ── theo NGÀNH HÀNG (anh Hưng xin thêm): đèn / vệ sinh / sơn nước ──
      const ngTen = tenNganh_(r);
      bagNg[ngTen] = bagNg[ngTen] || { soSP: 0, ncc: {} };
      bagNg[ngTen].soSP++;
      if (ncc) bagNg[ngTen].ncc[ncc] = 1;
    });
    const theoNganh = Object.keys(bagNg).map(function (k) {
      return { ten: k, soSP: bagNg[k].soSP, soNCC: Object.keys(bagNg[k].ncc).length };
    }).sort(function (a, b) { return b.soSP - a.soSP; });
    const bang = Object.keys(bag).map(function (k) {
      const b = bag[k], info = uInfo[k.toLowerCase()] || {};
      const ngay = Object.keys(b.ngay).map(function (d) {
        return { ngay: d, soSP: b.ngay[d].soSP, soNCC: Object.keys(b.ngay[d].ncc).length };
      }).sort(function (x, y) { return x.ngay < y.ngay ? 1 : -1; });
      return { ten: info.ten || k, phongBan: info.pb || '',
        tongSP: ngay.reduce(function (s, x) { return s + x.soSP; }, 0),
        tongNCC: Object.keys(b.ncc).length, ngay: ngay };
    }).sort(function (a, b) { return b.tongSP - a.tongSP; });
    const tk = {
      tongSP: ds.length, tongNCC: Object.keys(nccAll).length, tongNguoi: bang.length,
      chuaGanCT: !ctKey
    };
    // SP cũ không rõ người nhập: chỉ cảnh báo trên thẻ của đúng công ty đó
    const khuyet = khuyetAll.filter(function (r) { return String(r.cong_ty_id || '') === ctKey; }).length;
    ketQua.push({ congTy: ten, ctKey: ctKey, bang: bang, tk: tk, khuyet: khuyet, nganh: theoNganh });
  }
  ketQua.sort(function (a, b) { return b.tk.tongSP - a.tk.tongSP; });

  if (opts.dryRun) return { sent: false, count: rows.length, soThe: ketQua.length, khuyet: khuyetAll.length, tu: tuIso, the: ketQua };

  const daGui = [];
  for (const q of ketQua) {
    let ok = false;
    try {
      const r = await fetch(REPORT_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSpReportCard(q.congTy, q.bang, q.tk, tuVN, vn, q.khuyet, q.nganh))
      });
      let d = null; try { d = await r.json(); } catch (e) { d = null; }
      ok = !!(d && (d.code === 0 || d.StatusCode === 0 || d.msg === 'success'));
      if (!ok) console.warn('[báo cáo nhập SP] webhook Lark lỗi (' + q.congTy + '):', (d && (d.msg || d.StatusMessage)) || ('HTTP ' + r.status));
    } catch (e) { console.warn('[báo cáo nhập SP] webhook Lark lỗi (' + q.congTy + '):', e && e.message); }
    daGui.push({ congTy: q.congTy, soSP: q.tk.tongSP, sent: ok });
  }
  const anyOk = daGui.some(function (x) { return x.sent; });
  if (anyOk) {
    try {
      await supa.insert('audit_log', [{ username: 'hệ thống', action: BAO_CAO_ACTION,
        detail: 'Báo cáo Lark: ' + rows.length + ' sản phẩm nhập mới / ' + ketQua.length + ' công ty, kỳ ' + ddmm_(tuVN) + ' → ' + ddmm_(vn) }], { noScope: true });
    } catch (e) { console.warn('[báo cáo nhập SP] không ghi được audit:', e && e.message); }
  }
  return { sent: anyOk, count: rows.length, khuyet: khuyetAll.length, the: daGui };
}
// Hôm nay đã gửi báo cáo chưa (chống gửi trùng khi server khởi động lại)
async function daGuiBaoCaoHomNay_() {
  const homNay = nowVN_().toISOString().slice(0, 10);
  try {
    const rows = await supa.select('audit_log', { select: 'id,created_at',
      filter: supa.eq('action', BAO_CAO_ACTION), order: 'id.desc', limit: 5, noScope: true });
    return rows.some(function (r) {
      const vn = new Date(new Date(r.created_at).getTime() + VN_OFFSET_MS);
      return vn.toISOString().slice(0, 10) === homNay;
    });
  } catch (e) { return false; }
}

module.exports = { baoCaoNhapSP, daGuiBaoCaoHomNay_, nowVN_, BAO_CAO_GIO_VN, BAO_CAO_THU };
