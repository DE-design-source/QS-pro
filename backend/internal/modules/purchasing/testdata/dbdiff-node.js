'use strict';
/* Đối chiếu nghiệp vụ mua hàng: chạy các bước của dbdiff-cases.json qua MÃ NODE THẬT (store_supa.js, auth.js và đoạn
   I:137-319 của index.js, đúng như REGISTRY + ACTOR_FNS) trên qspro_nodetest, in mỗi bước các dòng "tên<TAB>json".
   Bản Go (TestDBDiff) chạy cùng các bước trên qspro_gotest rồi so với file này.
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node dbdiff-node.js > dbdiff-golden.txt
   Webhook Lark là máy chủ giả chạy trong chính tiến trình này (không gọi ra ngoài). Hai hàm báo admin của module
   notifications được thay bằng bản ghi lại tham số (bên Go là contracts.PurchaseNotifier giả).
   Che: uuid -> <idN>, mã phiếu -> <maN> (theo thứ tự xuất hiện), thời điểm -> <ts>, ngày trên thẻ -> <stamp>.
   Mọi dòng tạo ra có ma_du_an bắt đầu bằng ZZ_purchasing_ / người thao tác zz_purchasing_tester và bị xoá khi xong. */
const http = require('http');
const ref = require('./noderef');
const supa = ref.supa();
const tenant = ref.tenant();
const auth = ref.auth();
const store = require(require('path').join(ref.root, 'server', 'store_supa.js'));
const spec = require('./dbdiff-cases.json');

const HOOKS = {
  ok: [200, '{"code":0,"msg":"success"}'],
  status0: [200, '{"StatusCode":0,"StatusMessage":"success"}'],
  msg: [200, '{"code":19001,"msg":"param invalid"}'],
  text: [502, 'oops']
};

const idMap = {}, maMap = {};
let idN = 0, maN = 0;
function mask(s) {
  return s
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, function (u) {
      if (!idMap[u]) idMap[u] = '<id' + (++idN) + '>';
      return idMap[u];
    })
    .replace(/(MH|CK|TT)-[0-9A-Z]+-\d+/g, function (m) {
      if (!maMap[m]) maMap[m] = '<ma' + (++maN) + '>';
      return maMap[m];
    })
    .replace(/\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d(:\d\d)?)?/g, '<ts>')
    .replace(/· \d\d\/\d\d\/\d{4}/g, '· <stamp>')
    .replace(/Failing row contains \(\d+,/g, 'Failing row contains (<n>,');
}
function emit(name, v) { process.stdout.write(name + '\t' + mask(JSON.stringify(v)) + '\n'); }
function strip(rows) { return rows.map(function (r) { const c = Object.assign({}, r); delete c.id; return c; }); }

