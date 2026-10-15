'use strict';
/* Kiểm token + hash mật khẩu do bản Go sinh ra bằng mã Node thật (server/auth.js verifyToken, bcryptjs compareSync):
 *   1. docker exec -e INTEROP_OUT=/repo/backend/internal/modules/auth/testdata/.interop.json qspro-go \
 *        go test -count=1 -run TestInteropOut ./internal/modules/auth/
 *   2. AUTH_SECRET=zz-authusers-test-secret DATABASE_URL=...qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *      PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node interop-node.js .interop.json
 * Không truy vấn database. */
const fs = require('fs');
const path = require('path');
if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const auth = require(path.join(root, 'server', 'auth.js'));
const bcrypt = require(require.resolve('bcryptjs', { paths: [root] }));
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let bad = 0;
const p = auth.verifyToken(d.token);
const okTok = !!p && p.uid === d.user.id && p.u === d.user.username && p.r === d.user.role && p.ct === null && p.exp > Date.now();
console.log('token Go -> verifyToken Node:', okTok ? 'OK' : 'SAI', JSON.stringify(p));
if (!okTok) bad++;
d.hashes.forEach(function (h) {
  const ok = bcrypt.compareSync(h.pw, h.hash) && !bcrypt.compareSync(h.pw + 'x', h.hash.length && h.pw.length < 72 ? h.hash : '');
  console.log('hash Go -> compareSync Node:', ok ? 'OK' : 'SAI', h.hash.slice(0, 7), JSON.stringify(h.pw.slice(0, 12)));
  if (!ok) bad++;
});
process.exit(bad ? 1 : 0);
