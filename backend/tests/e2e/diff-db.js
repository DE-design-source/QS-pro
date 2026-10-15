'use strict';
/* So TRẠNG THÁI 2 database tạm sau khi chạy test-api-go.js trên Node và trên Go: từng bảng public, từng dòng (row_to_json),
   sau khi chuẩn hoá thứ vốn khác nhau giữa 2 lần chạy (UUID, mốc thời gian, mã sinh ngẫu nhiên, băm mật khẩu).
   Chạy: node backend/tests/e2e/diff-db.js <url qspro_nodetest> <url qspro_gotest>   Thoát mã 1 nếu có chỗ khác. */
const { Pool } = require('pg');
const urls = process.argv.slice(2);
if (urls.length !== 2 || !urls.every((u) => /\/(qspro_gotest|qspro_nodetest)$/.test(new URL(u).pathname))) { console.error('Chỉ so qspro_nodetest với qspro_gotest.'); process.exit(2); }
const norm = (s) => s
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
  .replace(/\b(DA|MH|CK|TT)-[0-9A-Z]{6,10}-[0-9A-Z]{4,12}\b/g, '$1-<MA>')
  .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g, '<TS>')
  .replace(/\b\d{1,2}:\d{2}(:\d{2})? \d{1,2}\/\d{1,2}\/\d{4}\b/g, '<TS>')
  .replace(/\$2[aby]\$\d\d\$[.\/A-Za-z0-9]{53}/g, '<BCRYPT>');
(async () => {
  const [a, b] = urls.map((u) => new Pool({ connectionString: u }));
  const tables = (await a.query("select table_name t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1")).rows.map((r) => r.t);
  let diff = 0;
  for (const t of tables) {
    const rows = async (p) => (await p.query('select row_to_json(x)::text j from public."' + t + '" x')).rows.map((r) => norm(r.j)).sort();
    let x, y; try { [x, y] = [await rows(a), await rows(b)]; } catch (e) { diff++; console.log(t + ': lỗi đọc ' + e.message); continue; }
    const cy = new Map(); y.forEach((r) => cy.set(r, (cy.get(r) || 0) + 1));
    const onlyA = []; x.forEach((r) => { const n = cy.get(r) || 0; if (n) cy.set(r, n - 1); else onlyA.push(r); });
    const onlyB = []; cy.forEach((n, r) => { for (let i = 0; i < n; i++) onlyB.push(r); });
    if (!onlyA.length && !onlyB.length) continue;
    diff++; console.log(t + ': ' + x.length + ' / ' + y.length + ' dòng, chỉ có ở A ' + onlyA.length + ', chỉ có ở B ' + onlyB.length);
    for (let i = 0; i < Math.min(3, Math.max(onlyA.length, onlyB.length)); i++) {
      const p = onlyA[i] || '', q = onlyB[i] || ''; let k = 0; while (k < p.length && p[k] === q[k]) k++;
      console.log('   A: ' + p.slice(Math.max(0, k - 120), k + 200)); console.log('   B: ' + q.slice(Math.max(0, k - 120), k + 200));
    }
  }
  console.log('Tổng: ' + tables.length + ' bảng, ' + diff + ' bảng khác');
  await a.end(); await b.end(); process.exit(diff ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
