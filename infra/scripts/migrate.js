'use strict';
/* Chạy migration PostgreSQL theo thứ tự số trong infra/db/migrations/NNNN_ten.sql.
     node infra/scripts/migrate.js              chạy các file chưa áp dụng (mỗi file 1 transaction)
     node infra/scripts/migrate.js --status     chỉ liệt kê
     node infra/scripts/migrate.js --baseline   đánh dấu MỌI file là đã áp dụng mà không chạy
                                          (dùng cho database dựng từ infra/db/schema.sql)
   Database đích: DATABASE_URL trong .env, hoặc --url=postgresql://...
   File đã áp dụng mà bị sửa nội dung -> từ chối chạy (lệch checksum). Sai thì viết file mới.
   CHÚ Ý: lệnh chạy thẳng trên database ở DATABASE_URL (dòng "Database:" in ra đầu tiên). Sao lưu trước khi chạy
   trên database có dữ liệu thật: một số migration xoá cột / bảng và chỉ quay lui được bằng bản sao lưu. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const DIR = path.join(__dirname, '..', 'db', 'migrations');
const arg = (name) => process.argv.indexOf('--' + name) >= 0;
const urlArg = process.argv.find((a) => a.indexOf('--url=') === 0);
const URL = urlArg ? urlArg.slice(6) : process.env.DATABASE_URL;

function files() {
  return fs.readdirSync(DIR).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort().map((f) => {
    // bỏ khác biệt xuống dòng (CRLF/LF) để checksum không lệch giữa các máy
    const sql = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
    return { version: f.slice(0, 4), name: f.replace(/\.sql$/, ''), sql: sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
  });
}

async function run() {
  const la = process.argv.slice(2).filter((a) => ['--status', '--baseline'].indexOf(a) < 0 && a.indexOf('--url=') !== 0);
  if (la.length) throw new Error('Tham số không hợp lệ: ' + la.join(' ') + ' (chỉ nhận --status, --baseline, --url=...)');
  if (!URL) throw new Error('Thiếu DATABASE_URL (hoặc --url=...)');
  try { const u = new (require('url').URL)(URL); console.log('Database: ' + u.hostname + ':' + (u.port || 5432) + u.pathname); } catch (e) { /* URL lạ: bỏ qua dòng thông tin */ }
  const db = new Client({ connectionString: URL });
  await db.connect();
  try {
    await db.query('select pg_advisory_lock(7460123)');      // không cho 2 tiến trình migrate cùng lúc
    await db.query('create table if not exists schema_migrations (version text primary key, name text not null, checksum text not null, applied_at timestamptz not null default now())');
    const done = {};
    (await db.query('select version, name, checksum from schema_migrations')).rows.forEach((r) => { done[r.version] = r; });
    const list = files();
    list.forEach((f) => {
      if (done[f.version] && done[f.version].checksum !== f.checksum)
        throw new Error('File ' + f.name + '.sql đã áp dụng nhưng nội dung bị sửa. Không sửa migration cũ — hãy viết file mới.');
    });
    const pending = list.filter((f) => !done[f.version]);
    if (arg('status')) {
      list.forEach((f) => console.log((done[f.version] ? 'đã chạy ' : 'CHƯA    ') + f.name));
      return;
    }
    for (const f of pending) {
      if (arg('baseline')) {
        await db.query('insert into schema_migrations (version, name, checksum) values ($1, $2, $3)', [f.version, f.name, f.checksum]);
        console.log('đánh dấu  ' + f.name);
        continue;
      }
      await db.query('begin');
      try {
        await db.query(f.sql);
        await db.query('insert into schema_migrations (version, name, checksum) values ($1, $2, $3)', [f.version, f.name, f.checksum]);
        await db.query('commit');
        console.log('đã chạy   ' + f.name);
      } catch (e) {
        await db.query('rollback');
        throw new Error(f.name + ': ' + e.message + (e.detail ? ' | ' + e.detail : '') + (e.where ? ' | ' + String(e.where).split('\n')[0] : ''));
      }
    }
    if (!pending.length) console.log('Không có migration mới.');
    else if (!arg('baseline')) console.log('Đã đổi cấu trúc database: hãy KHỞI ĐỘNG LẠI server (npm start) để nạp lại danh mục bảng / cột.');
    // view product_catalog chốt danh sách cột lúc tạo: thêm cột vào products / product_*_specs mà quên tạo lại view thì app không thấy cột
    const lech = (await db.query("select column_name c from information_schema.columns where table_schema = 'public' and (table_name = 'products' or (table_name like 'product\\_%\\_specs' and column_name <> 'product_id')) and exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'product_catalog') except select column_name from information_schema.columns where table_schema = 'public' and table_name = 'product_catalog'")).rows;
    if (lech.length) { console.error('CẢNH BÁO: view product_catalog thiếu cột ' + lech.map((r) => r.c).join(', ') + ' — viết migration DROP VIEW + CREATE VIEW lại.'); process.exitCode = 1; }
  } finally { await db.end(); }
}
run().catch((e) => { console.error('LỖI: ' + e.message); process.exit(1); });
