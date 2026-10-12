'use strict';
/************************************************************
 * Tầng truy cập dữ liệu — PostgreSQL trực tiếp (thư viện pg).
 *
 * Giữ NGUYÊN giao diện của client Supabase REST cũ (select / insert / update / remove / eq,
 * chuỗi lọc kiểu PostgREST 'cot=eq.x&cot2=in.(1,2)') nên phần còn lại của server không phải sửa.
 *
 * Database dùng tên bảng / cột TIẾNG ANH; code vẫn gọi tên tiếng Việt cũ. File db-map.json
 * là bảng đối chiếu: tầng này dịch tên khi gửi truy vấn và dịch ngược khi trả kết quả.
 *
 * Kết nối: biến môi trường DATABASE_URL (vd postgresql://user:pass@host:5432/db).
 * Riêng FILE (ảnh, tài liệu) vẫn tải lên Supabase Storage — xem uploadToStorage().
 ************************************************************/
require('dotenv').config();
const { Pool } = require('pg');
const MAP = require('./db-map.json');
const tenant = require('./tenant');

const DB_URL = process.env.DATABASE_URL || '';
let _pool = null;
function pool() {
  if (!DB_URL) throw new Error('Chưa cấu hình DATABASE_URL (chuỗi kết nối PostgreSQL) trong file .env');
  if (!_pool) {
    // timezone=UTC để timestamptz trả ra dạng ...+00:00 như trước
    _pool = new Pool({ connectionString: DB_URL, options: '-c timezone=UTC', max: Number(process.env.DB_POOL_MAX) || 10 });
    _pool.on('error', function (e) { console.error('Mất kết nối PostgreSQL:', e.message); });
  }
  return _pool;
}
async function close() { if (_pool) { const p = _pool; _pool = null; await p.end(); } }

// Các bảng thuộc về 1 CÔNG TY -> mọi truy vấn tự động lọc theo công ty đang đăng nhập.
// Làm ở tầng này để KHÔNG SÓT chỗ nào (an toàn hơn nhớ thêm filter ở từng hàm).
const TENANT_TABLES = {
  du_an: 1, db_bao_gia: 1, khai_toan: 1, db_san_pham: 1, db_san_pham_history: 1,
  don_mua_hang: 1, chi_tiet_mua_hang: 1, notifications: 1, delete_requests: 1,
  audit_log: 1, users: 1, sp_combo: 1, sp_yeu_thich: 1, cong_tac: 1,
  de_xuat: 1, chi_tiet_de_xuat: 1, cong_tac_history: 1,
  du_an_data: 1
};
// Người đăng nhập KHÔNG phải super mà không có công ty (token cũ / tài khoản bị gỡ công ty)
// -> chặn, KHÔNG được rơi về "xem toàn hệ thống" như trước.
function assertTenant_() {
  const role = tenant.ctx().role;
  if (role && role !== 'super' && !tenant.scoped()) throw new Error('Tài khoản chưa gắn với công ty nào');
}
function tenantFilter_(table, opt) {
  if ((opt && opt.noScope) || !TENANT_TABLES[table]) return '';
  assertTenant_();
  if (!tenant.scoped()) return '';                       // login / super admin xem toàn hệ thống
  return 'cong_ty_id=eq.' + encodeURIComponent(tenant.tenantId());
}
function withScope_(table, filter, opt) {
  const t = tenantFilter_(table, opt);
  if (!t) return filter || '';
  return filter ? (filter + '&' + t) : t;
}

function ok() { return !!DB_URL; }

// ───────────── Lỗi: giữ dạng thông báo của PostgREST vì code phía trên nhận biết lỗi theo mã / chuỗi ─────────────
function dbError_(method, table, status, code, message, extra) {
  const body = { code: code, details: (extra && extra.detail) || null, hint: (extra && extra.hint) || null, message: message };
  const e = new Error('DB ' + method + ' ' + table + ' -> ' + status + ' ' + JSON.stringify(body));
  e.code = code; e.status = status;
  return e;
}
function wrapPg_(method, table, e) {
  if (!e || !e.code || e.status) return e;               // lỗi đã bọc / lỗi mạng: giữ nguyên
  const st = /^23/.test(e.code) ? 409 : e.code === '42501' ? 401 : e.code === '42P01' ? 404 : 400;
  return dbError_(method, table, st, e.code, e.message, e);
}

