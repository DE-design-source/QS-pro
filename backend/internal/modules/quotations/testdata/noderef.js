'use strict';
/* Nạp MÃ NODE THẬT làm chuẩn đối chiếu cho module quotations:
   - server/store_supa.js được biên dịch nguyên file, chỉ nối thêm 1 dòng để THAY getLines / getProject bằng dữ liệu cố định
     (bên Go hai hàm này là interface của module khác, test truyền bản giả cùng dữ liệu);
   - server/export.js nạp bình thường và dùng đúng bản store ở trên;
   - lark.mediaDownload và fetch được thay bằng bản giả: KHÔNG gọi Lark, không tải gì từ mạng.
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

let store = null;
function loadStore() {
  if (store) return store;
  const file = path.join(serverDir, 'store_supa.js');
  const src = fs.readFileSync(file, 'utf8') +
    '\nmodule.exports.__stub = function (o) { if (o.getLines) getLines = o.getLines; if (o.getProject) getProject = o.getProject; };\n' +
    'module.exports.__real = { getLines: getLines, getProject: getProject };\n';
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(serverDir);
  m._compile(src, file);
  m.loaded = true;
  require.cache[file] = m;   // export.js require('./store_supa') nhận đúng bản này
  store = m.exports;
  return store;
}

// Hàm thuần không được export của export.js (biên dịch nguyên file, chỉ nối thêm dòng export).
function exportInternals() {
  loadStore();
  const file = path.join(serverDir, 'export.js');
  const src = fs.readFileSync(file, 'utf8') + '\nmodule.exports.__in = { nz_, cellOfLine_, px, roman_, sheetName_ };\n';
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(serverDir);
  m._compile(src, file);
  return m.exports.__in;
}

module.exports = {
  root: root,
  exportInternals: exportInternals,
  store: loadStore,
  exportBaoGia: function () { loadStore(); return require(path.join(serverDir, 'export.js')); },
  shared: function () { return require(path.join(serverDir, 'shared.js')); },
  lark: function () { return require(path.join(serverDir, 'lark.js')); },
  supa: function () { return require(path.join(serverDir, 'supa.js')); },
  tenant: function () { return require(path.join(serverDir, 'tenant.js')); },
  ExcelJS: function () { return require(path.join(root, 'node_modules', 'exceljs')); }
};
