'use strict';
/************************************************************
 * Lớp dịch PostgREST -> Postgres (dùng khi có biến DATABASE_URL)
 * App gửi đúng các yêu cầu như với Supabase: rest(method, 'bảng?select=..&cột=op.giá trị&order=..&limit=..', {body, prefer}).
 * Ở đây phân tích chuỗi đó và chạy SQL trên schema "qs" — các VIEW mang TÊN BẢNG / CỘT CŨ trỏ vào schema mới
 * (db/pg/compat_views.sql). Nhờ vậy toàn bộ store / auth giữ nguyên.
 * Hỗ trợ đúng tập con PostgREST app dùng: select (danh sách cột) · lọc eq neq gt gte lt lte like ilike is in, not.<op>,
 * and=(…) / or=(…) lồng and(…) / or(…) · order · limit · offset · Range · Prefer return=representation.
 ************************************************************/
const { Pool, types } = require('pg');
// Trả về ĐÚNG kiểu như PostgREST: numeric / int8 là số, ngày giờ là CHUỖI ISO (không phải Date object)
types.setTypeParser(1700, function (v) { return v == null ? null : parseFloat(v); });          // numeric
types.setTypeParser(20, function (v) { return v == null ? null : Number(v); });                // int8 (id)
function isoTs_(v) { return v == null ? null : v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'); }
types.setTypeParser(1184, isoTs_);                                                              // timestamptz
types.setTypeParser(1114, function (v) { return v == null ? null : v.replace(' ', 'T'); });    // timestamp
types.setTypeParser(1082, function (v) { return v; });                                          // date

const SCHEMA = 'qs';
let pool = null;
function pool_() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    pool = new Pool({ connectionString: url, max: 8, ssl: /sslmode=require|render\.com/.test(url) ? { rejectUnauthorized: false } : undefined });
  }
  return pool;
}
async function query(sql, params) { return (await pool_().query(sql, params)).rows; }

