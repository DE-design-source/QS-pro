'use strict';
/* BƯỚC 4 — Đối soát Supabase (bản chụp) ↔ Postgres docker: số dòng từng bảng (cũ = mới + cách ly) và vài tổng tiền / giá trị mẫu. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SNAP = path.join(__dirname, '..', '..', 'export', 'supa-snapshot');
const AUTO = require('./mapping.auto.json');
function pg(sql) { return cp.execFileSync('docker', ['exec', '-i', 'qspro-db', 'psql', '-U', 'qspro', '-d', 'qspro', '-Atq', '-c', sql]).toString().trim(); }
function cu(t) { return JSON.parse(fs.readFileSync(path.join(SNAP, t + '.json'), 'utf8')); }
const cl = {}; pg("select table_name||'='||count(*) from quarantine.etl_rejects group by table_name").split('\n').filter(Boolean).forEach(function (x) { const a = x.split('='); cl[a[0]] = +a[1]; });
let sai = 0;
Object.keys(AUTO).concat(['product_switch_socket_specs']).forEach(function (t) {
  if (/_specs$/.test(t)) return;
  const nMoi = +pg('select count(*) from public.' + t), nCu = cu(AUTO[t].from).length, c = cl[t] || 0, ok = nMoi + c === nCu;
  if (!ok) sai++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + (AUTO[t].from + ' -> ' + t).padEnd(46) + 'Supabase ' + String(nCu).padStart(5) + ' = Postgres ' + String(nMoi).padStart(5) + (c ? ' + cách ly ' + c : ''));
});
function tong(arr, k) { return arr.reduce(function (a, r) { return a + (Number(r[k]) || 0); }, 0); }
const ban = cu('db_bao_gia'), loai = pg("select coalesce(string_agg((row_data->>'id'),','),'') from quarantine.etl_rejects where table_name='quotation_lines'").split(',').filter(Boolean).map(Number);
const thanhTien = tong(ban.filter(function (r) { return loai.indexOf(r.id) < 0; }), 'thanh_tien');
const kiem = [
  ['Tổng thành tiền báo giá', thanhTien, +pg('select sum(amount) from quotation_lines')],
  ['Tổng giá bán lẻ sản phẩm', tong(cu('db_san_pham'), 'gia_ban_le'), +pg('select sum(retail_price) from products')],
  ['Tổng giá đại lý (tự tính lại)', tong(cu('db_san_pham'), 'gia_dai_ly'), +pg('select sum(dealer_price) from products')],
  ['Tổng tiền đơn mua hàng', tong(cu('don_mua_hang'), 'tong_cong'), +pg('select sum(total_amount) from purchase_orders')],
  ['Tổng chi phí tờ bìa', tong(cu('khai_toan'), 'chi_phi'), +pg('select sum(cost) from cost_estimate_lines')]];
kiem.forEach(function (k) { const ok = Math.abs(k[1] - k[2]) < 1; if (!ok) sai++; console.log((ok ? '  ✓ ' : '  ✗ ') + k[0].padEnd(34) + Math.round(k[1]).toLocaleString('vi-VN') + ' / ' + Math.round(k[2]).toLocaleString('vi-VN')); });
console.log(sai ? '\n' + sai + ' mục LỆCH' : '\nKhớp toàn bộ.');
