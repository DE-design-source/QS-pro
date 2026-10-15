'use strict';
/* Hàm rpc -> request REST /api/v1 tương ứng (PORTING_MAP mục A). Mỗi mục nhận mảng args của lời gọi rpc và trả
   { method, path, query?, body? }, hoặc null khi lời gọi đó không biểu diễn được bằng REST (vd thiếu tham số đường dẫn).
   Thêm vùng mới: bổ sung mục vào đây. */
// Tham số đường dẫn / query luôn là CHUỖI: giá trị mà JS xử lý khác chuỗi tương ứng (0, NaN, boolean, null, object) thì không có dạng REST
const seg = (v) => (typeof v === 'string' && v !== '' && v !== '.' && v !== '..') || (typeof v === 'number' && v !== 0 && v === v) ? encodeURIComponent(String(v)) : null;
// như seg nhưng chỉ nhận chuỗi (hàm gọi s(x).trim() rồi so chuỗi: số cũng ra cùng kết quả nhưng giữ cho rõ)
const strSeg = (v) => (typeof v === 'string' && v !== '' && v.trim() === v && v !== '.' && v !== '..' ? encodeURIComponent(v) : seg(typeof v === 'number' ? v : null));
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
// body { k: v } chỉ gồm các tham số client CÓ gửi (tham số thiếu = không có khoá)
const pick = (args, from, names) => { const o = {}; names.forEach((k, i) => { if (args.length > from + i) o[k] = args[from + i] === undefined ? null : args[from + i]; }); return o; };   // undefined trong mảng args -> null (như JSON.stringify của lời gọi rpc)
const withId = (method, tail, names) => (a) => { const s = seg(a[0]); return s === null ? null : { method, path: tail(s), body: names ? pick(a, 1, names) : undefined }; };
const withIdBody = (method, tail) => (a) => { const s = seg(a[0]); return s === null || (a.length > 1 && !obj(a[1])) ? null : { method, path: tail(s), body: a.length > 1 ? a[1] : undefined }; };
const q1 = (path, name) => (a) => (a.length && typeof a[0] !== 'string' && typeof a[0] !== 'number' ? null : { method: 'GET', path, query: a.length ? { [name]: String(a[0]) } : undefined });
const plain = (method, path) => () => ({ method, path });
const body0 = (method, path) => (a) => (a.length && !obj(a[0]) ? null : { method, path, body: a.length ? a[0] : undefined });

