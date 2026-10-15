'use strict';
/* Module materials (nhập hàng loạt): importParse (server/shared.js 89-191) và importCommit (server/store_supa.js 1032-1080).
   File .xlsx dựng bằng ExcelJS ngay trong kịch bản, .csv là chuỗi; đủ 4 ngành, cả file nhiều sheet kiểu cũ của ngành có spec. */
const ExcelJS = require('exceljs');
const { fx, SPEC } = require('./_fx');
const TABLES = ['products', 'product_lighting_specs', 'product_sanitary_specs', 'product_paint_specs', 'product_switch_socket_specs', 'product_histories', 'audit_logs'];

// sheets: [{ name, rows: [[ô...]] }] -> base64 của file .xlsx
async function xlsxB64(sheets) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date(Date.UTC(2026, 0, 1)); wb.modified = wb.created;
  sheets.forEach((s) => { const ws = wb.addWorksheet(s.name); (s.rows || []).forEach((r, i) => (r || []).forEach((v, j) => { if (v !== undefined && v !== null && v !== '') ws.getCell(i + 1, j + 1).value = v; })); });
  return Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
}
const csvB64 = (text) => Buffer.from(text, 'utf8').toString('base64');
const csvLine = (cells) => cells.map((c) => { const t = c == null ? '' : String(c); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',');
const toCsv = (rows) => rows.map(csvLine).join('\r\n') + '\r\n';

const DEN_H = ['TÊN SẢN PHẨM', 'MÃ SẢN PHẨM', 'DÒNG SẢN PHẨM', 'HẠNG MỤC', 'NHÓM SẢN PHẨM', 'THƯƠNG HIỆU', 'NHÀ CUNG CẤP', 'CÔNG SUẤT (W)', 'NHIỆT ĐỘ MÀU (K)', 'QUANG THÔNG (lm)', 'GÓC CHIẾU (°)', 'MÀU SẮC', 'CHIỀU CAO (mm)', 'ĐƯỜNG KÍNH (mm)', 'LẮP NGUỒN RỜI', 'BẢO HÀNH (năm)', 'ĐƠN VỊ TÍNH', 'GIÁ BÁN LẺ', 'CHIẾT KHẤU ĐẠI LÝ (%)', 'GIÁ ĐẠI LÝ', 'ẢNH SẢN PHẨM', 'TRẠNG THÁI', 'GHI CHÚ', 'CỘT LẠ'];
const denRow = (i, over) => { const o = Object.assign({ 'TÊN SẢN PHẨM': 'DI đèn nhập ' + i, 'MÃ SẢN PHẨM': 'DI-DEN-' + i, 'DÒNG SẢN PHẨM': 'Spotlight', 'HẠNG MỤC': 'Đèn rọi ray', 'NHÓM SẢN PHẨM': 'Nhóm ' + (i % 2), 'THƯƠNG HIỆU': 'Dezon', 'NHÀ CUNG CẤP': 'NCC nhập ' + (i % 2), 'CÔNG SUẤT (W)': 10 + i, 'NHIỆT ĐỘ MÀU (K)': '3000', 'QUANG THÔNG (lm)': 900.5 + i, 'GÓC CHIẾU (°)': 24, 'MÀU SẮC': 'Đen',
  'CHIỀU CAO (mm)': 120.25, 'ĐƯỜNG KÍNH (mm)': 60, 'LẮP NGUỒN RỜI': i % 2 ? 'Có' : '', 'BẢO HÀNH (năm)': 2, 'ĐƠN VỊ TÍNH': i % 3 ? 'Bộ' : '', 'GIÁ BÁN LẺ': 1234567 + i, 'CHIẾT KHẤU ĐẠI LÝ (%)': 12.125, 'GIÁ ĐẠI LÝ': 999, 'ẢNH SẢN PHẨM': 'https://img.test/file-' + i + '.jpg', 'TRẠNG THÁI': i % 4 ? '' : 'Ngừng kinh doanh', 'GHI CHÚ': 'ghi chú ' + i, 'CỘT LẠ': 'bỏ qua' }, over || {}); return DEN_H.map((k) => o[k]); };
const specHeaders = (ng, hm) => { const SP = SPEC[ng]; return SP.CHUNG.filter((x) => x !== 'NGÀNH HÀNG' && x !== 'ẢNH SẢN PHẨM').concat(hm ? SP.labelsOf(hm) : SP.ALL); };

module.exports = {
  name: 'area3/04 import (parse + commit)',
  async run(h) {
    const f = await fx(h), S = f.S;
    const specRow = (ng, hm, i, heads, over) => { const d = f.specData(ng, hm, i, Object.assign({ 'TÊN SẢN PHẨM': 'DI ' + ng + ' ' + hm + ' ' + i, 'MÃ SẢN PHẨM': 'DI-' + ng.toUpperCase() + '-' + i, 'TRẠNG THÁI': '', 'TÍNH NĂNG': 'Tính năng ' + i }, over || {})); return heads.map((k) => (d[k] === undefined ? '' : d[k])); };
    const parse = (s, args, opts) => h.both(s, 'importParse', args, opts);
    const prods = (r) => (r.node.json && r.node.json.result && r.node.json.result.products) || [];
    const commit = (s, list, opts) => h.rpc(s, 'importCommit', [list], opts);
    const commitR = (s, list, opts) => h.rest(s, 'importCommit', [list], opts);

    /* ================= đèn: xlsx ================= */
    const denX = await xlsxB64([{ name: 'San pham', rows: [['DANH MỤC SẢN PHẨM DEZON'], [], ['(ghi chú trước tiêu đề)', 'x'], DEN_H, denRow(1), denRow(2), [], denRow(3, { 'TÊN SẢN PHẨM': '' }), denRow(4, { 'MÃ SẢN PHẨM': '', 'GIÁ BÁN LẺ': '' }), denRow(5, { 'GIÁ BÁN LẺ': '12.500.000', 'CHIẾT KHẤU ĐẠI LÝ (%)': '15%', 'QUANG THÔNG (lm)': '1,5' }),
      denRow(6, { 'TÊN SẢN PHẨM': '  DI tên thừa khoảng trắng  ', 'CÔNG SUẤT (W)': 7.5, 'GIÁ BÁN LẺ': 1234.567, 'BẢO HÀNH (năm)': true, 'GHI CHÚ': 0 }), denRow(7, { 'TÊN SẢN PHẨM': { richText: [{ text: 'DI chữ ' }, { font: { bold: true }, text: 'đậm' }] }, 'GIÁ BÁN LẺ': { formula: 'A1*2', result: 2500000 }, 'ẢNH SẢN PHẨM': { text: 'ảnh', hyperlink: 'https://img.test/link.jpg' }, 'GHI CHÚ': { formula: 'B1' }, 'MÀU SẮC': { error: '#N/A' } }),
      denRow(8, { 'CHIỀU CAO (mm)': 1e21, 'ĐƯỜNG KÍNH (mm)': -0.5, 'QUANG THÔNG (lm)': 1e-7, 'GIÁ BÁN LẺ': 0.1 + 0.2 })] }, { name: 'Sheet phụ', rows: [['TÊN SẢN PHẨM'], ['DI ở sheet 2 (đèn chỉ đọc sheet đầu)']] }]);
    await f.matrix('importParse', [denX, 'xlsx']);
    let r = await parse(S.adminA, [denX, 'xlsx', 'den'], { label: 'importParse đèn xlsx (nganh = den)' });
    const denList = prods(r);
    for (const a of [[denX], [denX, null], [denX, ''], [denX, 'XLSX'], [denX, '.xlsx', null], [denX, 'xls'], [denX, 5], [denX, {}], [denX, ['csv']], [denX, 'xlsx', 'xyz'], [denX, 'xlsx', 5], [denX, 'xlsx', 'den', 'thừa'], [denX, 'csv'], [denX, 'Csv'], [denX, 'text/csv; charset=utf-8']])
      await parse(S.adminA, a, { label: 'importParse đèn xlsx, tham số ' + JSON.stringify(a.slice(1)) });
    await parse(S.adminA, ['data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + denX, 'xlsx'], { label: 'importParse base64 có tiền tố data: (không cắt)' });
    for (const a of [[], [null], [''], ['   '], [0], [true], [{}], [[]], ['không phải base64 !!!', 'xlsx'], [csvB64('không phải zip'), 'xlsx'], [Buffer.from('PK\u0003\u0004 zip cụt').toString('base64'), 'xlsx'], ['', 'csv'], [null, 'csv'], [csvB64('﻿'), 'csv'], [csvB64('a,b\n1,2\n'), 'csv'], [csvB64('Mã,Giá\nX,1\n'), 'csv']])
      await parse(S.adminA, a, { label: 'importParse tham số ' + JSON.stringify(a).slice(0, 90) });   // file không phải zip / zip cụt: Go trả đúng câu lỗi của JSZip, không có khác biệt chủ ý nào ở đây
    /* [khoảng trống: f.xlsxHong chưa từng được định nghĩa] khác biệt có chủ ý ARCH 10.3 chỉ áp cho zip HỢP LỆ mà XML bên trong hỏng, ở các phần
       Go có đọc (workbook, sharedStrings, sheet): cả 2 phía lỗi 500, câu lỗi khác nhau (Node: saxes). Luật f.xlsxHong (area3/_fx.js) chỉ che câu lỗi. */
    const JSZip = require('jszip');
    const hongXml = async (b64, entry, tu, thanh) => { const z = await JSZip.loadAsync(Buffer.from(b64, 'base64')); const t = await z.file(entry).async('string'); z.file(entry, t.replace(tu, thanh)); return (await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })).toString('base64'); };
    for (const [entry, tu, thanh] of [['xl/worksheets/sheet1.xml', '<sheetData>', '<sheetData><<hong>'], ['xl/sharedStrings.xml', '<si>', '<si><<hong>'], ['xl/workbook.xml', '<sheets>', '<sheets><<hong>']])
      await parse(S.adminA, [await hongXml(denX, entry, tu, thanh), 'xlsx'], { label: 'importParse xlsx có XML hỏng trong ' + entry, accept: f.xlsxHong });
    // tiêu đề nằm ngoài 15 dòng đầu / bí danh cột / file rỗng
    await parse(S.adminA, [await xlsxB64([{ name: 'S', rows: Array.from({ length: 15 }, (_, i) => ['dòng ' + i]).concat([['TÊN SẢN PHẨM'], ['DI quá xa']]) }]), 'xlsx'], { label: 'importParse tiêu đề ở dòng 16 (không tìm thấy)' });
    await parse(S.adminA, [await xlsxB64([{ name: 'S', rows: Array.from({ length: 14 }, (_, i) => ['dòng ' + i]).concat([['TÊN SẢN PHẨM'], ['DI dòng 15']]) }]), 'xlsx'], { label: 'importParse tiêu đề ở dòng 15' });
    await parse(S.adminA, [await xlsxB64([{ name: 'Trống', rows: [] }]), 'xlsx'], { label: 'importParse sheet rỗng' });
    await parse(S.adminA, [await xlsxB64([{ name: 'S', rows: [['Tên SP', 'Mã hàng', 'Nhóm', 'Hãng', 'NCC', 'Size', 'Đơn vị', 'Đơn giá bán', 'Mô tả', 'Link ảnh', 'MÀU SẮC', 'BẢO HÀNH', 'Tên phụ', 'Giá'], ['DI bí danh 1', 'BD-1', 'Nhóm X', 'Hãng Y', 'NCC Z', '60x60', 'm2', '1.250.000', 'mô tả', 'https://img.test/bd.jpg', 'Xám', 3, 'tên thứ 2', 5], ['DI bí danh 2', 'BD-2', '', '', '', '', '', 'liên hệ', '', '', '', '', '', '']] }]), 'xlsx'], { label: 'importParse bí danh cột (Tên SP / Mã hàng / Đơn giá bán...)' });
    const aliasList = prods(await parse(S.adminA, [await xlsxB64([{ name: 'S', rows: [['PRODUCT NAME', 'SKU', 'CATEGORY', 'BRAND', 'SUPPLIER', 'DIMENSION', 'UNIT', 'PRICE', 'DESCRIPTION', 'IMAGE URL'], ['DI tiếng Anh 1', 'EN-1', 'Cat', 'Br', 'Sup', '10x10', 'pcs', 99000, 'desc', 'https://img.test/en.jpg'], ['DI tiếng Anh 2', 'EN-2', 'Cat', 'Br', 'Sup', '', '', 0, '', '']] }]), 'xlsx'], { label: 'importParse tiêu đề tiếng Anh' }));

    /* ================= đèn: csv ================= */
    const denCsvRows = [DEN_H, denRow(11), denRow(12, { 'TÊN SẢN PHẨM': 'DI csv, có phẩy "và nháy"', 'GHI CHÚ': 'dòng 1\ndòng 2', 'GIÁ BÁN LẺ': '1.500.000' }), denRow(13, { 'GIÁ BÁN LẺ': '12,5', 'CHIẾT KHẤU ĐẠI LÝ (%)': '7,5' }), [], denRow(14, { 'TÊN SẢN PHẨM': '' }), denRow(15, { 'CÔNG SUẤT (W)': '007', 'NHIỆT ĐỘ MÀU (K)': '3000, 4000', 'BẢO HÀNH (năm)': 'true', 'ĐƯỜNG KÍNH (mm)': '1e3', 'CHIỀU CAO (mm)': '2026-10-13' })];
    const denCsv = csvB64(toCsv(denCsvRows));
    r = await parse(S.adminA, [denCsv, 'csv'], { label: 'importParse đèn csv' });
    const denCsvList = prods(r);
    await parse(S.edit, [csvB64('﻿' + toCsv(denCsvRows)), 'csv'], { label: 'importParse csv có BOM' });
    await parse(S.edit, [csvB64(toCsv(denCsvRows).replace(/,/g, ';')), 'csv'], { label: 'importParse csv dùng dấu chấm phẩy' });
    await parse(S.edit, [csvB64(toCsv(denCsvRows).replace(/\r\n/g, '\n')), '.CSV'], { label: 'importParse csv xuống dòng LF' });
    await parse(S.edit, [csvB64('TÊN SẢN PHẨM,GIÁ BÁN LẺ\n"DI nháy chưa đóng,5\n'), 'csv'], { label: 'importParse csv nháy chưa đóng' });
    await parse(S.edit, [Buffer.from('TÊN SẢN PHẨM,GIÁ\nDI latin1 \xe9,5\n', 'latin1').toString('base64'), 'csv'], { label: 'importParse csv không phải UTF-8' });
    const bigCsv = csvB64(toCsv([['TÊN SẢN PHẨM', 'MÃ SẢN PHẨM', 'GIÁ BÁN LẺ']].concat(Array.from({ length: 2105 }, (_, i) => ['DI lớn ' + i, 'DI-LON-' + i, 1000 + i]))));
    await parse(S.adminA, [bigCsv, 'csv'], { label: 'importParse csv 2105 dòng (cắt 2000)' });

    /* ================= ngành có spec: xlsx 1 sheet, nhiều sheet kiểu cũ, csv ================= */
    const lists = {};
    for (const ng of ['vs', 'son', 'ct']) {
      const SP = SPEC[ng], hms = SP.HANG_MUC, all = specHeaders(ng, null);
      // (1) 1 sheet "San pham" đủ mọi cột, mỗi hạng mục 1 dòng + dòng ví dụ + sheet Hướng dẫn
      const rows = [['MẪU NHẬP ' + ng.toUpperCase()], all, specRow(ng, hms[0], 1, all, { 'TÊN SẢN PHẨM': SP.VD + ' dòng mẫu' })];
      hms.forEach((hm, i) => rows.push(specRow(ng, hm, 100 + i, all, i === 1 ? { 'HẠNG MỤC': hm.toUpperCase() } : {})));
      rows.push(specRow(ng, hms[0], 150, all, { 'HẠNG MỤC': 'Hạng mục không có' }));
      rows.push(specRow(ng, hms[0], 151, all, { 'HẠNG MỤC': '' }));
      const one = await xlsxB64([{ name: 'Hướng dẫn', rows: [['TÊN SẢN PHẨM', 'ghi chú'], ['Không được đọc sheet này', 1]] }, { name: 'San pham', rows }]);
      r = await parse(S.adminA, [one, 'xlsx', ng], { label: 'importParse ' + ng + ' xlsx 1 sheet' });
      lists[ng] = prods(r);
      await parse(S.adminA, [one, 'xlsx'], { label: 'importParse file ' + ng + ' nhưng không truyền ngành (đọc sheet đầu = Hướng dẫn)' });
      await parse(S.adminA, [one, 'xlsx', ng === 'vs' ? 'son' : 'vs'], { label: 'importParse file ' + ng + ' với ngành khác' });
      // (2) kiểu cũ: mỗi hạng mục 1 sheet, không có cột HẠNG MỤC
      const sheets = hms.slice(0, 4).map((hm, i) => { const hd = specHeaders(ng, hm).filter((x) => x !== 'HẠNG MỤC'); return { name: i === 3 ? 'Sheet lạ' : hm.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), rows: [hd, specRow(ng, hm, 200 + i, hd), specRow(ng, hm, 210 + i, hd)] }; });
      sheets.push({ name: 'Không có cột tên', rows: [['MÃ', 'GIÁ'], ['x', 1]] }); sheets.push({ name: 'HUONG DAN', rows: [['TÊN SẢN PHẨM'], ['bỏ qua']] });
      r = await parse(S.adminA, [await xlsxB64(sheets), 'xlsx', ng], { label: 'importParse ' + ng + ' xlsx nhiều sheet theo hạng mục' });
      lists[ng + 'Multi'] = prods(r);
      // (3) csv
      const hd = specHeaders(ng, hms[2]);
      r = await parse(S.edit, [csvB64(toCsv([hd, specRow(ng, hms[2], 300, hd), specRow(ng, hms[2], 301, hd, { 'GIÁ BÁN LẺ': '2.500.000', 'CHIẾT KHẤU ĐẠI LÝ (%)': '12,5' })])), 'csv', ng], { label: 'importParse ' + ng + ' csv' });
      lists[ng + 'Csv'] = prods(r);
    }

    /* ================= importCommit ================= */
    await f.matrixRpc('importCommit', (s) => [[{ ten: 'DI quyền ' + s.label, ma: 'DI-Q-' + f.all.indexOf(s), gia: 1000 }]]);
    for (const s of f.all) await commitR(s, [{ ten: 'DI quyền REST ' + s.label, ma: 'DI-QR-' + f.all.indexOf(s), gia: 2000, dvt: 'm' }]);
    await commit(S.adminA, denList, { label: 'importCommit đèn xlsx (tạo)' });
    await commit(S.adminA, denList, { label: 'importCommit đèn xlsx lần 2 (cập nhật, không đè ĐVT / trạng thái mặc định)' });
    await commitR(S.edit, denCsvList, { label: 'importCommit (REST) đèn csv' });
    await commit(S.duyet, aliasList, { label: 'importCommit tiêu đề tiếng Anh (chỉ các trường ánh xạ)' });
    for (const ng of ['vs', 'son', 'ct']) {
      await commit(S.adminA, lists[ng], { label: 'importCommit ' + ng + ' 1 sheet (kèm dòng lỗi hạng mục)' });
      await commit(S.adminA, lists[ng], { label: 'importCommit ' + ng + ' 1 sheet lần 2 (cập nhật)' });
      await commitR(S.edit, lists[ng + 'Multi'], { label: 'importCommit (REST) ' + ng + ' nhiều sheet' });
      await commit(S.boc, lists[ng + 'Csv'], { label: 'importCommit ' + ng + ' csv' });
      // thiếu thông số bắt buộc; _nganh bị bỏ -> tự nhận theo hạng mục; _nganh sai
      const p0 = lists[ng].find((p) => p.hangMuc === SPEC[ng].HANG_MUC[0]);
      if (p0) {
        const req0 = SPEC[ng].HM[SPEC[ng].HANG_MUC[0]].req;
        const thieu = JSON.parse(JSON.stringify(p0)); thieu.ma = 'DI-' + ng + '-THIEU'; thieu._raw['MÃ SẢN PHẨM'] = thieu.ma; req0.forEach((l) => { thieu._raw[l] = '  '; });
        const tuNhan = JSON.parse(JSON.stringify(p0)); delete tuNhan._nganh; tuNhan.ma = 'DI-' + ng + '-TUNHAN'; tuNhan._raw['MÃ SẢN PHẨM'] = tuNhan.ma;
        const sai = JSON.parse(JSON.stringify(p0)); sai._nganh = 'xyz'; sai.ma = 'DI-' + ng + '-SAI'; sai._raw['MÃ SẢN PHẨM'] = sai.ma; sai._raw['NGÀNH HÀNG'] = 'den';
        const khac = JSON.parse(JSON.stringify(p0)); khac._nganh = ng === 'ct' ? 'vs' : 'ct'; khac.ma = 'DI-' + ng + '-KHAC'; khac._raw['MÃ SẢN PHẨM'] = khac.ma;
        await commit(S.adminA, [thieu, tuNhan, sai, khac], { label: 'importCommit ' + ng + ': thiếu bắt buộc / tự nhận ngành / ngành ghi tay / ngành khác' });
      }
    }
    // phần tử không có _raw, giá 0 không đè, ảnh, ĐVT, dòng ví dụ, không tên
    await commit(S.adminA, [{ ten: 'DI thường 1', ma: 'DI-T-1', nhom: 'Dòng T', hangMuc: 'HM T', thuongHieu: 'TH', ncc: 'NCC', gia: 150000, moTa: 'mô tả', hinhAnh: 'https://img.test/t1.jpg', dvt: 'Hộp' }, { ten: 'DI thường 2', ma: 'DI-T-2', gia: '2.500.000' }, { ten: 'DI thường 3' }, { ma: 'DI-KHONG-TEN', gia: 5 }, { ten: '   ' }, { ten: '[VÍ DỤ] bỏ qua', ma: 'DI-VD' }, { ten: ' [VÍ DỤ] có khoảng trắng đầu', ma: 'DI-VD2' }, {}], { label: 'importCommit phần tử không có _raw' });
    await commit(S.adminA, [{ ten: 'DI thường 1 (đổi tên, giá 0)', ma: 'DI-T-1', gia: 0, hinhAnh: '', dvt: 'Thùng' }, { ten: 'x', ma: 'DI-T-2', gia: -5 }, { ten: 'DI thường 2', ma: 'DI-T-2', gia: 'abc', _raw: { 'GIÁ BÁN LẺ': '', 'TRẠNG THÁI': 'Ngừng kinh doanh', 'ĐƠN VỊ TÍNH': ' ', 'TÊN SẢN PHẨM': '' } }], { label: 'importCommit cập nhật: giá 0 không đè, ảnh rỗng ghi đè' });
    await commit(S.adminA, [{ ten: 'DI raw ưu tiên', ma: 'DI-RAW', gia: 9, _raw: { 'TÊN SẢN PHẨM': 'DI tên trong _raw', 'MÃ SẢN PHẨM': 'DI-RAW-2', 'GIÁ BÁN LẺ': '7.000', 'GIÁ ĐẠI LÝ': '1', 'ẢNH SẢN PHẨM': 'https://img.test/raw.jpg', 'CỘT LẠ': 'x', 'LẮP NGUỒN RỜI': 'x', 'NGÀNH HÀNG': '', 'HẠNG MỤC': 'Bồn cầu', 'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Một khối', 'KÍCH THƯỚC': '700x400', 'LƯỢNG NƯỚC XẢ': '4.8L' } },
      { ten: 'DI lỗi DB', ma: 'DI-LOI', _raw: { 'GIÁ BÁN LẺ': '-100' } }, { ten: 'DI lỗi ck', ma: 'DI-LOI2', _raw: { 'CHIẾT KHẤU ĐẠI LÝ (%)': '250' } }], { label: 'importCommit _raw ưu tiên, tự nhận vệ sinh theo hạng mục, lỗi database từng dòng' });
    for (const a of [[], [null], [''], ['ab'], [0], [5], [true], [{}], [{ length: 2 }], [[]], [[null]], [[undefined]], [['chuỗi']], [[5]], [[[]]], [[{ ten: 'DI _raw chuỗi', ma: 'DI-RS', _raw: 'abc' }]], [[{ ten: 'DI _raw mảng', ma: 'DI-RM', _raw: ['a', 'b'] }]], [[{ ten: 'DI _raw số', ma: 'DI-RN', _raw: 5 }]], [[{ ten: 12345, ma: 678 }]], [[{ ten: 'DI tham số thừa', ma: 'DI-TS' }], 'thừa']])
      await h.both(S.adminA, 'importCommit', a, { label: 'importCommit tham số ' + JSON.stringify(a) });
    // phạm vi công ty
    /* [khoảng trống: bộ chạy không xác định] như area3/01: super không công ty tra dòng trùng mã không lọc công ty, limit 1 không ORDER BY
       (store_supa.js:535). Super nhập TRƯỚC khi công ty B có cùng mã -> chỉ dòng của A khớp, kết quả xác định. */
    await commit(S.root, denList.slice(0, 2), { label: 'importCommit @super (không công ty; chỉ dòng của A khớp -> cập nhật)' });
    await commit(S.adminB, denList.slice(0, 2), { label: 'importCommit cùng mã @admin B (dòng riêng)' });
    await commit(S.viewA, denList.slice(0, 2), { label: 'importCommit @super xem A (cập nhật dòng của A)' });
    await commit(S.adminC, lists.vs.slice(0, 3), { label: 'importCommit @admin C' });
    // nhập lại SP đã duyệt -> bỏ duyệt
    await h.rpc(S.adminA, 'setSpDuyet', [['DI-DEN-1', 'DI-DEN-2'], true]);
    await commit(S.edit, denList.slice(0, 1), { label: 'importCommit SP đã duyệt -> bỏ duyệt' });

    await h.both(S.adminA, 'getProducts', [], { label: 'getProducts @admin A sau nhập hàng loạt' });
    await h.both(S.adminA, 'getProductHistory', ['DI-DEN-1']);
    await h.both(S.adminA, 'getAuditLog', [50]);
    await h.dbCheck('sau kịch bản nhập hàng loạt', TABLES);
  },
};
