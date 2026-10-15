'use strict';
/* Sinh giá trị mong đợi của các hàm THUẦN từ mã Node thật (server/auth.js):
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen.js > pure.json
 * Không truy vấn database (chỉ nạp module). */
const fs = require('fs');
const path = require('path');
const Module = require('module');
if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const file = path.join(root, 'server', 'auth.js');
const m = new Module(file, module);
m.filename = file;
m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(fs.readFileSync(file, 'utf8') + '\nmodule.exports.__t = { userOut, permsArr_, phongBanColErr_, permsColErr_ };', file);
const t = m.exports.__t;

const perms = [null, '', 'a', ' a , b ,, c ', ',,,', 0, 5, true, false, 'sp_edit,sp_duyet', ['x', ' y '], {}, '  a　,﻿b\t'];
const rows = [
  {},
  { id: 'u1', username: 'a', ho_ten: 'Tên', role: 'admin', perms: 'p1, p2', active: true, created_at: '2026-01-01T00:00:00+00:00', last_login: null, cong_ty_id: 'c1', email: 'e@x', phong_ban: 'QS' },
  { id: 7, username: null, ho_ten: null, role: null, perms: null, active: false, created_at: null, last_login: '2026-02-02T00:00:00+00:00', cong_ty_id: null, email: null, phong_ban: null },
  { id: 'u3', username: 'b', ho_ten: '', role: '', perms: '', active: null, cong_ty_id: '', email: '', phong_ban: '' },
  { id: 'u4', username: 'c', role: 'super', active: 0, cong_ty_id: 0, ui_prefs: { a: 1 }, password_hash: 'x' }
];
const limits = [null, 0, 1, 3, '2', 2.9, 0.5, -0.5, -1, 200, 1000, 1001, 99999, 'abc', '', true, false, [], [7], {}, '1e2', ' 12 ', -1000.5];
const lowers = ['Σ İ ΌΣΟΣ ÀÉ ǅ ß ẞ K Å', 'ABC_def-1.X', 'ĐẶNG VĂN', 'İ', 'ΑΣ', 'Σ', 'AΣB'];
const errs = [
  'DB POST users -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'phong_ban\' column of \'users\' in the schema cache"}',
  'DB POST users -> 400 {"code":"42703","details":null,"hint":null,"message":"column \\"phong_ban\\" of relation \\"users\\" does not exist"}',
  'DB PATCH users -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'perms\' column of \'users\' in the schema cache"}',
  'DB POST users -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"PGRST204 perms"}',
  'DB POST users -> 400 {"code":"42703","details":null,"hint":null,"message":"COLUMN perms missing"}',
  'DB POST users -> 409 {"code":"23505","details":null,"hint":null,"message":"duplicate key value"}',
  'phong_ban', 'perms', ''
];
const out = {
  permsArr: perms.map(function (v) { return [v, t.permsArr_(v)]; }),
  userOut: rows.map(function (r) { return [r, t.userOut(r)]; }),
  limit: limits.map(function (v) { const l = Math.min(Number(v) || 200, 1000); return [v, (Number(l) || 0) ? Math.floor(l) : null]; }),
  lower: lowers.map(function (v) { return [v, v.toLowerCase()]; }),
  colErr: errs.map(function (msg) { const e = new Error(msg); return [msg, t.phongBanColErr_(e), t.permsColErr_(e).message]; })
};
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
process.exit(0);
