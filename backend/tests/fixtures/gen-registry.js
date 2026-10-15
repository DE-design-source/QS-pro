'use strict';
/* Sinh tests/fixtures/registry.json: danh sách hàm /api/:fn và quyền của bản Node, đọc từ CHỮ của server/index.js
 * (không require file đó). Test TestRegistryParity của bản Go so registry Go với file này.
 * Kèm 9 route lẻ (app.get / app.post ngoài /api/:fn). Chạy: node backend/tests/fixtures/gen-registry.js */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'server', 'index.js'), 'utf8');

function names_(text) {
  const out = [];
  const re = /'([^']+)'/g;
  let x;
  while ((x = re.exec(text.replace(/\/\/.*$/gm, '')))) out.push(x[1]);
  return out;
}
function setOf_(ten) {
  const dau = 'const ' + ten + ' = new Set([';
  const i = src.indexOf(dau);
  const j = src.indexOf(']);', i);
  if (i < 0 || j < 0) throw new Error('Không tìm thấy ' + ten);
  return names_(src.slice(i + dau.length, j));
}
const reg = src.match(/const REGISTRY = \{([\s\S]*?)\n\};/);
if (!reg) throw new Error('Không tìm thấy REGISTRY');
const names = [];
const re = /^\s*([A-Za-z_$][\w$]*)\s*:/gm;
const body = reg[1].replace(/\/\/.*$/gm, '');
let x;
while ((x = re.exec(body))) names.push(x[1]);

const routes = [];
const rr = /^app\.(get|post|put|patch|delete)\('([^']+)'/gm;
while ((x = rr.exec(src))) if (x[2] !== '/api/:fn') routes.push({ method: x[1].toUpperCase(), path: x[2] });

const data = { names: names, public: setOf_('PUBLIC_FNS'), actor: setOf_('ACTOR_FNS'), admin: setOf_('ADMIN_FNS'), super: setOf_('SUPER_FNS'), routes: routes };
fs.writeFileSync(path.join(__dirname, 'registry.json'), JSON.stringify(data, null, 1) + '\n');
console.log(names.length + ' hàm; public ' + data.public.length + ', actor ' + data.actor.length + ', admin ' + data.admin.length +
  ', super ' + data.super.length + '; ' + routes.length + ' route lẻ');
