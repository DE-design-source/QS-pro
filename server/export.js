'use strict';
/************************************************************
 * QS PRO – Xuất báo giá Excel (ExcelJS)
 * Port từ buildCoverSheet_ / buildSection32Sheet_ / buildDetailSheet_ (Code.gs)
 * Cấu trúc: Tờ bìa | 3.2 Phần hoàn thiện | mỗi Nhóm 1 sheet.
 * (PDF được xử lý phía client bằng chức năng In của trình duyệt.)
 ************************************************************/
const ExcelJS = require('exceljs');
const store = require('./store');            // helper thuần (coverComputed_, _toNumber, _S32_SUPPLIERS...)
const supa = require('./supa');
const dataStore = supa.ok() ? require('./store_supa') : store;   // nguồn dữ liệu (Supabase nếu có)
const lark = require('./lark');

const NAVY = 'FF1F3864';
const NAVY2 = 'FF12314F';
const GHEAD = 'FFDBE9F6';
const STRIPE = 'FFF7F9FC';
const GOLD = 'FFF4E9D8';
const LINE = 'FFD5DBE4';
const WHITE = 'FFFFFFFF';

const EXPORT_STY = {
  stt: { label: 'STT', w: 34, al: 'center' },
  khuVuc: { label: 'PHÒNG', w: 120, al: 'center' },
  maBanVe: { label: 'MÃ SỐ BẢN VẼ', w: 66, al: 'center' },
  nhom: { label: 'NHÓM', w: 110, al: 'center' },
  loai: { label: 'HẠNG MỤC', w: 92, al: 'center' },
  maSP: { label: 'MÃ SẢN PHẨM', w: 104, al: 'center' },
  ten: { label: 'TÊN SẢN PHẨM', w: 175, al: 'left', wrap: true, bold: true },
  thuongHieu: { label: 'THƯƠNG HIỆU', w: 88, al: 'center' },
  ncc: { label: 'NHÀ CUNG CẤP', w: 110, al: 'center' },
  moTa: { label: 'MÔ TẢ', w: 175, al: 'left', wrap: true },
  kichThuoc: { label: 'KÍCH THƯỚC', w: 110, al: 'left', wrap: true },
  hinhAnh: { label: 'HÌNH ẢNH', w: 78, al: 'center', img: true },
  dvt: { label: 'ĐVT', w: 42, al: 'center' },
  soLuong: { label: 'SỐ LƯỢNG', w: 52, al: 'center', num: true },
  donGiaBan: { label: 'ĐƠN GIÁ', w: 96, al: 'right', num: true },
  thanhTienBan: { label: 'THÀNH TIỀN', w: 110, al: 'right', num: true, bold: true }
};

function px(w) { return Math.max(6, Math.round((w || 90) / 7)); }
function roman_(n) {
  const m = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV',
    'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  return m[n] || String(n);
}
function fill(ws, range, argb) { ws.getCell(range); }
function setFill(cell, argb) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; }
function border(cell) {
  cell.border = { top: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } },
    bottom: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };
}