// ───────────── Danh mục bảng / cột thật trong database + đối chiếu tên ─────────────
let _cat = null, _catAt = 0, _catLoading = null, _collate = '';
const SORT_COLLATION = process.env.DB_SORT_COLLATION || 'en-US-x-icu';
async function loadCatalog_() {
  const r = await pool().query(
    "select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position");
  const real = {}, isText = {};
  r.rows.forEach(function (x) {
    (real[x.table_name] = real[x.table_name] || []).push(x.column_name);
    if (x.data_type === 'text' || x.data_type === 'character varying') isText[x.table_name + '.' + x.column_name] = 1;
  });
  // Sắp xếp chữ có dấu theo ngôn ngữ (như Supabase), không phụ thuộc locale lúc tạo database.
  // Database không có collation ICU này thì sắp theo mặc định của database.
  const cl = await pool().query('select 1 from pg_collation where collname = $1 limit 1', [SORT_COLLATION]);
  _collate = cl.rows.length ? ' collate ' + q(SORT_COLLATION) : '';
  const cat = {};
  function add(viTable, enTable, v2eMap) {
    if (!real[enTable]) return;
    const e2v = {}; Object.keys(v2eMap).forEach(function (v) { e2v[v2eMap[v]] = v; });
    const t = { vi: viTable, en: enTable, v2e: {}, cols: [], text: {} };
    real[enTable].forEach(function (en) {                // cột chưa có trong db-map.json: dùng nguyên tên
      const vi = e2v[en] || en;
      t.v2e[vi] = en; t.cols.push(vi);
      if (isText[enTable + '.' + en]) t.text[vi] = 1;
    });
    cat[viTable] = t;
  }
  Object.keys(MAP).forEach(function (vi) { add(vi, MAP[vi].table, MAP[vi].columns); });
  Object.keys(real).forEach(function (en) { if (!cat[en]) add(en, en, {}); });   // bảng ngoài db-map.json
  _cat = cat; _catAt = Date.now();
  return cat;
}
async function catalog_(fresh) {
  if (_cat && !fresh) return _cat;
  if (_cat && fresh && Date.now() - _catAt < 3000) return _cat;   // vừa nạp xong, không nạp dồn
  if (!_catLoading) _catLoading = loadCatalog_().finally(function () { _catLoading = null; });
  return _catLoading;
}
// Bảng / cột vừa thêm bằng migration lúc server đang chạy: nạp lại danh mục 1 lần rồi mới báo thiếu
async function table_(method, name) {
  let t = (await catalog_())[name];
  if (!t) t = (await catalog_(true))[name];
  if (!t) throw dbError_(method, name, 404, 'PGRST205', "Could not find the table 'public." + name + "' in the schema cache");
  return t;
}
async function ensureCols_(t, names) {
  if (names.every(function (c) { return t.v2e[c]; })) return t;
  return (await catalog_(true))[t.vi] || t;
}
const q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };

// ───────────── Dịch chuỗi lọc PostgREST -> SQL có tham số ─────────────
function decode_(s) { s = String(s).replace(/\+/g, ' '); try { return decodeURIComponent(s); } catch (e) { return s; } }
// tách theo dấu phẩy ở mức ngoài cùng (bỏ qua dấu phẩy trong "..." và trong ngoặc)
function splitTop_(s) {
  const out = []; let cur = '', depth = 0, inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) { cur += ch; if (ch === '\\' && i + 1 < s.length) cur += s[++i]; else if (ch === '"') inQ = false; continue; }
    if (ch === '"') { inQ = true; cur += ch; continue; }
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function unquote_(v) { return /^"[\s\S]*"$/.test(v) && v.length >= 2 ? v.slice(1, -1).replace(/\\([\s\S])/g, '$1') : v; }
const CMP = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };

