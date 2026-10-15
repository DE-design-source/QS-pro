'use strict';
/* Nạp MÃ NODE THẬT để lấy giá trị đối chiếu cho module purchasing:
   - fmtVN, buildPurchaseCard, buildDeXuatCard, sendDeXuat, sendPurchaseRequest của server/index.js không được export
     -> cắt đúng đoạn I:137-319 và biên dịch riêng (không chạy server), các phụ thuộc truyền từ ngoài vào;
   - dxThieuBang_, dxBang_, genMaDon_, genMaDeXuat_ của server/store_supa.js -> biên dịch nguyên file, nối thêm dòng export.
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
    '\nmodule.exports.__mh = { dxThieuBang_, dxBang_, genMaDon_, genMaDeXuat_, n, round0_ };\n';
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(serverDir);
  m._compile(src, file);
  return m.exports;
}

// deps: { webhook, store, auth, console, fetch, Date } - cái nào bỏ trống thì dùng bản toàn cục / bản giả vô hại.
function loadIndex(deps) {
  deps = deps || {};
  const src = fs.readFileSync(path.join(serverDir, 'index.js'), 'utf8');
  const a = src.indexOf('const PURCHASE_WEBHOOK = ');
  const b = src.indexOf('// Giờ Việt Nam');
  if (a < 0 || b < a) throw new Error('không tìm thấy đoạn mua hàng trong index.js');
  const fakeProcess = { env: { PURCHASE_WEBHOOK: deps.webhook || 'http://127.0.0.1:9/x' } };
  return new Function('process', 'store', 'auth', 'console', 'fetch', 'Date',
    src.slice(a, b) + '\nreturn { PURCHASE_WEBHOOK, fmtVN, buildPurchaseCard, buildDeXuatCard, sendDeXuat, sendPurchaseRequest };'
  )(fakeProcess, deps.store, deps.auth, deps.console || console, deps.fetch || fetch, deps.Date || Date);
}

module.exports = {
  root: root,
  loadStore: loadStore,
  loadIndex: loadIndex,
  supa: function () { return require(path.join(serverDir, 'supa.js')); },
  tenant: function () { return require(path.join(serverDir, 'tenant.js')); },
  auth: function () { return require(path.join(serverDir, 'auth.js')); }
};
