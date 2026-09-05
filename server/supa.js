'use strict';
/************************************************************
 * Supabase REST client (PostgREST) + Storage
 * Dùng publishable key phía server. RLS đã tắt trên các bảng.
 ************************************************************/
require('dotenv').config();
// Cố định project Supabase đúng (publishable key - công khai). Ghi thẳng trong code để
// production luôn dùng đúng project, không phụ thuộc biến môi trường Render (tránh trỏ nhầm).
// Muốn đổi project: dùng biến SUPABASE_URL_OVERRIDE / SUPABASE_KEY_OVERRIDE.
const DEFAULT_URL = 'https://xcjnpjpkmwhekkabpjzw.supabase.co';
const DEFAULT_KEY = 'sb_publishable_Am7BKsK-MM3at1Gv34iY0g_bHJopSsV';
const URL = (process.env.SUPABASE_URL_OVERRIDE || DEFAULT_URL).replace(/\/+$/, '');
const KEY = process.env.SUPABASE_KEY_OVERRIDE || DEFAULT_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'products';

const tenant = require('./tenant');
// Các bảng thuộc về 1 CÔNG TY -> mọi truy vấn tự động lọc theo công ty đang đăng nhập.
// Làm ở tầng này để KHÔNG SÓT chỗ nào (an toàn hơn nhớ thêm filter ở từng hàm).
const TENANT_TABLES = {
  du_an: 1, db_bao_gia: 1, khai_toan: 1, db_san_pham: 1, db_san_pham_history: 1,
  don_mua_hang: 1, chi_tiet_mua_hang: 1, notifications: 1, delete_requests: 1,
  audit_log: 1, users: 1
};
function tenantFilter_(table, opt) {
  if ((opt && opt.noScope) || !TENANT_TABLES[table]) return '';
  if (!tenant.scoped()) return '';                       // login / super admin xem toàn hệ thống
  return 'cong_ty_id=eq.' + encodeURIComponent(tenant.tenantId());
}
function withScope_(table, filter, opt) {
  const t = tenantFilter_(table, opt);
  if (!t) return filter || '';
  return filter ? (filter + '&' + t) : t;
}

function ok() { return !!(URL && KEY); }
function headers(extra) {
  return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, extra || {});
}
async function rest(method, path, { body, prefer } = {}) {
  const res = await fetch(URL + '/rest/v1/' + path, {
    method: method,
    headers: headers(prefer ? { Prefer: prefer } : null),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (res.status >= 400) throw new Error('Supabase ' + method + ' ' + path + ' -> ' + res.status + ' ' + (txt || '').slice(0, 300));
  return data;
}
// SELECT: table, {select, filter(chuỗi PostgREST vd 'ma_du_an=eq.X'), order, limit}
async function select(table, opt) {
  opt = opt || {};
  const qs = [];
  qs.push('select=' + encodeURIComponent(opt.select || '*'));
  const f = withScope_(table, opt.filter, opt);
  if (f) qs.push(f);
  if (opt.order) qs.push('order=' + encodeURIComponent(opt.order));
  if (opt.limit) qs.push('limit=' + opt.limit);
  return rest('GET', table + '?' + qs.join('&')) || [];
}
async function insert(table, rows, opt) {
  let arr = Array.isArray(rows) ? rows : [rows];
  if (!arr.length) return [];
  // Tự gắn công ty cho dòng mới (nếu bảng thuộc công ty và đang có ngữ cảnh)
  if (TENANT_TABLES[table] && !(opt && opt.noScope) && tenant.scoped()) {
    const ct = tenant.tenantId();
    arr = arr.map(function (r) { return r.cong_ty_id ? r : Object.assign({}, r, { cong_ty_id: ct }); });
  }
  return rest('POST', table, { body: arr, prefer: 'return=representation' });
}
async function update(table, filter, patch, opt) {
  return rest('PATCH', table + '?' + withScope_(table, filter, opt), { body: patch, prefer: 'return=representation' });
}
async function remove(table, filter, opt) {
  return rest('DELETE', table + '?' + withScope_(table, filter, opt), { prefer: 'return=representation' });
}
// Upload ảnh (buffer) lên Storage -> trả public URL
async function uploadToStorage(buffer, path, contentType) {
  const res = await fetch(URL + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(path), {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': contentType || 'image/jpeg', 'x-upsert': 'true' },
    body: buffer
  });
  if (res.status >= 400) throw new Error('Storage upload -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return URL + '/storage/v1/object/public/' + BUCKET + '/' + encodeURIComponent(path);
}
// escape giá trị cho filter eq. (PostgREST)
function eq(col, val) { return col + '=eq.' + encodeURIComponent(val); }

module.exports = { ok, rest, select, insert, update, remove, uploadToStorage, eq, _url: URL, _bucket: BUCKET };
