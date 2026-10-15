'use strict';
/* BƯỚC 1 — Chụp TOÀN BỘ dữ liệu Supabase hiện tại ra export/supa-snapshot/<bảng>.json (CHỈ ĐỌC).
   Danh sách bảng: mọi bảng app đang dùng (khoá công khai không liệt kê được bảng).
   Chạy: node scripts/supa-to-pg/fetch.js                                                         */
require('dotenv').config();
const fs = require('fs'), path = require('path');
const URL = (process.env.SUPABASE_URL_OVERRIDE || 'https://xcjnpjpkmwhekkabpjzw.supabase.co').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_KEY_OVERRIDE || 'sb_publishable_Am7BKsK-MM3at1Gv34iY0g_bHJopSsV';
const OUT = path.join(__dirname, '..', '..', 'export', 'supa-snapshot');
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
async function get(p, extra) { const r = await fetch(URL + '/rest/v1/' + p, { headers: Object.assign({}, H, extra || {}) }); const t = await r.text(); if (r.status >= 400) throw new Error(p + ' -> ' + r.status + ' ' + t.slice(0, 200)); return { body: t ? JSON.parse(t) : null, headers: r.headers }; }
(async function () {
  fs.mkdirSync(OUT, { recursive: true });
  // Khoá công khai không đọc được OpenAPI (cần secret key) -> danh sách CỐ ĐỊNH = mọi bảng app đang đọc / ghi (server/*.js)
  const tables = ['audit_log', 'chi_tiet_de_xuat', 'chi_tiet_mua_hang', 'cong_tac', 'cong_tac_history', 'cong_ty', 'db_bao_gia', 'db_san_pham',
    'db_san_pham_history', 'de_xuat', 'delete_requests', 'don_mua_hang', 'du_an', 'du_an_data', 'khai_toan', 'notifications', 'sp_combo', 'sp_yeu_thich', 'users'];
  const tong = {};
  for (const t of tables) {
    const rows = [];
    for (let off = 0; ; off += 1000) {
      const r = await get(t + '?select=*', { Range: off + '-' + (off + 999), 'Range-Unit': 'items' });
      rows.push.apply(rows, r.body || []);
      if (!r.body || r.body.length < 1000) break;
    }
    fs.writeFileSync(path.join(OUT, t + '.json'), JSON.stringify(rows));
    tong[t] = rows.length;
  }
  fs.writeFileSync(path.join(OUT, '_meta.json'), JSON.stringify({ at: new Date().toISOString(), url: URL, counts: tong }, null, 1));
  console.log('Đã chụp', tables.length, 'bảng ->', OUT); Object.keys(tong).forEach(function (t) { console.log('  ' + t.padEnd(28) + tong[t]); });
})().catch(function (e) { console.error('LỖI', e.message); process.exit(1); });
