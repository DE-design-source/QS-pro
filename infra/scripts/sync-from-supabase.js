'use strict';
/* Chép TOÀN BỘ dữ liệu từ Supabase (REST, chỉ đọc) sang một database PostgreSQL TRỐNG ở DATABASE_URL.
   Dùng lúc chuyển hệ thống (hoặc dựng lại một database mới với dữ liệu mới nhất trước khi cắt hẳn Supabase).
     node infra/scripts/sync-from-supabase.js --yes
   Các bước:  1) dựng schema gốc (infra/db/baseline.sql — 19 bảng như lúc mới đổi tên tiếng Anh)
              2) nạp dữ liệu Supabase, đổi tên theo infra/db/baseline-map.json (1 transaction: lỗi là huỷ hết)
              3) chạy toàn bộ migration (infra/scripts/migrate.js) để đưa về cấu trúc hiện hành
   Database đích phải TRỐNG (chưa có bảng). Muốn nạp lại: tạo database mới rồi trỏ DATABASE_URL sang. */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const MAP = require('../db/baseline-map.json');   // tên Supabase -> tên trong schema GỐC (trước migration)

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
  if (process.argv.indexOf('--yes') < 0) { console.error('Lệnh này dựng schema và nạp dữ liệu Supabase vào database TRỐNG ở DATABASE_URL. Thêm --yes để chạy.'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('Thiếu DATABASE_URL trong .env'); process.exit(2); }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' });
  const db = await pool.connect();
  try {
    const co = (await db.query("select count(*)::int n from information_schema.tables where table_schema = 'public'")).rows[0].n;
    if (co > 0) { console.error('Database đích đã có ' + co + ' bảng. Script này chỉ nạp vào database TRỐNG — hãy tạo database mới.'); process.exitCode = 2; return; }
    await db.query('begin');                               // dựng schema + nạp dữ liệu trong 1 transaction: lỗi là database vẫn trống
    await db.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'baseline.sql'), 'utf8'));
    await db.query("select set_config('search_path', 'public', false)");
    console.log('đã dựng schema gốc');
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
    console.log('đã nạp ' + ordered.length + ' bảng, ' + ordered.reduce((s, vi) => s + data[vi].length, 0) + ' dòng. Chạy migration...');
    const mg = spawnSync(process.execPath, [path.join(__dirname, 'migrate.js')], { stdio: 'inherit', env: process.env });
    if (mg.status !== 0) { console.error('Migration lỗi — dữ liệu đã nạp ở dạng schema gốc; sửa lỗi rồi chạy: node infra/scripts/migrate.js'); process.exitCode = 1; }
    else console.log('XONG.');
  } catch (e) {
    try { await db.query('rollback'); } catch (x) { /* chưa mở transaction */ }
    console.error('LỖI — đã huỷ, database đích vẫn trống:\n  ' + e.message);
    process.exitCode = 1;
  } finally { db.release(); await pool.end(); }
})();
