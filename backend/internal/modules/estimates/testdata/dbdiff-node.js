'use strict';
/* Đối chiếu nghiệp vụ công tác: chạy các bước trong dbdiff-cases.json qua MÃ NODE (cửa ngõ của auth.js + store_supa.js,
   đúng như REGISTRY của index.js) trên qspro_nodetest và in mỗi bước 1 dòng "tên<TAB>json". Bản Go (TestDBDiff) chạy
   cùng các bước trên qspro_gotest rồi so với file này.
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node dbdiff-node.js > dbdiff-golden.txt
   Id và mốc thời gian được che: uuid -> <idN> theo thứ tự xuất hiện, thời điểm -> <ts>.
   Mọi dòng tạo ra mang tiền tố ZZ_estimates_ / người thao tác zz_estimates_tester và bị xoá khi xong. */
const path = require('path');
const ref = require('./noderef');
const supa = ref.supa();
const tenant = ref.tenant();
const auth = ref.auth();
const store = require(path.join(ref.root, 'server', 'store_supa.js'));
const spec = require('./dbdiff-cases.json');

// REGISTRY + ACTOR_FNS của index.js:54-59, 78, 126
const FNS = {
  ctList: [store.ctList, false], ctSave: [auth.ctSaveGated, true], ctUpdate: [auth.ctUpdateGated, true],
  ctDelete: [auth.ctDeleteGated, true], ctDuyet: [auth.ctDuyetGated, true], ctFav: [auth.ctFavGated, true],
  ctHistory: [store.ctGetHistory, false]
};

const idMap = {};
let idN = 0;
function mask(s) {
  return s
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, function (u) {
      if (!idMap[u]) idMap[u] = '<id' + (++idN) + '>';
      return idMap[u];
    })
    .replace(/\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d(:\d\d)?)?/g, '<ts>');
}
function emit(name, v) { process.stdout.write(name + '\t' + mask(JSON.stringify(v)) + '\n'); }

(async function () {
  const us = await supa.select('users', { filter: 'cong_ty_id=not.is.null&active=is.true', order: 'id.asc', limit: 1, noScope: true });
  if (!us.length) throw new Error('database thử không có tài khoản nào thuộc công ty');
  const actor = { uid: us[0].id, u: spec.actorName, r: 'admin', ct: us[0].cong_ty_id, exp: 0 };
  const ctx = { uid: actor.uid, role: actor.r, congTyId: actor.ct, viewAs: null };
  const like = 'ten=like.*' + spec.prefix + '*';

  async function cleanup(ids) {
    await supa.remove('cong_tac', like, { noScope: true });
    await supa.remove('cong_tac_history', supa.eq('changed_by_name', spec.actorName), { noScope: true });
    if (ids && ids.length) await supa.remove('cong_tac_history', 'cong_tac_id=in.(' + ids.join(',') + ')', { noScope: true });
    await supa.remove('audit_log', supa.eq('username', spec.actorName), { noScope: true });
  }
  await cleanup();

  const ids = [];
  let lastAudit = 0;
  function fill(v) {
    if (typeof v === 'string' && /^\$id:\d+$/.test(v)) { const i = Number(v.slice(4)); return i < ids.length ? ids[i] : 'MISSING'; }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(function (k) { o[k] = fill(v[k]); }); return o; }
    return v;
  }
  try {
    for (const st of spec.steps) {
      let out;
      if (st.dump === 'rows') {
        out = await tenant.run(ctx, function () { return supa.select('cong_tac', { filter: like, order: 'ten.asc' }); });
      } else if (st.dump === 'history') {
        out = ids.length ? await tenant.run(ctx, function () {
          return supa.select('cong_tac_history', { filter: 'cong_tac_id=in.(' + ids.join(',') + ')', order: 'id.asc' });
        }) : [];
        out = out.map(function (r) { const c = Object.assign({}, r); delete c.id; return c; });
      } else {
        const f = FNS[st.fn];
        const args = (f[1] ? [actor] : []).concat(fill(st.args));
        try {
          let res = await tenant.run(ctx, function () { return f[0].apply(null, args); });
          if (st.fn === 'ctSave' && res && res.rows) res.rows.forEach(function (r) { ids.push(r.id); });
          if (st.onlyPrefix) res = res.filter(function (r) { return String(r.ten).indexOf(spec.prefix) >= 0; });
          out = { ok: res === undefined ? null : res };
        } catch (e) { out = { err: e.message }; }
      }
      emit(st.n, out);
      if (!st.dump) {
        const au = await supa.select('audit_log', { filter: supa.eq('username', spec.actorName) + '&id=gt.' + lastAudit, order: 'id.asc', noScope: true });
        au.forEach(function (a) { lastAudit = Math.max(lastAudit, a.id); });
        emit(st.n + '#audit', au.map(function (a) { return { user_id: a.user_id, username: a.username, action: a.action, detail: a.detail }; }));
      }
    }
  } finally {
    await cleanup(ids);
    await supa.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
