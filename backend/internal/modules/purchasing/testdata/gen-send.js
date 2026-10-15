'use strict';
/* Sinh send-golden.json cho sendPurchaseRequest / sendDeXuat từ MÃ NODE THẬT (server/index.js + server/store_supa.js).
   KHÔNG ghi database (supa.insert / supa.remove bị thay bằng bản ghi nhận), webhook là máy chủ HTTP cục bộ:
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen-send.js > send-golden.json */
const http = require('http');
const ref = require('./noderef');
const cases = require('./send-cases.json');

const supa = ref.supa();
let ins = [];
supa.insert = async function (table, rows) { ins.push({ t: table, rows: Array.isArray(rows) ? rows : [rows] }); };
supa.remove = async function () { throw new Error('không được xoá'); };
const store = ref.loadStore();

let recs = [];
const actor = { uid: 'u-1', u: 'mai', r: 'admin' };
const auth = {
  notifyPurchaseAdmins: async function (a, orders) { recs.push({ fn: 'notifyPurchaseAdmins', uid: a && a.uid, arg: orders }); },
  notifyDeXuatAdmins: async function (a, dx) { recs.push({ fn: 'notifyDeXuatAdmins', uid: a && a.uid, arg: dx }); }
};
let logs = [];
const con = { warn: function () { logs.push(Array.prototype.join.call(arguments, ' ')); }, log: function () {}, error: function () {} };
const mask = function (s) { return s.replace(/(MH|CK|TT)-[0-9A-Z]+-\d+/g, '<ma>'); };

let reply = '';
const srv = http.createServer(function (req, res) { req.resume(); req.on('end', function () { res.end(reply); }); });
srv.listen(0, '127.0.0.1', async function () {
  const live = ref.loadIndex({ webhook: 'http://127.0.0.1:' + srv.address().port + '/x', store: store, auth: auth, console: con });
  const dead = ref.loadIndex({ webhook: 'http://127.0.0.1:9/x', store: store, auth: auth, console: con });
  const out = [];
  for (const c of cases) {
    ins = []; recs = []; logs = []; reply = c.reply || '';
    let res;
    try { res = await (c.dead ? dead : live)[c.fn](actor, c.arg); } catch (e) { res = { err: e.message }; }
    out.push(mask(JSON.stringify({ res: res, ins: ins, notify: recs, logs: logs })));
  }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  srv.close();
  supa.close && supa.close();
  setTimeout(function () { process.exit(0); }, 200).unref();
});