function makeWhere_(method, t, filter, params) {
  function col(name) {
    const en = t.v2e[name];
    if (!en) throw dbError_(method, t.vi, 400, '42703', 'column ' + t.vi + '.' + name + ' does not exist');
    return '_t.' + q(en);
  }
  function bad(what) { return dbError_(method, t.vi, 400, 'PGRST100', 'Bộ lọc không hỗ trợ: ' + what); }
  // name = tên cột, expr = '[not.]op.value'; quoted = giá trị có thể bọc "..." (bên trong and()/or())
  function cond(name, expr, quoted) {
    const m = /^(not\.)?([a-z]+)\.([\s\S]*)$/.exec(expr);
    if (!m) throw bad(name + '=' + expr);
    const neg = !!m[1], op = m[2]; let val = m[3], sql;
    if (op === 'is') {
      const v = val.toLowerCase();
      if (v === 'null') sql = col(name) + ' is null';
      else if (v === 'true' || v === 'false') sql = col(name) + ' is ' + v;
      else throw bad(name + '=' + expr);
    } else if (op === 'in') {
      const mm = /^\(([\s\S]*)\)$/.exec(val);
      if (!mm) throw bad(name + '=' + expr);
      const list = mm[1] === '' ? [] : splitTop_(mm[1]).map(unquote_);
      if (!list.length) sql = 'false';
      else { params.push(list); sql = col(name) + ' = any($' + params.length + ')'; }
    } else if (CMP[op]) {
      if (quoted) val = unquote_(val);
      if (op === 'like' || op === 'ilike') val = val.replace(/\*/g, '%');
      params.push(val);
      sql = col(name) + ' ' + CMP[op] + ' $' + params.length;
    } else throw bad(name + '=' + expr);
    return neg ? 'not (' + sql + ')' : sql;
  }
  // 1 phần tử trong and(...) / or(...):  cot.op.giatri  |  and(...)  |  or(...)  |  not.and(...)
  function node(item) {
    item = item.trim();
    const g = /^(not\.)?(and|or)\(([\s\S]*)\)$/.exec(item);
    if (g) return (g[1] ? 'not ' : '') + group(g[2], g[3]);
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\.([\s\S]*)$/.exec(item);
    if (!m) throw bad(item);
    return cond(m[1], m[2], true);
  }
  function group(kind, inner) {
    const parts = splitTop_(inner).filter(function (x) { return x.trim() !== ''; }).map(node);
    if (!parts.length) throw bad(kind + '()');
    return '(' + parts.join(' ' + kind + ' ') + ')';
  }
  const out = [];
  String(filter || '').split('&').forEach(function (pair) {
    if (!pair) return;
    const i = pair.indexOf('=');
    if (i < 0) throw bad(pair);
    const k = decode_(pair.slice(0, i)), v = decode_(pair.slice(i + 1));
    const g = /^(not\.)?(and|or)$/.exec(k);
    if (g) {
      const mm = /^\(([\s\S]*)\)$/.exec(v);
      if (!mm) throw bad(pair);
      out.push((g[1] ? 'not ' : '') + group(g[2], mm[1]));
    } else out.push(cond(k, v, false));
  });
  return out.length ? ' where ' + out.join(' and ') : '';
}
function makeOrder_(method, t, order) {
  if (!order) return '';
  return ' order by ' + String(order).split(',').map(function (part) {
    const p = part.trim().split('.'), en = t.v2e[p[0]];
    if (!en) throw dbError_(method, t.vi, 400, '42703', 'column ' + t.vi + '.' + p[0] + ' does not exist');
    let s = '_t.' + q(en) + (t.text[p[0]] ? _collate : '');
    p.slice(1).forEach(function (w) {
      if (w === 'asc' || w === 'desc') s += ' ' + w;
      else if (w === 'nullsfirst') s += ' nulls first';
      else if (w === 'nullslast') s += ' nulls last';
    });
    return s;
  }).join(', ');
}
// danh sách cột trả về, đặt bí danh về tên tiếng Việt: src."name" as "ten"
function outList_(method, t, select, src) {
  const names = (!select || select === '*') ? t.cols : String(select).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  return names.map(function (n) {
    if (!t.v2e[n]) throw dbError_(method, t.vi, 400, '42703', 'column ' + t.vi + '.' + n + ' does not exist');
    return src + '.' + q(t.v2e[n]) + ' as ' + q(n);
  }).join(', ');
}
// đổi khoá của dòng dữ liệu sang tên cột tiếng Anh; cột lạ -> báo như PostgREST (code phía trên tự bỏ cột rồi ghi lại)
function toEn_(method, t, row) {
  const o = {};
  Object.keys(row).forEach(function (k) {
    if (!t.v2e[k]) throw dbError_(method, t.vi, 400, 'PGRST204', "Could not find the '" + k + "' column of '" + t.vi + "' in the schema cache");
    o[t.v2e[k]] = row[k];
  });
  return o;
}
// Kết quả lấy dưới dạng JSON do chính Postgres dựng -> kiểu dữ liệu y hệt PostgREST
// (số là số, timestamptz là chuỗi ISO, jsonb là object) — không qua bộ đổi kiểu của thư viện pg.
async function run_(method, t, sql, params) {
  try {
    const r = await pool().query(sql, params);
    const j = r.rows[0] && r.rows[0].j;
    return j ? JSON.parse(j) : [];
  } catch (e) { throw wrapPg_(method, t.vi, e); }
}