function qi(id) {                                     // tên cột / bảng: chỉ chữ thường, số, _
  if (!/^[a-z_][a-z0-9_]*$/.test(id)) throw new Error('Tên cột / bảng không hợp lệ: ' + id);
  return '"' + id + '"';
}
// tách theo dấu phẩy ở mức ngoài cùng (bỏ qua trong ngoặc / trong "…")
function tach(s) {
  const out = []; let d = 0, q = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === '\\' && i + 1 < s.length) { cur += s[++i]; continue; } if (c === '"') q = false; continue; }
    if (c === '"') { q = true; cur += c; continue; }
    if (c === '(') d++; if (c === ')') d--;
    if (c === ',' && d === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur !== '') out.push(cur);
  return out;
}
function giaTri(v) {                                  // "chuỗi \"có\" ngoặc" -> chuỗi; còn lại giữ nguyên
  if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') return v.slice(1, -1).replace(/\\(.)/g, '$1');
  return v;
}
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' };
// 1 điều kiện: cột + "op.giá trị" (đã giải mã URL)
function dieuKien(col, rest, P) {
  let not = false;
  if (rest.indexOf('not.') === 0) { not = true; rest = rest.slice(4); }
  const dot = rest.indexOf('.'); const op = dot < 0 ? rest : rest.slice(0, dot), v = dot < 0 ? '' : rest.slice(dot + 1);
  const c = qi(col); let sql;
  if (op === 'is') {
    const k = v.toLowerCase(); if (!/^(null|true|false|unknown)$/.test(k)) throw new Error('is.' + v + ' không hỗ trợ');
    sql = c + ' IS ' + k.toUpperCase();
  } else if (op === 'in') {
    const ds = tach(v.replace(/^\(/, '').replace(/\)$/, '')).map(giaTri);
    if (!ds.length) sql = 'FALSE';
    else { sql = c + '::text IN (' + ds.map(function (x) { P.push(x); return '$' + P.length; }).join(',') + ')'; }
  } else if (OPS[op]) {
    let x = giaTri(v); if (op === 'like' || op === 'ilike') x = x.replace(/\*/g, '%');
    P.push(x); sql = c + '::text ' + OPS[op] + ' $' + P.length;
    if (op === 'eq' || op === 'neq') sql = '(' + sql + ')';
  } else throw new Error('Toán tử lọc "' + op + '" chưa hỗ trợ');
  return not ? 'NOT (' + sql + ')' : sql;
}
// biểu thức logic: and(…) / or(…) / cột.op.giá trị
function bieuThuc(s, P) {
  const m = /^(and|or)\((.*)\)$/.exec(s);
  if (m) return '(' + tach(m[2]).map(function (x) { return bieuThuc(x, P); }).join(m[1] === 'and' ? ' AND ' : ' OR ') + ')';
  const dot = s.indexOf('.'); return dieuKien(s.slice(0, dot), s.slice(dot + 1), P);
}
// 'bảng?a=b&c=d' -> {bang, select, where, P, order, limit, offset}
function phanTich(path) {
  const qm = path.indexOf('?'); const bang = qm < 0 ? path : path.slice(0, qm), qs = qm < 0 ? '' : path.slice(qm + 1);
  const r = { bang: bang, cot: '*', where: [], P: [], order: '', limit: null, offset: null };
  qs.split('&').filter(Boolean).forEach(function (part) {
    const eqi = part.indexOf('='); const k = decodeURIComponent(part.slice(0, eqi)), v = decodeURIComponent(part.slice(eqi + 1));
    if (k === 'select') { r.cot = v === '*' ? '*' : v.split(',').map(function (c) { return qi(c.trim()); }).join(','); return; }
    if (k === 'order') { r.order = v.split(',').map(function (o) { const a = o.split('.'); return qi(a[0]) + (a[1] === 'desc' ? ' DESC' : ' ASC') + (a[2] === 'nullsfirst' ? ' NULLS FIRST' : a[2] === 'nullslast' ? ' NULLS LAST' : ''); }).join(','); return; }
    if (k === 'limit') { r.limit = Math.max(0, parseInt(v, 10) || 0); return; }
    if (k === 'offset') { r.offset = Math.max(0, parseInt(v, 10) || 0); return; }
    if (k === 'and' || k === 'or') { r.where.push(bieuThuc(k + v, r.P)); return; }
    r.where.push(dieuKien(k, v, r.P));
  });
  return r;
}
// Cột GHI ĐƯỢC của từng view (cột tính ra như cong_ty_id lấy từ bảng cha thì bỏ khi ghi). View có trigger INSTEAD OF tự xử lý -> giữ hết.
let ghiDuoc = null;
async function cotGhi_(bang) {
  if (!ghiDuoc) {
    ghiDuoc = {};
    const coTrigger = {}; (await query("select distinct event_object_table t from information_schema.triggers where trigger_schema=$1", [SCHEMA])).forEach(function (x) { coTrigger[x.t] = 1; });
    (await query("select table_name t, column_name c, is_updatable u, data_type d from information_schema.columns where table_schema=$1", [SCHEMA])).forEach(function (x) {
      (ghiDuoc[x.t] = ghiDuoc[x.t] || {})[x.c] = { ghi: !!coTrigger[x.t] || x.u === 'YES', chu: x.d === 'text' || x.d === 'character varying' };
    });
  }
  return ghiDuoc[bang] || null;
}
function loiPG_(e, method, path) {           // giữ dạng thông báo giống Supabase để các chỗ bắt lỗi theo chữ vẫn chạy
  const err = new Error('Postgres ' + method + ' ' + path.split('?')[0] + ' -> ' + (e.code || '') + ' ' + e.message + (e.detail ? ' (' + e.detail + ')' : ''));
  err.code = e.code; return err;
}
async function rest(method, path, opt) {
  opt = opt || {};
  const r = phanTich(path); const T = qi(SCHEMA) + '.' + qi(r.bang);
  const where = r.where.length ? ' WHERE ' + r.where.join(' AND ') : '';
  try {
    if (method === 'GET') {
      let sql = 'SELECT ' + r.cot + ' FROM ' + T + where + (r.order ? ' ORDER BY ' + r.order : '');
      if (r.limit != null) sql += ' LIMIT ' + r.limit; if (r.offset) sql += ' OFFSET ' + r.offset;
      return await query(sql, r.P);
    }
    if (method === 'DELETE') return await query('DELETE FROM ' + T + where + ' RETURNING *', r.P);
    const ok = await cotGhi_(r.bang); if (!ok) throw new Error('Không có bảng ' + r.bang);
    // bỏ cột chỉ đọc / không có; '' vào cột số / ngày / bool -> null (cột mới có kiểu chặt hơn bảng cũ toàn text)
    const loc = function (o) { const x = {}; Object.keys(o || {}).forEach(function (k) { const c = ok[k]; if (c && c.ghi) x[k] = (o[k] === '' && !c.chu) ? null : o[k]; }); return x; };
    const val = function (v) { return (v !== null && typeof v === 'object' && !(v instanceof Date)) ? JSON.stringify(v) : v; };
    if (method === 'PATCH') {
      if (!r.where.length) throw new Error('Cập nhật không có điều kiện lọc — chặn để tránh sửa cả bảng');
      const b = loc(opt.body); const ks = Object.keys(b); if (!ks.length) return await query('SELECT * FROM ' + T + where, r.P);
      const P = r.P.slice(); const set = ks.map(function (k) { P.push(val(b[k])); return qi(k) + '=$' + P.length; }).join(',');
      return await query('UPDATE ' + T + ' SET ' + set + where + ' RETURNING *', P);
    }
    if (method === 'POST') {
      const rows = (Array.isArray(opt.body) ? opt.body : [opt.body]).map(loc); if (!rows.length) return [];
      const ks = []; rows.forEach(function (o) { Object.keys(o).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); }); });
      if (!ks.length) return await query('INSERT INTO ' + T + ' DEFAULT VALUES RETURNING *');
      const P = []; const vals = rows.map(function (o) { return '(' + ks.map(function (k) { if (!(k in o)) return 'DEFAULT'; P.push(val(o[k])); return '$' + P.length; }).join(',') + ')'; }).join(',');
      return await query('INSERT INTO ' + T + ' (' + ks.map(qi).join(',') + ') VALUES ' + vals + ' RETURNING *', P);
    }
    throw new Error('Phương thức ' + method + ' chưa hỗ trợ');
  } catch (e) { throw loiPG_(e, method, path); }
}
module.exports = { rest: rest, phanTich: phanTich, query: query, _reset: function () { ghiDuoc = null; } };
