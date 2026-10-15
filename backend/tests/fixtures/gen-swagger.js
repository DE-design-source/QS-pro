'use strict';
/* Sinh tests/fixtures/swagger-node.json: spec do buildSpec của server/swagger.js dựng ra (bản Node thật),
 * với REGISTRY / *_FNS lấy từ registry.json. Test TestSwaggerSpecNode của bản Go so phần RPC + route lẻ với file này.
 * Không mở server, không đụng database. Chạy sau gen-registry.js: node backend/tests/fixtures/gen-swagger.js */
const fs = require('fs');
const path = require('path');
const r = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf8'));
const swagger = require(path.join(__dirname, '..', '..', '..', 'server', 'swagger.js'));
const registry = {};
r.names.forEach(function (n) { registry[n] = function () {}; });
const spec = swagger.buildSpec({ registry: registry, publicFns: new Set(r.public), actorFns: new Set(r.actor),
  adminFns: new Set(r.admin), superFns: new Set(r.super) });
fs.writeFileSync(path.join(__dirname, 'swagger-node.json'), JSON.stringify(spec));
console.log(Object.keys(spec.paths).length + ' path, ' + spec.tags.length + ' nhóm');
