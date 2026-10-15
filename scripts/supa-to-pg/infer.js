'use strict';
/* BƯỚC 2 (một lần) — DÒ ánh xạ cột cũ (Supabase, tiếng Việt) -> cột mới (qspro_en2, tiếng Anh):
   ghép từng dòng theo khoá rồi xem cột mới nào trùng giá trị với cột cũ nào. In ra để viết map.js. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SNAP = path.join(__dirname, '..', '..', 'export', 'supa-snapshot');
function pg(sql) { return cp.execFileSync('docker', ['exec', '-i', 'qspro-db', 'psql', '-U', 'qspro', '-d', 'qspro', '-Atq', '-c', sql], { maxBuffer: 1 << 28 }).toString(); }
function moi(t) { const s = pg("select coalesce(json_agg(x),'[]') from public." + t + ' x'); return JSON.parse(s); }
function cu(t) { return JSON.parse(fs.readFileSync(path.join(SNAP, t + '.json'), 'utf8')); }
function chuan(v) { if (v == null || v === '') return null; if (typeof v === 'object') return JSON.stringify(v); let s = String(v).trim(); if (/^-?\d+(\.\d+)?$/.test(s)) s = String(Number(s)); if (/^\d{4}-\d\d-\d\dT/.test(s) || /^\d{4}-\d\d-\d\d \d/.test(s)) { const d = new Date(s.replace(' ', 'T')); if (!isNaN(d)) s = d.toISOString(); } return s; }
const CAP = [['users', 'users', 'id', 'id'], ['cong_ty', 'companies', 'id', 'id'], ['db_san_pham', 'products', 'id', 'id'],
  ['db_san_pham', 'product_lighting_specs', 'id', 'product_id'], ['db_san_pham', 'product_paint_specs', 'id', 'product_id'],
  ['db_san_pham', 'product_sanitary_specs', 'id', 'product_id'], ['sp_combo', 'product_combos', 'id', 'id'], ['sp_yeu_thich', 'favorite_products', 'id', 'id'],
  ['db_san_pham_history', 'product_histories', 'id', 'id'], ['audit_log', 'audit_logs', 'id', 'id'], ['notifications', 'notifications', 'id', 'id'],
  ['delete_requests', 'delete_requests', 'id', 'id'], ['du_an', 'projects', 'id', 'id'], ['du_an_data', 'project_data_entries', 'ma_da|khoa', 'project_code|data_key'],
  ['db_bao_gia', 'quotation_lines', 'id', 'id'], ['khai_toan', 'cost_estimate_lines', 'id', 'id'], ['don_mua_hang', 'purchase_orders', 'id', 'id'],
  ['chi_tiet_mua_hang', 'purchase_order_items', 'id', 'id'], ['de_xuat', 'purchase_proposals', 'id', 'id'], ['cong_tac', 'work_items', 'id', 'id'],
  ['cong_tac_history', 'work_item_histories', 'id', 'id']];
const kq = {};
CAP.forEach(function (c) {
  const A = cu(c[0]), B = moi(c[1]), kA = c[2].split('|'), kB = c[3].split('|');
  const byA = {}; A.forEach(function (r) { byA[kA.map(function (k) { return r[k]; }).join('|')] = r; });
  const cap = B.map(function (r) { return [byA[kB.map(function (k) { return r[k]; }).join('|')], r]; }).filter(function (x) { return x[0]; });
  const colsA = Object.keys(A[0] || {}), colsB = B.length ? Object.keys(B[0]) : [];
  const map = {}, khong = [];
  colsB.forEach(function (cb) {
    const co = cap.filter(function (x) { return chuan(x[1][cb]) != null; });
    if (!co.length) { khong.push(cb + '(trống)'); return; }
    let best = null, bestN = 0;
    colsA.forEach(function (ca) { const n = co.filter(function (x) { return chuan(x[0][ca]) === chuan(x[1][cb]); }).length; if (n > bestN) { bestN = n; best = ca; } });
    if (best && bestN / co.length >= 0.9) map[cb] = best + (bestN < co.length ? ' (' + bestN + '/' + co.length + ')' : '');
    else khong.push(cb + (best ? '?~' + best + ' ' + bestN + '/' + co.length : '?'));
  });
  const dung = Object.keys(map).map(function (k) { return map[k].split(' ')[0]; });
  kq[c[1]] = { tu: c[0], ghep: cap.length + '/' + B.length + ' (cũ ' + A.length + ')', map: map, chuaRo: khong, cotCuChuaDung: colsA.filter(function (a) { return dung.indexOf(a) < 0; }) };
});
fs.writeFileSync(path.join(SNAP, '_map_do.json'), JSON.stringify(kq, null, 1));
Object.keys(kq).forEach(function (t) { const x = kq[t]; console.log('\n## ' + x.tu + ' -> ' + t + '  ghép ' + x.ghep);
  console.log('  map: ' + Object.keys(x.map).map(function (k) { return k + '=' + x.map[k]; }).join(', '));
  if (x.chuaRo.length) console.log('  CHƯA RÕ: ' + x.chuaRo.join(', '));
  if (x.cotCuChuaDung.length) console.log('  cột cũ chưa dùng: ' + x.cotCuChuaDung.join(', ')); });
