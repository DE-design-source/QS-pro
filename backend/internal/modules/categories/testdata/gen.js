'use strict';
/* Sinh testdata/golden.json từ mã Node THẬT (server/store_supa.js, server/*-template.js, biểu thức tên file ở server/index.js:824).
   Chạy (không truy vấn database, nhưng store_supa.js nạp cấu hình nên bắt buộc trỏ database thử):
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x \
     node backend/internal/modules/categories/testdata/gen.js */
if (!/qspro_nodetest/.test(process.env.DATABASE_URL || '')) { console.error('DATABASE_URL phải trỏ qspro_nodetest'); process.exit(2); }
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../../../../..');
const store = require(path.join(root, 'server/store_supa.js'));
const VS = require(path.join(root, 'backend/internal/shared/specs/js/vs-spec.js'));
const SON = require(path.join(root, 'backend/internal/shared/specs/js/son-spec.js'));
const CT = require(path.join(root, 'backend/internal/shared/specs/js/ct-spec.js'));
const tpl = { vs: require(path.join(root, 'server/vs-template.js')), son: require(path.join(root, 'server/son-template.js')), ct: require(path.join(root, 'server/ct-template.js')) };
const { dump } = require('./xlsx-dump.js');
const http = require('http');
const express = require(path.join(root, 'node_modules/express'));
const ExcelJS = require(path.join(root, 'node_modules/exceljs'));
const { variants } = require('./variants.js');

// Tên file tải về của /mau-nhap-son-nuoc.xlsx - chép nguyên biểu thức ở server/index.js:824
function tenSon(hm) {
  return SON.chuanHM(hm) ? ('Mau-nhap-' + SON.chuanHM(hm).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^\w]+/g, '-')) : 'Mau-nhap-son-nuoc';
}

// Gom style trùng nhau thành bảng để file gọn
function compact(d) {
  const styles = [], idx = {};
  d.sheets.forEach(function (s) {
    s.columns.forEach(function (c) { if (Object.keys(c.style).length) throw new Error('cột có style'); delete c.style; });
    s.rows.forEach(function (r) {
      r.cells = r.cells.map(function (c) {
        const k = JSON.stringify(c.style);
        if (!(k in idx)) { idx[k] = styles.length; styles.push(c.style); }
        if (c.note != null) throw new Error('ô có ghi chú');
        return [c.type, c.value, idx[k]];
      });
    });
  });
  d.styles = styles;
  return d;
}

// Trích nguyên văn 1 handler `app.get('<route>', ...)` của server/index.js (tới dòng "});" đầu tiên ở cột 0)
function handlerSrc(route) {
  const lines = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8').split(/\r?\n/);
  const a = lines.findIndex(function (l) { return l.indexOf("app.get('" + route + "'") === 0; });
  if (a < 0) throw new Error('không thấy route ' + route);
  let b = a; while (lines[b] !== '});') b++;
  return lines.slice(a, b + 1).join('\n');
}
function get(port, url) {
  return new Promise(function (resolve, reject) {
    http.get({ host: '127.0.0.1', port: port, path: url }, function (res) {
      const chunks = [];
      res.on('data', function (d) { chunks.push(d); });
      res.on('end', function () { resolve({ res: res, body: Buffer.concat(chunks) }); });
    }).on('error', reject);
  });
}
const enc = encodeURIComponent;
const HTTP_URLS = ['/mau-nhap-thiet-bi-ve-sinh.xlsx', '/mau-nhap-thiet-bi-ve-sinh.xlsx?hm=' + enc('Bồn cầu'),
  '/mau-nhap-cong-tac-o-cam.xlsx', '/mau-nhap-cong-tac-o-cam.xlsx?hm=', '/mau-nhap-cong-tac-o-cam.xlsx?hm=' + enc('Công tắc cơ'),
  '/mau-nhap-cong-tac-o-cam.xlsx?hm=++o+cam+dien++', '/mau-nhap-cong-tac-o-cam.xlsx?hm=khong', '/mau-nhap-cong-tac-o-cam.xlsx?hm=a&hm=b',
  '/mau-nhap-cong-tac-o-cam.xlsx?hm[]=' + enc('Ổ cắm thông minh'), '/mau-nhap-cong-tac-o-cam.xlsx?hm[k]=v',
  '/mau-nhap-son-nuoc.xlsx', '/mau-nhap-son-nuoc.xlsx?hm', '/mau-nhap-son-nuoc.xlsx?hm=%20son%20lot%20', '/mau-nhap-son-nuoc.xlsx?hm=xyz',
  '/mau-nhap-son-nuoc.xlsx?hm%5B%5D=' + enc('Sơn dầu'), '/mau-nhap-son-nuoc.xlsx?hm=' + enc('Sơn lót') + '&hm=x', '/mau-nhap-son-nuoc.xlsx?hm=%E0%A4%A',
  '/mau-nhap-son-nuoc.xlsx?x=1&hm=' + enc('dung môi & phụ gia').replace(/%20/g, '+'),
  // client thô gửi kèm "#...": Express bỏ từ dấu "#" trước khi đọc query
  '/mau-nhap-son-nuoc.xlsx?hm=' + enc('Sơn ngoại thất') + '#frag', '/mau-nhap-cong-tac-o-cam.xlsx?hm=' + enc('Ổ cắm sạc USB') + '#frag',
  '/mau-nhap-son-nuoc.xlsx?x=1#&hm=' + enc('Sơn lót')
].concat(SON.HANG_MUC.map(function (hm) { return '/mau-nhap-son-nuoc.xlsx?hm=' + enc(hm); }));

