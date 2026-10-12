'use strict';
/* Chép TOÀN BỘ dữ liệu từ Supabase (REST, chỉ đọc) sang PostgreSQL ở DATABASE_URL.
   Dùng 1 lần lúc chuyển hệ thống (hoặc chạy lại để lấy dữ liệu mới nhất trước khi cắt hẳn Supabase).
   CẢNH BÁO: XOÁ SẠCH dữ liệu các bảng ở database đích rồi nạp lại -> phải thêm --yes.
     node scripts/sync-from-supabase.js --yes
   Đổi tên bảng / cột theo server/db-map.json. Cả quá trình nằm trong 1 transaction: lỗi là huỷ hết. */
require('dotenv').config();
const { Pool } = require('pg');
const MAP = require('../server/db-map.json');

const SRC = (process.env.SUPABASE_URL_OVERRIDE || 'https://xcjnpjpkmwhekkabpjzw.supabase.co').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_KEY_OVERRIDE || 'sb_publishable_Am7BKsK-MM3at1Gv34iY0g_bHJopSsV';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

async function fetchAll(table, orderCols) {
  const order = orderCols.map((c) => c + '.asc').join(',');
  let rows = [];
  for (let off = 0; ; off += 1000) {
    const res = await fetch(SRC + '/rest/v1/' + table + '?select=*&order=' + order + '&limit=1000&offset=' + off, { headers: H });
    const txt = await res.text();
    if (res.status >= 400) throw new Error('Supabase ' + table + ' -> ' + res.status + ' ' + txt.slice(0, 200));
    const page = JSON.parse(txt);
    rows = rows.concat(page);
    if (page.length < 1000) break;
  }
  return rows;
}

(async function () {
  if (process.argv.indexOf('--yes') < 0) { console.error('Lệnh này XOÁ dữ liệu ở database đích rồi nạp lại từ Supabase. Thêm --yes để chạy.'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('Thiếu DATABASE_URL trong .env'); process.exit(2); }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' });
  const db = await pool.connect();
  try {
    const real = {};
    (await db.query("select table_name, column_name from information_schema.columns where table_schema='public'")).rows
      .forEach((r) => { (real[r.table_name] = real[r.table_name] || {})[r.column_name] = 1; });
    const pk = {};
    (await db.query("select c.relname t, a.attname c from pg_index i join pg_class c on c.oid=i.indrelid join pg_attribute a on a.attrelid=c.oid and a.attnum=any(i.indkey) where i.indisprimary and c.relnamespace='public'::regnamespace"))
      .rows.forEach((r) => { (pk[r.t] = pk[r.t] || []).push(r.c); });
    // thứ tự nạp: bảng cha trước bảng con (theo khoá ngoại)
    const deps = {};
    (await db.query("select conrelid::regclass::text child, confrelid::regclass::text parent from pg_constraint where contype='f' and connamespace='public'::regnamespace"))
      .rows.forEach((r) => { if (r.child !== r.parent) (deps[r.child] = deps[r.child] || new Set()).add(r.parent); });
    const tables = Object.keys(MAP).filter((vi) => real[MAP[vi].table]);
    const done = new Set(), ordered = [];
    while (ordered.length < tables.length) {
      const next = tables.filter((vi) => !done.has(MAP[vi].table) && [...(deps[MAP[vi].table] || [])].every((p) => done.has(p)));
      if (!next.length) throw new Error('Khoá ngoại vòng tròn, không xếp được thứ tự nạp');
      next.forEach((vi) => { done.add(MAP[vi].table); ordered.push(vi); });
    }

    // 1) tải hết về trước, rồi mới đụng tới database đích
    const data = {};
    for (const vi of ordered) {
      const m = MAP[vi], e2v = {}; Object.keys(m.columns).forEach((v) => { e2v[m.columns[v]] = v; });
      const rows = await fetchAll(vi, (pk[m.table] || ['id']).map((c) => e2v[c] || c));
      const la = new Set();
      data[vi] = rows.map((r) => { const o = {}; Object.keys(r).forEach((k) => { const en = m.columns[k] || k; if (real[m.table][en]) o[en] = r[k]; else la.add(k); }); return o; });
      if (la.size) console.log('  ! ' + vi + ': bỏ qua cột chưa có ở database đích: ' + [...la].join(', '));
      console.log('tải ' + vi.padEnd(22) + rows.length + ' dòng');
    }

    // 2) nạp
    await db.query('begin');
    await db.query('truncate ' + ordered.map((vi) => q(MAP[vi].table)).join(', ') + ' restart identity cascade');
    for (const vi of ordered) {
      const en = MAP[vi].table, rows = data[vi];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]).map(q).join(', ');
      for (let i = 0; i < rows.length; i += 500) {
        try {
          await db.query('insert into ' + q(en) + ' (' + cols + ') select ' + cols + ' from json_populate_recordset(null::' + q(en) + ', $1::json)', [JSON.stringify(rows.slice(i, i + 500))]);
        } catch (e) { throw new Error(vi + ' -> ' + en + ': ' + e.message + (e.detail ? ' | ' + e.detail : '')); }
      }
    }
    // bộ đếm id tự tăng: đặt về sau id lớn nhất
    const idc = (await db.query("select table_name t, column_name c from information_schema.columns where table_schema='public' and is_identity='YES'")).rows;
    for (const r of idc) await db.query("select setval(pg_get_serial_sequence($1, $2), coalesce((select max(" + q(r.c) + ') from ' + q(r.t) + '), 0) + 1, false)', [r.t, r.c]);
    await db.query('commit');
    console.log('XONG: đã nạp ' + ordered.length + ' bảng, ' + ordered.reduce((s, vi) => s + data[vi].length, 0) + ' dòng.');
  } catch (e) {
    try { await db.query('rollback'); } catch (x) { /* chưa mở transaction */ }
    console.error('LỖI — đã huỷ, database đích giữ nguyên như trước:\n  ' + e.message);
    process.exitCode = 1;
  } finally { db.release(); await pool.end(); }
})();