/*** ===== Tờ bìa ===== ***/
function buildCoverSheet(ws, p, cover) {
  const comp = store.coverComputed_(cover);
  const cost = comp.cost, total = comp.total;
  ws.columns = [{ width: px(52) }, { width: px(380) }, { width: px(190) }, { width: px(120) }];
  let r = 1;
  function bigHeader(text, sub) {
    ws.mergeCells(r, 1, r, 4);
    const c = ws.getCell(r, 1); c.value = text;
    c.font = { name: 'Arial', bold: true, size: 16, color: { argb: WHITE } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    setFill(c, NAVY2); ws.getRow(r).height = 30; r++;
  }
  bigHeader('BẢNG ƯỚC TÍNH CHI PHÍ DỰ ÁN');
  [['[Tư vấn thiết kế, thi công chuyên nghiệp]'], ['Mã báo giá số : ' + (p.maBaoGia || '')]].forEach(function (t) {
    ws.mergeCells(r, 1, r, 4); const c = ws.getCell(r, 1); c.value = t[0];
    c.font = { name: 'Arial', color: { argb: 'FFC7D3E6' } }; c.alignment = { horizontal: 'center' };
    setFill(c, NAVY2); r++;
  });
  r++;
  function info(l1, v1, l2, v2) {
    ws.mergeCells(r, 1, r, 2); ws.mergeCells(r, 3, r, 4);
    ws.getCell(r, 1).value = { richText: [{ text: l1 + ':  ', font: { bold: true } }, { text: String(v1 || '') }] };
    ws.getCell(r, 3).value = { richText: [{ text: l2 + ':  ', font: { bold: true } }, { text: String(v2 || '') }] };
    ws.getCell(r, 1).alignment = { wrapText: true }; ws.getCell(r, 3).alignment = { wrapText: true };
    r++;
  }
  info('Khách hàng', p.khachHang, 'Quy mô', p.quyMo);
  info('Tổng diện tích XD (m²)', p.tongDT, 'Nhu cầu', p.nhuCau);
  info('DT báo giá [đã nhân hệ số] (m²)', p.dtBaoGia, 'Phân khúc', p.phanKhuc);
  r++;

  const headerRow = r;
  ['NO', 'HẠNG MỤC', 'CHI PHÍ DỰ KIẾN', 'TỶ TRỌNG'].forEach(function (h, i) {
    const c = ws.getCell(r, i + 1); c.value = h;
    c.font = { name: 'Arial', bold: true, color: { argb: WHITE } };
    c.alignment = { horizontal: 'center', vertical: 'middle' }; setFill(c, NAVY2);
  });
  ws.getRow(r).height = 24; r++;

  function ckey(s) { return String(s).split('.').map(function (x) { return parseInt(x, 10) || 0; }); }
  const sorted = cover.slice().sort(function (a, b) {
    var ka = ckey(a.stt), kb = ckey(b.stt), n = Math.max(ka.length, kb.length);
    for (var i = 0; i < n; i++) { var d = (ka[i] || 0) - (kb[i] || 0); if (d) return d; } return 0;
  });
  sorted.forEach(function (c) {
    const lvl = String(c.stt).split('.').length;
    const val = cost[c.stt] || 0;
    const indent = lvl > 1 ? new Array(lvl).join('    ') : '';
    const name = indent + (c.hangMuc || '');
    ws.getCell(r, 1).value = c.stt;
    ws.getCell(r, 1).alignment = { horizontal: 'center' };
    ws.getCell(r, 1).font = { name: 'Arial', bold: lvl === 1 };
    const nameCell = ws.getCell(r, 2);
    nameCell.value = { richText: [{ text: name, font: { bold: lvl <= 2, italic: lvl >= 3 } }]
      .concat(c.moTa ? [{ text: '\n' + c.moTa, font: { italic: true, color: { argb: 'FF666666' } } }] : []) };
    nameCell.alignment = { wrapText: true, vertical: 'middle' };
    const costCell = ws.getCell(r, 3);
    costCell.value = val; costCell.numFmt = '#,##0';
    costCell.alignment = { horizontal: 'right' }; costCell.font = { name: 'Arial', bold: lvl <= 2 };
    const pctCell = ws.getCell(r, 4);
    pctCell.value = total > 0 ? (val / total) : 0; pctCell.numFmt = '0.0%';
    pctCell.alignment = { horizontal: 'right' }; pctCell.font = { name: 'Arial', bold: lvl <= 2 };
    if (lvl === 1) for (var k = 1; k <= 4; k++) setFill(ws.getCell(r, k), 'FFC9CCD1');
    else if (lvl === 2) for (var k2 = 1; k2 <= 4; k2++) setFill(ws.getCell(r, k2), 'FFEEF0F2');
    r++;
  });
  ws.mergeCells(r, 1, r, 2);
  const tCell = ws.getCell(r, 1); tCell.value = 'TỔNG CHI PHÍ DỰ KIẾN (VNĐ)';
  tCell.font = { name: 'Arial', bold: true, color: { argb: WHITE } }; setFill(tCell, NAVY2);
  const tVal = ws.getCell(r, 3); tVal.value = total; tVal.numFmt = '#,##0';
  tVal.font = { name: 'Arial', bold: true, size: 12, color: { argb: WHITE } };
  tVal.alignment = { horizontal: 'right' }; setFill(tVal, NAVY2); setFill(ws.getCell(r, 4), NAVY2);

  for (var rr = headerRow; rr <= r; rr++) for (var cc = 1; cc <= 4; cc++) border(ws.getCell(rr, cc));
  ws.views = [{ state: 'frozen', ySplit: headerRow }];
}

/*** ===== 3.2 Phần hoàn thiện ===== ***/
function buildSection32(ws, p, cover) {
  const COL = [
    { label: 'NO', w: 44, al: 'center' }, { label: 'HẠNG MỤC', w: 170, al: 'left', bold: true },
    { label: 'MÔ TẢ CHI TIẾT', w: 250, al: 'left', wrap: true }, { label: 'DVT', w: 44, al: 'center' },
    { label: 'KHỐI LƯỢNG', w: 70, al: 'center', num: true }, { label: 'ĐƠN GIÁ', w: 95, al: 'right', num: true },
    { label: 'CHI PHÍ DỰ KIẾN', w: 130, al: 'right', num: true, bold: true }, { label: 'TỶ TRỌNG', w: 70, al: 'right', pct: true },
    { label: 'NHÀ CUNG CẤP', w: 160, al: 'left' }
  ];
  const ncol = COL.length;
  ws.columns = COL.map(function (c) { return { width: px(c.w) }; });
  const byStt = {}, covBy = {};
  cover.forEach(function (c) { byStt[c.stt] = Number(c.chiPhi) || 0; covBy[c.stt] = c; });
  const subs = ['3.2.1', '3.2.2', '3.2.3', '3.2.4', '3.2.5', '3.2.6', '3.2.7'];
  var total32 = 0; subs.forEach(function (s) { total32 += byStt[s] || 0; });
  const kl = store._toNumber(p.dtBaoGia) || store._toNumber(p.tongDT) || 0;

  let r = 1;
  ws.mergeCells(r, 1, r, ncol);
  var c1 = ws.getCell(r, 1); c1.value = '3.2. PHẦN HOÀN THIỆN CƠ BẢN';
  c1.font = { name: 'Arial', bold: true, size: 15, color: { argb: WHITE } };
  c1.alignment = { horizontal: 'center', vertical: 'middle' }; setFill(c1, NAVY); ws.getRow(r).height = 26; r++;
  ws.mergeCells(r, 1, r, ncol);
  ws.getCell(r, 1).value = 'Dự án: ' + (p.ten || '') + '      Khách hàng: ' + (p.khachHang || ''); r++;
  r++;
  const headerRow = r;
  COL.forEach(function (c, i) {
    const cell = ws.getCell(r, i + 1); cell.value = c.label;
    cell.font = { name: 'Arial', bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; setFill(cell, NAVY);
  });
  ws.getRow(r).height = 28; r++;

  const data = [];
  data.push(['3.2', 'PHẦN HOÀN THIỆN CƠ BẢN', '', 'm2', kl, (kl > 0 ? total32 / kl : 0), total32, 1, '']);
  subs.forEach(function (s) {
    const cov = covBy[s] || {}, chiPhi = byStt[s] || 0, sup = store._S32_SUPPLIERS[s] || [];
    const first = sup.length ? sup[0] : null;
    data.push([s, cov.hangMuc || s, cov.moTa || '', 'gói', 1, '', chiPhi, total32 > 0 ? chiPhi / total32 : 0,
      first ? (first[0] + ' — ' + first[1]) : '']);
    for (var k = 1; k < sup.length; k++) data.push(['', '', '', '', '', '', '', '', sup[k][0] + ' — ' + sup[k][1]]);
  });
  const firstData = r;
  data.forEach(function (row) {
    COL.forEach(function (c, ci) {
      const cell = ws.getCell(r, ci + 1); cell.value = row[ci];
      cell.alignment = { horizontal: c.al || 'left', wrapText: !!c.wrap, vertical: 'middle' };
      if (c.num) cell.numFmt = '#,##0';
      if (c.pct) cell.numFmt = '0.0%';
      if (c.bold) cell.font = { name: 'Arial', bold: true };
    });
    r++;
  });
  for (var cc = 1; cc <= ncol; cc++) { setFill(ws.getCell(firstData, cc), 'FFC9CCD1'); ws.getCell(firstData, cc).font = { name: 'Arial', bold: true }; }
  for (var rr = headerRow; rr < r; rr++) for (var c2 = 1; c2 <= ncol; c2++) border(ws.getCell(rr, c2));
  ws.views = [{ state: 'frozen', ySplit: headerRow }];
}

/*** ===== Sheet chi tiết theo Nhóm ===== ***/
async function buildDetailSheet(wb, ws, items, p, EXCOLS, catName) {
  const ncol = EXCOLS.length;
  function colIdx(key) { for (var i = 0; i < EXCOLS.length; i++) if (EXCOLS[i].k === key) return i + 1; return 0; }
  const ttCol = colIdx('thanhTienBan') || ncol;
  const imgCol = colIdx('hinhAnh');
  const nameCol = colIdx('khuVuc') || (ncol >= 2 ? 2 : 1);

  ws.columns = EXCOLS.map(function (c) { return { width: px(c.w) }; });
  const groups = [], gmap = {}; var catTotal = 0;
  items.forEach(function (l) {
    var k = (l.tang || '').trim() || 'CHƯA PHÂN TẦNG';
    if (!gmap[k]) { gmap[k] = { name: k, items: [], sub: 0 }; groups.push(gmap[k]); }
    gmap[k].items.push(l); gmap[k].sub += l.thanhTienBan; catTotal += l.thanhTienBan;
  });

  let r = 1;
  ws.mergeCells(r, 1, r, ncol);
  var h1 = ws.getCell(r, 1); h1.value = 'CÔNG TY THIẾT KẾ & THI CÔNG DEZON';
  h1.font = { name: 'Arial', bold: true, size: 13, color: { argb: WHITE } };
  h1.alignment = { horizontal: 'center', vertical: 'middle' }; setFill(h1, NAVY); ws.getRow(r).height = 24; r++;
  ws.mergeCells(r, 1, r, ncol);
  var h2 = ws.getCell(r, 1); h2.value = 'BÁO GIÁ CHI TIẾT — ' + String(catName || '').toUpperCase();
  h2.font = { name: 'Arial', bold: true, size: 15, color: { argb: NAVY } };
  h2.alignment = { horizontal: 'center' }; ws.getRow(r).height = 24; r++;
  ws.mergeCells(r, 1, r, ncol);
  ws.getCell(r, 1).value = 'Dự án: ' + (p.ten || '') + '      Khách hàng: ' + (p.khachHang || '');
  ws.getCell(r, 1).font = { color: { argb: 'FF666666' } }; r++;
  r++;

  const headerRow = r;
  EXCOLS.forEach(function (c, i) {
    const cell = ws.getCell(r, i + 1); cell.value = c.label;
    cell.font = { name: 'Arial', bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; setFill(cell, NAVY);
  });
  ws.getRow(r).height = 34; r++;

  const imgList = [];
  groups.forEach(function (g, gi) {
    // dòng nhóm (theo Tầng)
    for (var x = 1; x <= ncol; x++) { setFill(ws.getCell(r, x), GHEAD); }
    ws.getCell(r, 1).value = roman_(gi + 1); ws.getCell(r, 1).alignment = { horizontal: 'center' };
    ws.getCell(r, nameCol).value = g.name;
    ws.getCell(r, ttCol).value = g.sub; ws.getCell(r, ttCol).numFmt = '#,##0'; ws.getCell(r, ttCol).alignment = { horizontal: 'right' };
    for (var xx = 1; xx <= ncol; xx++) ws.getCell(r, xx).font = { name: 'Arial', bold: true, color: { argb: NAVY } };
    ws.getRow(r).height = 22; r++;
    g.items.forEach(function (l, idx) {
      EXCOLS.forEach(function (c, ci) {
        const cell = ws.getCell(r, ci + 1);
        if (c.k === 'stt') cell.value = idx + 1;
        else if (c.k === 'hinhAnh') cell.value = '';
        else if (c.k === 'soLuong') cell.value = l.soLuong;
        else if (c.k === 'donGiaBan') cell.value = l.donGiaBan;
        else if (c.k === 'thanhTienBan') cell.value = l.thanhTienBan;
        else cell.value = l[c.k] || '';
        cell.alignment = { horizontal: c.al || 'left', wrapText: !!c.wrap, vertical: 'middle' };
        if (c.num) cell.numFmt = '#,##0';
        if (c.bold) cell.font = { name: 'Arial', bold: true };
      });
      if (idx % 2 === 1) for (var s = 1; s <= ncol; s++) if (!ws.getCell(r, s).fill) setFill(ws.getCell(r, s), STRIPE);
      if (imgCol && String(l.hinhAnh || '')) imgList.push({ row: r, url: String(l.hinhAnh) });
      ws.getRow(r).height = 40; r++;
    });
  });
  // tổng nhóm
  for (var t = 1; t <= ncol; t++) setFill(ws.getCell(r, t), GOLD);
  ws.getCell(r, ttCol - 1 > 0 ? ttCol - 1 : 1).value = 'TỔNG ' + (catName || '');
  ws.getCell(r, ttCol - 1 > 0 ? ttCol - 1 : 1).font = { name: 'Arial', bold: true };
  ws.getCell(r, ttCol - 1 > 0 ? ttCol - 1 : 1).alignment = { horizontal: 'right' };
  ws.getCell(r, ttCol).value = catTotal; ws.getCell(r, ttCol).numFmt = '#,##0';
  ws.getCell(r, ttCol).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF8F6F42' } };
  const lastRow = r;

  for (var rr = headerRow; rr <= lastRow; rr++) for (var cc = 1; cc <= ncol; cc++) border(ws.getCell(rr, cc));
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  // nhúng ảnh (best-effort)
  if (imgCol) {
    for (var i = 0; i < imgList.length; i++) {
      try {
        const buf = await fetchImage(imgList[i].url);
        if (!buf) continue;
        const imgId = wb.addImage({ buffer: buf.buffer, extension: buf.ext });
        ws.addImage(imgId, { tl: { col: imgCol - 1 + 0.1, row: imgList[i].row - 1 + 0.1 },
          ext: { width: 60, height: 48 } });
        ws.getRow(imgList[i].row).height = 52;
      } catch (e) { /* bỏ qua ảnh lỗi */ }
    }
  }
}

// Lấy buffer ảnh: hỗ trợ /media?token=... (qua Lark) và URL http trực tiếp
async function fetchImage(url) {
  try {
    let contentType = '', buffer = null;
    const m = /[?&]token=([^&]+)/.exec(url);
    if (url.indexOf('/media') === 0 && m) {
      const dl = await lark.mediaDownload(decodeURIComponent(m[1]));
      buffer = dl.buffer; contentType = dl.contentType;
    } else if (url.indexOf('http') === 0) {
      const res = await fetch(url);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
      contentType = res.headers.get('content-type') || '';
    } else return null;
    const ext = contentType.indexOf('png') > -1 ? 'png' : (contentType.indexOf('webp') > -1 ? 'png' : 'jpeg');
    return { buffer: buffer, ext: ext };
  } catch (e) { return null; }
}

function sheetName_(s) {
  var n = String(s || 'Sheet').replace(/[:\\/?*\[\]]/g, ' ').trim().slice(0, 30);
  return n || 'Sheet';
}

/*** ===== ENTRY: exportBaoGia(maDA, cols, format) ===== ***/
async function exportBaoGia(maDA, cols, format) {
  const q = await dataStore.getQuote(maDA);
  const p = q.project || {};
  const chosen = (cols && cols.length) ? cols : Object.keys(EXPORT_STY).map(function (k) { return { key: k }; });
  const EXCOLS = chosen.map(function (c) {
    const s = EXPORT_STY[c.key] || { label: c.label || c.key, w: 90, al: 'left' };
    return { k: c.key, label: s.label, w: s.w, al: s.al, wrap: s.wrap, bold: s.bold, num: s.num, img: s.img };
  });

  const wb = new ExcelJS.Workbook();
  const cover = await dataStore.getCoverOrInit(maDA);
  buildCoverSheet(wb.addWorksheet('Tờ bìa'), p, cover);
  buildSection32(wb.addWorksheet('3.2 Phần hoàn thiện'), p, cover);

  const cats = []; const cmap = {};
  q.lines.forEach(function (l) {
    var k = (l.nhom || 'Khác').trim() || 'Khác';
    if (!cmap[k]) { cmap[k] = { name: k, items: [] }; cats.push(cmap[k]); }
    cmap[k].items.push(l);
  });
  if (!cats.length) {
    await buildDetailSheet(wb, wb.addWorksheet('Báo giá'), [], p, EXCOLS, 'Báo giá');
  } else {
    const used = {};
    for (var i = 0; i < cats.length; i++) {
      var nm = sheetName_(cats[i].name); var base = nm; var k = 2;
      while (used[nm]) { nm = (base + ' ' + k).slice(0, 30); k++; }
      used[nm] = 1;
      await buildDetailSheet(wb, wb.addWorksheet(nm), cats[i].items, p, EXCOLS, cats[i].name);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const safe = (p.ten || maDA || 'BaoGia').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_');
  return {
    name: 'BaoGia_' + safe + '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: Buffer.from(buffer).toString('base64')
  };
}

module.exports = exportBaoGia;
