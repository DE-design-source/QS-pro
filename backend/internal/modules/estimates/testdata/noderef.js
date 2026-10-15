'use strict';
/* Nạp MÃ NODE THẬT để lấy giá trị đối chiếu cho module estimates:
   - các hàm ct* không được export của server/store_supa.js (biên dịch nguyên file, chỉ nối thêm dòng export)
   - exportCongTacXlsx của server/index.js (cắt đúng đoạn CT_COLS + hàm, không chạy server)
   CHỈ chạy với DATABASE_URL trỏ qspro_nodetest. */
const fs = require('fs');
const path = require('path');
const Module = require('module');

if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const serverDir = path.join(root, 'server');

function loadStore() {
  const file = path.join(serverDir, 'store_supa.js');
  const src = fs.readFileSync(file, 'utf8') +
    '\nmodule.exports.__ct = { ctToObj, ctToRow_, ctDiff_, ctErr_, ctMissingCol_, ctHistThieu_, ctTry_ };\n';
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(serverDir);
  m._compile(src, file);
  return m.exports;
}

function loadExport() {
  const src = fs.readFileSync(path.join(serverDir, 'index.js'), 'utf8');
  const a = src.indexOf('const CT_COLS = [');
  const b = src.indexOf("app.post('/export/cong-tac'");
  if (a < 0 || b < a) throw new Error('không tìm thấy exportCongTacXlsx trong index.js');
  const req = Module.createRequire(path.join(serverDir, 'index.js'));
  return new Function('require', src.slice(a, b) + '\nreturn exportCongTacXlsx;')(req);
}

module.exports = {
  root: root,
  loadStore: loadStore,
  loadExport: loadExport,
  supa: function () { return require(path.join(serverDir, 'supa.js')); },
  tenant: function () { return require(path.join(serverDir, 'tenant.js')); },
  auth: function () { return require(path.join(serverDir, 'auth.js')); },
  ExcelJS: function () { return require(path.join(root, 'node_modules', 'exceljs')); }
};
