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
  if (opt.filter) qs.push(opt.filter);
  if (opt.order) qs.push('order=' + encodeURIComponent(opt.order));
  if (opt.limit) qs.push('limit=' + opt.limit);
  return rest('GET', table + '?' + qs.join('&')) || [];
}
async function insert(table, rows) {
  const arr = Array.isArray(rows) ? rows : [rows];
  if (!arr.length) return [];
  return rest('POST', table, { body: arr, prefer: 'return=representation' });
}
async function update(table, filter, patch) {
  return rest('PATCH', table + '?' + filter, { body: patch, prefer: 'return=representation' });
}
async function remove(table, filter) {
  return rest('DELETE', table + '?' + filter, { prefer: 'return=representation' });
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