(async function () {
  const us = await supa.select('users', { filter: 'cong_ty_id=not.is.null&active=is.true', order: 'id.asc', limit: 1, noScope: true });
  if (!us.length) throw new Error('database thử không có tài khoản nào thuộc công ty');
  const actor = { uid: us[0].id, u: spec.actorName, r: 'admin', ct: us[0].cong_ty_id, exp: 0 };
  const ctx = { uid: actor.uid, role: actor.r, congTyId: actor.ct, viewAs: null };
  const like = 'ma_du_an=like.' + spec.prefix + '*';
  const no = { noScope: true };

  // máy chủ webhook giả
  let hook = 'ok', got = null;
  const srv = http.createServer(function (req, res) {
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      got = { method: req.method, ct: req.headers['content-type'] || '', body: Buffer.concat(chunks).toString('utf8') };
      if (hook === 'drop') { req.socket.destroy(); return; }
      const h = HOOKS[hook];
      res.writeHead(h[0], { 'Content-Type': 'application/json' });
      res.end(h[1]);
    });
  });
  await new Promise(function (ok) { srv.listen(0, '127.0.0.1', ok); });

  // bản ghi thay cho notifyPurchaseAdmins / notifyDeXuatAdmins + console của đoạn index.js
  let admins = [], logs = [], notifyFail = false;
  const fakeAuth = {
    notifyPurchaseAdmins: async function (a, orders) { admins.push({ fn: 'notifyPurchaseAdmins', uid: a && a.uid, arg: orders }); if (notifyFail) throw new Error('ZZ notify boom'); },
    notifyDeXuatAdmins: async function (a, dx) { admins.push({ fn: 'notifyDeXuatAdmins', uid: a && a.uid, arg: dx }); if (notifyFail) throw new Error('ZZ notify boom'); }
  };
  const fakeConsole = { warn: function () { logs.push(Array.prototype.join.call(arguments, ' ')); } };
  fakeConsole.error = fakeConsole.log = fakeConsole.warn;
  const idx = ref.loadIndex({ webhook: 'http://127.0.0.1:' + srv.address().port + '/hook', store: store, auth: fakeAuth, console: fakeConsole });

  // REGISTRY + ACTOR_FNS của index.js:74-79, 100-111, 118-127
  const FNS = {
    sendPurchaseRequest: [idx.sendPurchaseRequest, true], getPurchaseOrders: [store.getPurchaseOrders, false],
    setPurchaseStatus: [auth.setPurchaseStatus, true], getDeXuatList: [store.getDeXuatList, false],
    sendDeXuat: [idx.sendDeXuat, true], listPurchaseRequests: [auth.listPurchaseRequests, true],
    getPurchaseOrder: [auth.getPurchaseOrder, true], resolvePurchaseRequest: [auth.resolvePurchaseRequest, true],
    listDeXuat: [auth.listDeXuat, true], getDeXuat: [auth.getDeXuat, true], resolveDeXuat: [auth.resolveDeXuat, true]
  };

  const mas = [];
  async function codesOf(table, col) { return (await supa.select(table, { filter: like, select: col, noScope: true })).map(function (r) { return r[col]; }); }
  function inList(col, list) { return col + '=in.(' + list.join(',') + ')'; }
  async function cleanup() {
    const po = (await codesOf('don_mua_hang', 'ma_don')), dx = (await codesOf('de_xuat', 'ma_de_xuat'));
    const all = po.concat(dx, mas).filter(function (x, i, a) { return a.indexOf(x) === i; });
    if (po.length) await supa.remove('chi_tiet_mua_hang', inList('ma_don', po), no);
    if (dx.length) { await supa.remove('chi_tiet_de_xuat_ck', inList('ma_de_xuat', dx), no); await supa.remove('chi_tiet_de_xuat_tt', inList('ma_de_xuat', dx), no); }
    await supa.remove('don_mua_hang', like, no);
    await supa.remove('de_xuat', like, no);
    if (all.length) await supa.remove('notifications', inList('ref_id', all), no);
    await supa.remove('audit_log', supa.eq('username', spec.actorName), no);
  }
  await cleanup();

  const seenAudit = {}, seenNotif = {};
  function fill(v) {
    if (typeof v === 'string' && /^\$ma:\d+$/.test(v)) { const i = Number(v.slice(4)); return i < mas.length ? mas[i] : 'MISSING'; }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(function (k) { o[k] = fill(v[k]); }); return o; }
    return v;
  }
  try {
    for (const st of spec.steps) {
      if (st.dump === 'orders') {
        const heads = await supa.select('don_mua_hang', { filter: like, order: 'id.asc', noScope: true });
        const items = heads.length ? await supa.select('chi_tiet_mua_hang', { filter: inList('ma_don', heads.map(function (h) { return h.ma_don; })), order: 'id.asc', noScope: true }) : [];
        emit(st.n, { heads: strip(heads), items: strip(items) });
        continue;
      }
      if (st.dump === 'proposals') {
        const heads = await supa.select('de_xuat', { filter: like, order: 'id.asc', noScope: true });
        const f = heads.length ? inList('ma_de_xuat', heads.map(function (h) { return h.ma_de_xuat; })) : '';
        const ck = heads.length ? await supa.select('chi_tiet_de_xuat_ck', { filter: f, order: 'id.asc', noScope: true }) : [];
        const tt = heads.length ? await supa.select('chi_tiet_de_xuat_tt', { filter: f, order: 'id.asc', noScope: true }) : [];
        emit(st.n, { heads: strip(heads), ck: strip(ck), tt: strip(tt) });
        continue;
      }
      hook = st.hook || 'ok'; got = null; admins = []; logs = []; notifyFail = !!st.notifyFail;
      const f = FNS[st.fn];
      const args = (f[1] ? [actor] : []).concat(fill(st.args));
      let out;
      try {
        let res = await tenant.run(ctx, function () { return f[0].apply(null, args); });
        if (res && Array.isArray(res.saved)) res.saved.forEach(function (m) { mas.push(m); });
        if (st.fn === 'sendDeXuat' && res && res.ma) mas.push(res.ma);
        if (st.onlyPrefix) res = res.filter(function (r) { return String(r[st.onlyPrefix]).indexOf(spec.prefix) >= 0; });
        out = { ok: res === undefined ? null : res };
      } catch (e) { out = { err: e.message }; }
      emit(st.n, out);
      const au = (await supa.select('audit_log', { filter: supa.eq('username', spec.actorName), order: 'id.asc', noScope: true }))
        .filter(function (a) { if (seenAudit[a.id]) return false; seenAudit[a.id] = 1; return true; });
      emit(st.n + '#audit', au.map(function (a) { return { user_id: a.user_id, username: a.username, action: a.action, detail: a.detail }; }));
      const nt = (mas.length ? await supa.select('notifications', { filter: inList('ref_id', mas), order: 'created_at.asc', noScope: true }) : [])
        .filter(function (x) { if (seenNotif[x.id]) return false; seenNotif[x.id] = 1; return true; });
      emit(st.n + '#notif', nt.map(function (x) { return { user_id: x.user_id, kind: x.kind, title: x.title, body: x.body, ref_id: x.ref_id, is_read: x.is_read }; }));
      emit(st.n + '#admins', admins);
      emit(st.n + '#hook', got);
      emit(st.n + '#log', logs.map(function (l) { return hook === 'drop' ? l.replace(/(lỗi:) .*$/, '$1 <net>') : l; }));
    }
  } finally {
    await cleanup();
    srv.close();
    await supa.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