module.exports = {
  // auth
  login: (a) => ({ method: 'POST', path: '/auth/login', body: pick(a, 0, ['username', 'password']) }),
  me: plain('GET', '/auth/me'),
  setMyPref: (a) => { const s = seg(a[0]); return s === null || typeof a[0] !== 'string' ? null : { method: 'PUT', path: '/auth/me/prefs/' + s, body: pick(a, 1, ['value']) }; },
  logout: plain('POST', '/auth/logout'),
  changePassword: (a) => ({ method: 'POST', path: '/auth/change-password', body: pick(a, 0, ['oldPw', 'newPw']) }),
  logClientError: body0('POST', '/client-errors'),
  // users
  adminListUsers: plain('GET', '/users'),
  adminCreateUser: body0('POST', '/users'),
  adminUpdateUser: withIdBody('PATCH', (s) => '/users/' + s),
  adminSetPassword: withId('PUT', (s) => '/users/' + s + '/password', ['newPassword']),
  adminSetActive: withId('PUT', (s) => '/users/' + s + '/active', ['active']),
  adminDeleteUser: withId('DELETE', (s) => '/users/' + s),
  getAuditLog: q1('/audit-log', 'limit'),
  // notifications
  notifCount: plain('GET', '/notifications/unread-count'),
  notifList: q1('/notifications', 'limit'),
  notifRead: withId('POST', (s) => '/notifications/' + s + '/read'),
  notifReadAll: plain('POST', '/notifications/read-all'),
  // companies
  listCongTy: plain('GET', '/companies'),
  createCongTy: body0('POST', '/companies'),
  updateCongTy: withIdBody('PATCH', (s) => '/companies/' + s),
  deleteCongTy: withId('DELETE', (s) => '/companies/' + s),
  listCongTyUsers: withId('GET', (s) => '/companies/' + s + '/users'),
  createCongTyUser: withIdBody('POST', (s) => '/companies/' + s + '/users'),
  // projects
  bootstrap: (a) => (!a.length ? { method: 'GET', path: '/bootstrap' } : typeof a[0] === 'string' && a[0] !== '' ? { method: 'GET', path: '/bootstrap', query: { maDA: a[0] } } : null),
  getProjects: plain('GET', '/projects'),
  createProject: body0('POST', '/projects'),
  updateProject: withIdBody('PATCH', (s) => '/projects/' + s),
  deleteProject: withId('DELETE', (s) => '/projects/' + s),
  duplicateProject: withIdBody('POST', (s) => '/projects/' + s + '/duplicate'),
  getProjData: withId('GET', (s) => '/projects/' + s + '/data'),
  setProjData: (a) => { const s = strSeg(a[0]), k = strSeg(a[1]); return s === null || k === null ? null : { method: 'PUT', path: '/projects/' + s + '/data/' + k, body: pick(a, 2, ['giaTri']) }; },
  // takeoff
  getLines: withId('GET', (s) => '/projects/' + s + '/lines'),
  addLine: withId('POST', (s) => '/projects/' + s + '/lines', ['product', 'soLuong']),
  addBlankLine: withIdBody('POST', (s) => '/projects/' + s + '/lines/blank'),
  updateLine: withIdBody('PATCH', (s) => '/lines/' + s),
  deleteLine: withId('DELETE', (s) => '/lines/' + s),
  saveLineAsProduct: body0('POST', '/lines/save-as-product'),
  // quotations
  getCoverOrInit: withId('GET', (s) => '/projects/' + s + '/cover'),
  buildCoverFromTemplate: withId('GET', (s) => '/projects/' + s + '/cover/template'),
  saveCover: withId('PUT', (s) => '/projects/' + s + '/cover', ['rows']),
  exportBaoGia: withId('POST', (s) => '/projects/' + s + '/quotation/export', ['cols', 'format', 'nodes', 'phanTho', 'anMuc', 'tong', 'org']),
  // estimates
  ctList: plain('GET', '/work-items'),
  ctSave: (a) => (a.length && (a[0] === null || typeof a[0] !== 'object') ? null : { method: 'POST', path: '/work-items', body: a.length ? a[0] : undefined }),
  // thiếu patch: rpc ném TypeError (patch undefined), còn PATCH không thân = patch {} -> không có dạng REST
  ctUpdate: (a) => (a.length < 2 ? null : withIdBody('PATCH', (s) => '/work-items/' + s)(a)),
  ctDelete: (a) => ({ method: 'POST', path: '/work-items/delete', body: pick(a, 0, ['ids']) }),
  ctDuyet: (a) => ({ method: 'POST', path: '/work-items/approval', body: pick(a, 0, ['ids', 'approve']) }),
  ctFav: (a) => ({ method: 'POST', path: '/work-items/favorites', body: pick(a, 0, ['ids', 'on']) }),
  ctHistory: withId('GET', (s) => '/work-items/' + s + '/history'),
  // materials (khoá sản phẩm: id dòng hoặc mã SP; mã có dấu cách đầu / cuối không đi qua đường dẫn được -> strSeg)
  getProducts: plain('GET', '/products'),
  saveDbProduct: body0('POST', '/products'),
  getDbProduct: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/products/' + s }; },
  updateDbProductTracked: (a) => { const s = strSeg(a[0]); return s === null || (a.length > 1 && !obj(a[1])) ? null : { method: 'PATCH', path: '/products/' + s, body: a.length > 1 ? a[1] : undefined }; },
  deleteDbProduct: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'DELETE', path: '/products/' + s }; },
  getCombo: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/products/' + s + '/combo' }; },
  setCombo: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'PUT', path: '/products/' + s + '/combo', body: pick(a, 1, ['items']) }; },
  getBienThe: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/products/' + s + '/variants' }; },
  setBienThe: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'PUT', path: '/products/' + s + '/variants', body: pick(a, 1, ['ids']) }; },
  getProductHistory: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/products/' + s + '/history' }; },
  setSpDuyet: (a) => ({ method: 'POST', path: '/product-approvals', body: pick(a, 0, ['keys', 'approve']) }),
  setYeuThich: (a) => ({ method: 'POST', path: '/product-favorites', body: pick(a, 0, ['keys', 'on']) }),
  spMyPerms: plain('GET', '/product-permissions'),
  uploadImage: (a) => ({ method: 'POST', path: '/uploads/images', body: pick(a, 0, ['base64', 'fileName']) }),
  uploadFile: (a) => ({ method: 'POST', path: '/uploads/files-base64', body: pick(a, 0, ['base64', 'fileName']) }),
  importParse: (a) => ({ method: 'POST', path: '/product-imports/parse', body: pick(a, 0, ['base64', 'ext', 'nganh']) }),
  importCommit: (a) => ({ method: 'POST', path: '/product-imports/commit', body: pick(a, 0, ['products']) }),
  requestDeleteProducts: (a) => ({ method: 'POST', path: '/product-delete-requests', body: pick(a, 0, ['items']) }),
  listDeleteRequests: plain('GET', '/product-delete-requests'),
  resolveDeleteRequest: withId('POST', (s) => '/product-delete-requests/' + s + '/resolve', ['approve']),
  // purchasing
  sendPurchaseRequest: body0('POST', '/purchase-orders'),
  getPurchaseOrders: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/projects/' + s + '/purchase-orders' }; },
  setPurchaseStatus: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'PATCH', path: '/purchase-orders/' + s + '/status', body: pick(a, 1, ['status']) }; },
  getDeXuatList: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/projects/' + s + '/proposals' }; },
  sendDeXuat: body0('POST', '/proposals'),
  listPurchaseRequests: plain('GET', '/purchase-orders'),
  getPurchaseOrder: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/purchase-orders/' + s }; },
  resolvePurchaseRequest: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'POST', path: '/purchase-orders/' + s + '/resolve', body: pick(a, 1, ['approve']) }; },
  listDeXuat: (a) => (a.length && typeof a[0] !== 'string' ? null : { method: 'GET', path: '/proposals', query: a.length && a[0] !== '' ? { loai: a[0] } : undefined }),
  getDeXuat: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'GET', path: '/proposals/' + s }; },
  resolveDeXuat: (a) => { const s = strSeg(a[0]); return s === null ? null : { method: 'POST', path: '/proposals/' + s + '/resolve', body: pick(a, 1, ['approve']) }; },
  // reports
  baoCaoNhapSP: body0('POST', '/reports/new-products'),
};
