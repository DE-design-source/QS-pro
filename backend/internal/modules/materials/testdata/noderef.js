'use strict';
/* Nạp MÃ NODE THẬT để lấy giá trị đối chiếu cho module materials:
   - server/store_supa.js và server/auth.js biên dịch nguyên file, chỉ nối thêm 1 dòng export các hàm nội bộ;
     bản store này được đặt vào require.cache nên auth.js dùng CHUNG một bản (chung cache danh mục, _hasWhoCol)
   - exportProductsXlsx của server/index.js (cắt đúng đoạn hàm, không chạy server)
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

function compile(name, extra) {
  const file = path.join(serverDir, name);
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(serverDir);
  require.cache[file] = m;
  m._compile(fs.readFileSync(file, 'utf8') + '\n' + extra + '\n', file);
  m.loaded = true;
  return m.exports;
}
const supa = require(path.join(serverDir, 'supa.js'));
const tenant = require(path.join(serverDir, 'tenant.js'));
const store = compile('store_supa.js', 'module.exports.__m = { prodToObj, fmtUnit, fmtList, fmtCutout_, firstImg, whoColMissing_, comboMissing_, ' +
  'tblErr_, btMissing_, getProductsCached, guardSpChung_ };');
const auth = compile('auth.js', 'module.exports.__m = { parseItems_, spPerms_ };');

function loadExport() {
  const src = fs.readFileSync(path.join(serverDir, 'index.js'), 'utf8');
  const a = src.indexOf('async function exportProductsXlsx(keys)');
  const b = src.indexOf('// Tải file: POST');
  if (a < 0 || b < a) throw new Error('không tìm thấy exportProductsXlsx trong index.js');
  const req = Module.createRequire(path.join(serverDir, 'index.js'));
  return new Function('require', 'store', src.slice(a, b) + '\nreturn exportProductsXlsx;')(req, store);
}

/* Bảng hàm như REGISTRY của index.js (I:31-116) cho phần của module, kèm các hàm gọi thẳng ($...).
   Hàm thuộc ACTOR_FNS nhận actor làm tham số đầu, đúng như dispatcher (I:625). */
const ACTOR = { saveDbProduct: 1, deleteDbProduct: 1, updateDbProductTracked: 1, setSpDuyet: 1, setYeuThich: 1, setCombo: 1, setBienThe: 1,
  spMyPerms: 1, importCommit: 1, requestDeleteProducts: 1, listDeleteRequests: 1, resolveDeleteRequest: 1 };
const FNS = {
  getProducts: store.getProducts, saveDbProduct: auth.createProductGated, uploadImage: store.uploadImage, uploadFile: store.uploadFile,
  deleteDbProduct: store.deleteDbProduct, getDbProduct: store.getDbProduct, updateDbProductTracked: auth.updateProductGated,
  setSpDuyet: auth.setSpDuyet, setYeuThich: auth.setYeuThich, getCombo: store.getCombo, setCombo: auth.setComboGated,
  getBienThe: store.getBienThe, setBienThe: auth.setBienTheGated, spMyPerms: auth.spMyPerms, getProductHistory: store.getProductHistory,
  importParse: store.importParse, importCommit: auth.importGated, requestDeleteProducts: auth.requestDeleteProducts,
  listDeleteRequests: auth.listDeleteRequests, resolveDeleteRequest: auth.resolveDeleteRequest,
  // gọi thẳng, không qua cửa ngõ: tham số đầu của các hàm có actor nằm sẵn trong args
  $saveDbProduct: store.saveDbProduct, $deleteDbProduct: store.deleteDbProduct, $updateDbProductTracked: store.updateDbProductTracked,
  $importCommit: store.importCommit, $getProductsCached: store.__m.getProductsCached, $getCatalogSheets: store.getCatalogSheets,
  $buildCatalog: store.buildCatalog,
  $uploadFileBuf: function (size, name, ct) { return store.uploadFileBuf(size == null ? size : Buffer.alloc(size, 65), name, ct == null ? undefined : ct); }
};
function call(fn, actor, args) {
  const f = FNS[fn];
  if (!f) throw new Error('hàm lạ: ' + fn);
  return f.apply(null, ACTOR[fn] ? [actor].concat(args) : args);
}

module.exports = { root: root, supa: supa, tenant: tenant, store: store, auth: auth, loadExport: loadExport, call: call,
  ExcelJS: function () { return require(path.join(root, 'node_modules', 'exceljs')); } };
