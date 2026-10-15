'use strict';
/* Chép mô tả API của bản Node sang bản Go (được nhúng vào file chạy):
 *   server/api-docs.json  -> internal/server/apidocs/api-docs.json  (chép nguyên từng byte)
 *   server/index.js       -> internal/server/apidocs/meta.json      (thứ tự hàm trong REGISTRY + version của package.json)
 * Chỉ ĐỌC mã nguồn dạng chữ, không require server/index.js. Chạy: node backend/scripts/sync-api-docs.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, '..', 'internal', 'server', 'apidocs');

const src = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
const m = src.match(/const REGISTRY = \{([\s\S]*?)\n\};/);
if (!m) throw new Error('Không tìm thấy REGISTRY trong server/index.js');
const body = m[1].replace(/\/\/.*$/gm, '');
const order = [];
const re = /^\s*([A-Za-z_$][\w$]*)\s*:/gm;
let x;
while ((x = re.exec(body))) order.push(x[1]);

fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(root, 'server', 'api-docs.json'), path.join(out, 'api-docs.json'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ version: version, order: order }, null, 1) + '\n');
console.log('Đã chép api-docs.json (' + Object.keys(JSON.parse(fs.readFileSync(path.join(out, 'api-docs.json'), 'utf8'))).length +
  ' hàm có mô tả) và meta.json (' + order.length + ' hàm, version ' + version + ')');
