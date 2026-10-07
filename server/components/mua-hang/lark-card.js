'use strict';
// Thẻ Lark (interactive card) cho yêu cầu mua hàng và đề xuất — gửi qua bot incoming webhook

function fmtVN(n) { return (Math.round(Number(n) || 0)).toLocaleString('vi-VN'); }
function buildPurchaseCard(o) {
  o = o || {};
  const orders = Array.isArray(o.orders) ? o.orders : [];
  // ---- helpers dựng bảng bằng column_set (nhìn như bảng thật) ----
  const md = function (content, align) { const e = { tag: 'markdown', content: content }; if (align) e.text_align = align; return e; };
  const colv = function (content, weight, align) { return { tag: 'column', width: 'weighted', weight: weight, vertical_align: 'center', elements: [md(content, align)] }; };
  const rowset = function (cols, bg) { const cs = { tag: 'column_set', flex_mode: 'none', horizontal_spacing: 'small', columns: cols }; if (bg) cs.background_style = bg; return cs; };
  const info = function (label, val) { return { is_short: true, text: { tag: 'lark_md', content: '<font color=\'grey\'>' + label + '</font>\n**' + (val || '—') + '**' } }; };
  const els = [];

  // ==== Khối thông tin dự án / người gửi ====
  const infoFields = [info('🏗 Dự án', o.project), info('🔖 Mã dự án', o.maDA)];
  if (o.khachHang || o.sdt) infoFields.push(info('👤 Khách hàng', o.khachHang), info('📞 Điện thoại', o.sdt));
  infoFields.push(info('🙋 Người gửi', o.nguoiGui), info('🏢 Phòng ban', o.phongBan));
  els.push({ tag: 'div', fields: infoFields });
  if (o.ghiChu) els.push({ tag: 'div', text: { tag: 'lark_md', content: '<font color=\'grey\'>📝 Ghi chú</font>\n' + o.ghiChu } });

  let grand = 0, nSup = 0, nItems = 0;
  orders.forEach(function (od) {
    grand += Number(od.total) || 0; nSup++;
    const items = od.items || [];
    els.push({ tag: 'hr' });
    // Tiêu đề NCC
    els.push(md('🏭 <font color=\'blue\'>**' + (od.supplier || '—') + '**</font>　·　' + items.length + ' sản phẩm'));
    let sumGoc = 0;
    items.forEach(function (it, i) {
      nItems++;
      const sl = Number(it.sl) || 0;
      const disc = Number(it.giamGiaPct) || 0;
      const goc = Number(it.donGiaGoc) || Number(it.donGia) || 0;
      const tt = sl * (Number(it.donGia) || 0);
      sumGoc += sl * goc;
      const sub = [it.khuVuc, it.thuongHieu].filter(Boolean).join(' · ');
      let left = '**' + (i + 1) + '. ' + (it.ten || '') + '**';
      left += '\n<font color=\'grey\'>' + sl + ' ' + (it.dvt || '') + ' × ' + fmtVN(it.donGia) + ' đ' + (sub ? '　·　' + sub : '') + '</font>';
      if (disc > 0) left += '\n<font color=\'green\'>▼ giảm ' + disc + '% (gốc ' + fmtVN(goc) + ' đ)</font>';
      els.push(rowset([
        colv(left, 3),
        colv('**' + fmtVN(tt) + ' đ**', 1, 'right')
      ]));
    });
    // Khối tổng của NCC — căn phải
    const tamTinh = Number(od.total) - Number(od.vat);
    const tienGiam = Math.max(0, sumGoc - tamTinh);
    els.push({ tag: 'hr' });
    let tot = '<font color=\'grey\'>Tạm tính</font>　　' + fmtVN(sumGoc) + ' đ';
    if (tienGiam > 0) tot += '\n<font color=\'green\'>Giảm giá NCC</font>　　<font color=\'green\'>−' + fmtVN(tienGiam) + ' đ</font>';
    if (Number(od.vat) > 0) tot += '\n<font color=\'grey\'>VAT ' + (od.vatPct || 0) + '%</font>　　' + fmtVN(od.vat) + ' đ';
    tot += '\n**💰 TỔNG THANH TOÁN**　　<font color=\'red\'>**' + fmtVN(od.total) + ' đ**</font>';
    els.push(md(tot, 'right'));
  });

  // ==== Tổng tất cả (nếu nhiều NCC) ====
  els.push({ tag: 'hr' });
  if (orders.length > 1) {
    els.push(md('💵 <font color=\'red\'>**TỔNG CỘNG: ' + fmtVN(grand) + ' đ**</font>', 'right'));
  }
  els.push(md('📦 ' + nSup + ' nhà cung cấp　·　' + nItems + ' sản phẩm　·　⏳ <font color=\'orange\'>**Chờ duyệt**</font>'));
  const now = new Date();
  const stamp = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear();
  els.push({ tag: 'note', elements: [{ tag: 'plain_text', content: '⚡ Gửi tự động từ Dezon QS Pro · ' + stamp }] });

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: 'blue',
        title: { tag: 'plain_text', content: '🛒 YÊU CẦU MUA HÀNG' },
        subtitle: { tag: 'plain_text', content: (o.project || '') + (o.nguoiGui ? ' — ' + o.nguoiGui : '') }
      },
      elements: els
    }
  };
}
/* ===== Thẻ Lark cho ĐỀ XUẤT (chiết khấu / thanh toán) ===== */
function buildDeXuatCard(o, ma) {
  o = o || {};
  const md = function (content, align) { const e = { tag: 'markdown', content: content }; if (align) e.text_align = align; return e; };
  const colv = function (content, weight, align) { return { tag: 'column', width: 'weighted', weight: weight, vertical_align: 'center', elements: [md(content, align)] }; };
  const rowset = function (cols) { return { tag: 'column_set', flex_mode: 'none', horizontal_spacing: 'small', columns: cols }; };
  const els = [];
  const isCK = o.loai !== 'tt';
  els.push(md('🏢 **' + (o.supplier || '—') + '**'
    + '\n<font color=\'grey\'>Dự án: ' + (o.project || '—') + '　·　' + (o.hangMuc || '') + '</font>'
    + '\n<font color=\'grey\'>Phiếu: ' + ma + '　·　Người gửi: ' + (o.nguoiGui || '—')
    + (o.phongBan ? '　·　' + o.phongBan : '') + '</font>'));
  els.push({ tag: 'hr' });
  if (isCK) {
    const items = Array.isArray(o.items) ? o.items : [];
    let goc = 0, sau = 0;
    items.forEach(function (it, i) {
      const sl = Number(it.sl) || 0, dg = Number(it.donGia) || 0, dgGoc = Number(it.donGiaGoc) || 0;
      goc += sl * dgGoc; sau += sl * dg;
      let left = '**' + (i + 1) + '. ' + (it.ten || '') + '**';
      left += '\n<font color=\'grey\'>' + sl + ' ' + (it.dvt || '') + ' × ' + fmtVN(dgGoc) + ' đ</font>';
      if (Number(it.giamGiaPct) > 0) left += '\n<font color=\'orange\'>đề xuất giảm ' + it.giamGiaPct + '% → ' + fmtVN(dg) + ' đ</font>';
      els.push(rowset([colv(left, 3), colv('**' + fmtVN(sl * dg) + ' đ**', 1, 'right')]));
    });
    els.push({ tag: 'hr' });
    els.push(md('<font color=\'grey\'>Giá hiện tại</font>　　' + fmtVN(goc) + ' đ'
      + '\n<font color=\'orange\'>Nếu chấp nhận đề xuất</font>　　**' + fmtVN(sau) + ' đ**'
      + '\n**💰 TIẾT KIỆM**　　<font color=\'green\'>**' + fmtVN(Math.max(0, goc - sau)) + ' đ**</font>', 'right'));
  } else {
    const dots = Array.isArray(o.dots) ? o.dots : [];
    let sum = 0;
    dots.forEach(function (d, i) {
      sum += Number(d.tien) || 0;
      let left = '**Đợt ' + (d.dot || i + 1) + '**　<font color=\'grey\'>' + (Number(d.pct) || 0) + '%'
        + (d.ngay ? '　·　' + d.ngay : '') + '</font>';
      if (d.gc) left += '\n<font color=\'grey\'>' + d.gc + '</font>';
      els.push(rowset([colv(left, 3), colv('**' + fmtVN(d.tien) + ' đ**', 1, 'right')]));
    });
    els.push({ tag: 'hr' });
    els.push(md('<font color=\'grey\'>Giá trị đơn hàng</font>　　' + fmtVN(o.tongDon || sum) + ' đ'
      + '\n**💳 TỔNG ĐỀ XUẤT**　　<font color=\'red\'>**' + fmtVN(sum) + ' đ**</font>', 'right'));
  }
  if (o.ghiChu) els.push(md('<font color=\'grey\'>Ghi chú: ' + o.ghiChu + '</font>'));
  els.push(md('⏳ <font color=\'orange\'>**Chờ duyệt**</font>'));
  const now = new Date();
  const stamp = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear();
  els.push({ tag: 'note', elements: [{ tag: 'plain_text', content: '⚡ Gửi tự động từ Dezon QS Pro · ' + stamp }] });
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: isCK ? 'orange' : 'turquoise',
        title: { tag: 'plain_text', content: isCK ? '💬 ĐỀ XUẤT CHIẾT KHẤU' : '💳 ĐỀ XUẤT THANH TOÁN' },
        subtitle: { tag: 'plain_text', content: (o.project || '') + (o.nguoiGui ? ' — ' + o.nguoiGui : '') }
      },
      elements: els
    }
  };
}

module.exports = { fmtVN, buildPurchaseCard, buildDeXuatCard };