// SELECT: table, {select, filter(chuỗi PostgREST vd 'ma_du_an=eq.X'), order, limit, noScope}
async function select(table, opt) {
  opt = opt || {};
  let t = await table_('GET', table);
  const selCols = (!opt.select || opt.select === '*') ? [] : String(opt.select).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  t = await ensureCols_(t, selCols);
  const params = [];
  const where = makeWhere_('GET', t, withScope_(table, opt.filter, opt), params);
  const lim = Number(opt.limit) || 0;
  // thêm id làm khoá phụ để thứ tự ổn định khi cột sắp xếp trùng giá trị
  let order = opt.order || '';
  if (order && t.v2e.id && !/(^|,)\s*id\./.test(order)) order += ',id.asc';
  const sql = "select coalesce(json_agg(x), '[]'::json)::text as j from (select " + outList_('GET', t, opt.select, '_t') +
    ' from ' + q(t.en) + ' _t' + where + makeOrder_('GET', t, order) + (lim ? ' limit ' + Math.floor(lim) : '') + ') x';
  return run_('GET', t, sql, params);
}
async function insert(table, rows, opt) {
  let arr = Array.isArray(rows) ? rows : [rows];
  if (!arr.length) return [];
  // Tự gắn công ty cho dòng mới (nếu bảng thuộc công ty và đang có ngữ cảnh)
  if (TENANT_TABLES[table] && !(opt && opt.noScope)) assertTenant_();
  if (TENANT_TABLES[table] && !(opt && opt.noScope) && tenant.scoped()) {
    const ct = tenant.tenantId();
    arr = arr.map(function (r) { return r.cong_ty_id ? r : Object.assign({}, r, { cong_ty_id: ct }); });
  }
  let t = await table_('POST', table);
  const keys = [];
  arr.forEach(function (r) { Object.keys(r).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
  t = await ensureCols_(t, keys);
  const body = arr.map(function (r) { return toEn_('POST', t, r); });
  const cols = keys.map(function (k) { return q(t.v2e[k]); }).join(', ');
  // json_populate_recordset: Postgres tự ép kiểu từng giá trị theo kiểu cột (đúng cách PostgREST làm).
  // Chỉ ghi các cột có trong dữ liệu gửi lên -> cột còn lại nhận giá trị mặc định.
  if (!keys.length) {                                    // dòng rỗng {}: mọi cột lấy mặc định
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      out.push.apply(out, await run_('POST', t, 'with w as (insert into ' + q(t.en) + ' default values returning *) ' +
        "select coalesce(json_agg(x), '[]'::json)::text as j from (select " + outList_('POST', t, '*', 'w') + ' from w) x', []));
    }
    return out;
  }
  const sql = 'with w as (insert into ' + q(t.en) + ' (' + cols + ') select ' + cols + ' from json_populate_recordset(null::' + q(t.en) + ', $1::json) returning *) ' +
    "select coalesce(json_agg(x), '[]'::json)::text as j from (select " + outList_('POST', t, '*', 'w') + ' from w) x';
  return run_('POST', t, sql, [JSON.stringify(body)]);
}
async function update(table, filter, patch, opt) {
  let t = await table_('PATCH', table);
  const keys = Object.keys(patch || {});
  if (!keys.length) return [];
  t = await ensureCols_(t, keys);
  const body = toEn_('PATCH', t, patch);
  const params = [JSON.stringify(body)];
  const where = makeWhere_('PATCH', t, withScope_(table, filter, opt), params);
  if (!where) throw dbError_('PATCH', table, 400, 'PGRST100', 'Từ chối UPDATE không có điều kiện lọc');
  const sql = 'with w as (update ' + q(t.en) + ' _t set ' +
    keys.map(function (k) { return q(t.v2e[k]) + ' = _p.' + q(t.v2e[k]); }).join(', ') +
    ' from json_populate_record(null::' + q(t.en) + ', $1::json) _p' + where + ' returning _t.*) ' +
    "select coalesce(json_agg(x), '[]'::json)::text as j from (select " + outList_('PATCH', t, '*', 'w') + ' from w) x';
  return run_('PATCH', t, sql, params);
}
async function remove(table, filter, opt) {
  const t = await table_('DELETE', table);
  const params = [];
  const where = makeWhere_('DELETE', t, withScope_(table, filter, opt), params);
  if (!where) throw dbError_('DELETE', table, 400, 'PGRST100', 'Từ chối DELETE không có điều kiện lọc');
  const sql = 'with w as (delete from ' + q(t.en) + ' _t' + where + ' returning _t.*) ' +
    "select coalesce(json_agg(x), '[]'::json)::text as j from (select " + outList_('DELETE', t, '*', 'w') + ' from w) x';
  return run_('DELETE', t, sql, params);
}

// ───────────── Kho FILE: vẫn là Supabase Storage (ảnh / tài liệu đã tải lên đều nằm ở đó) ─────────────
// Publishable key — công khai, chỉ dùng cho Storage. Đổi project: SUPABASE_URL_OVERRIDE / SUPABASE_KEY_OVERRIDE.
const STORAGE_URL = (process.env.SUPABASE_URL_OVERRIDE || 'https://xcjnpjpkmwhekkabpjzw.supabase.co').replace(/\/+$/, '');
const STORAGE_KEY = process.env.SUPABASE_KEY_OVERRIDE || 'sb_publishable_Am7BKsK-MM3at1Gv34iY0g_bHJopSsV';
const BUCKET = process.env.SUPABASE_BUCKET || 'products';
// Upload ảnh (buffer) lên Storage -> trả public URL
async function uploadToStorage(buffer, path, contentType) {
  const res = await fetch(STORAGE_URL + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(path), {
    method: 'POST',
    headers: { apikey: STORAGE_KEY, Authorization: 'Bearer ' + STORAGE_KEY, 'Content-Type': contentType || 'image/jpeg', 'x-upsert': 'true' },
    body: buffer
  });
  if (res.status >= 400) throw new Error('Storage upload -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return STORAGE_URL + '/storage/v1/object/public/' + BUCKET + '/' + encodeURIComponent(path);
}
// escape giá trị cho filter eq.
function eq(col, val) { return col + '=eq.' + encodeURIComponent(val); }

module.exports = { ok, TENANT_TABLES, select, insert, update, remove, uploadToStorage, eq, close, _url: STORAGE_URL, _bucket: BUCKET };