async function httpGolden() {
  const app = express();
  const req = function (p) { return require(p.charAt(0) === '.' ? path.join(root, 'server', p) : p); };
  ['/mau-nhap-thiet-bi-ve-sinh.xlsx', '/mau-nhap-cong-tac-o-cam.xlsx', '/mau-nhap-son-nuoc.xlsx'].forEach(function (r) {
    new Function('app', 'require', handlerSrc(r))(app, req);
  });
  const srv = await new Promise(function (r) { const s = app.listen(0, '127.0.0.1', function () { r(s); }); });
  const out = [];
  for (const url of HTTP_URLS) {
    const r = await get(srv.address().port, url), h = r.res.headers;
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(r.body);
    out.push({ url: url, status: r.res.statusCode, contentType: h['content-type'] || null, contentDisposition: h['content-disposition'] || null,
      cacheControl: h['cache-control'] || null, etagYeu: /^W\/"[0-9a-f]+-.{27}"$/.test(h.etag || ''), contentLengthDung: h['content-length'] === String(r.body.length),
      tieuDe: wb.worksheets[1].getCell('A1').value, cot: wb.worksheets[0].getRow(1).values.slice(1), hmVD: wb.worksheets[0].getCell('C2').value });
  }
  srv.close();
  return out;
}

(async function () {
  const hmThu = [null, undefined, '', '  ', 'Bồn cầu', 'bon cau', ' BỒN  CẦU ', 'Sơn lót', 'son lot', 'Công tắc cơ', 'cong tac co', 'Ổ cắm điện',
    'Đèn âm trần', 'Lavabo', 'Sơn dầu', 'Dung môi & phụ gia', 'Thiết bị khác', 'Công tắc khác', 0, 12, true];
  const ngThu = [null, undefined, '', '  ', 'vs', ' son ', 'den', 'ct', 'xyz', 0, 5, false];
  const nganhCua = [];
  ngThu.forEach(function (ng) { hmThu.forEach(function (hm) {
    nganhCua.push({ nganh: ng === undefined ? { $undefined: true } : ng, hm: hm === undefined ? { $undefined: true } : hm, out: store.nganhCua_(ng, hm) });
  }); });
  const COL2LABEL = {}; Object.keys(store.DB_LABEL2COL).forEach(function (lb) { COL2LABEL[store.DB_LABEL2COL[lb]] = lb; });   // S:596
  const vs = variants();
  const out = {
    nganhCua: nganhCua,
    mucNganh: Object.keys(store.MUC_NGANH).map(function (k) { return [k, store.MUC_NGANH[k]]; }),
    dbLabel2Col: Object.keys(store.DB_LABEL2COL).map(function (k) { return [k, store.DB_LABEL2COL[k]]; }),
    col2Label: Object.keys(COL2LABEL).map(function (k) { return [k, COL2LABEL[k]]; }),
    tenSon: [''].concat(SON.HANG_MUC, ['son lot', ' SƠN  SÀN epoxy ', 'khong co', 'Bồn cầu']).map(function (hm) { return [hm, tenSon(hm)]; }),
    variants: [],
    http: await httpGolden()
  };
  for (const v of vs) {
    const spec = { vs: VS, son: SON, ct: CT }[v.kind];
    const hm = v.kind === 'vs' ? '' : (spec.chuanHM(v.hm) || '');
    out.variants.push({ name: v.name, kind: v.kind, hm: v.hm, cotMau: tpl[v.kind].cotMau(hm), dump: compact(await dump(Buffer.from(await v.build()))) });
  }
  fs.writeFileSync(path.join(__dirname, 'golden.json'), JSON.stringify(out) + '\n');
  console.log('golden.json: ' + out.variants.length + ' file mẫu, ' + out.http.length + ' ca HTTP, ' + nganhCua.length + ' ca nganhCua_, ' + out.dbLabel2Col.length + ' nhãn');
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
