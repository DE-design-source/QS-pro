'use strict';
/* So TRẠNG THÁI 2 database: mọi bảng public (hợp của 2 phía: bảng chỉ có ở 1 phía cũng bị báo), từng dòng (row_to_json),
   cùng phép chuẩn hoá với thân trả lời. Bảng có id số: xếp theo id và so từng cặp (id phải trùng).
   Bảng id uuid / không có id: so tập dòng đã chuẩn hoá, rồi so GIÁ TRỊ các mốc thời gian của từng cặp dòng đã khớp. */
async function meta(pool) {
  const r = await pool.query("select t.table_name t, (select data_type from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'id') idt, (select count(*)::int from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'created_at') ca from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE' and t.table_name <> 'schema_migrations' order by 1");
  return r.rows;
}
async function rowsOf(pool, t, order) {
  return (await pool.query('select row_to_json(x)::text j from public."' + t + '" x' + (order ? ' order by ' + order : ''))).rows.map((r) => r.j);
}
const cmpTs = (p, q) => { for (let i = 0; i < Math.min(p.length, q.length); i++) if (p[i] !== q[i]) return p[i] < q[i] ? -1 : 1; return p.length - q.length; };
// only: danh sách bảng cần so (rỗng = tất cả). Trả [{table, msg, node, go}]
async function dbDiff(pools, norm, only) {
  const keep = (m) => !only || !only.length || only.indexOf(m.t) >= 0;
  const [mn, mg] = await Promise.all([meta(pools.node), meta(pools.go)]);
  const out = [], notes = [];
  const inGo = new Set(mg.map((m) => m.t)), inNode = new Set(mn.map((m) => m.t));
  mn.filter((m) => keep(m) && !inGo.has(m.t)).forEach((m) => out.push({ table: m.t, msg: 'bảng chỉ có ở database của Node', node: m.t, go: '' }));
  mg.filter((m) => keep(m) && !inNode.has(m.t)).forEach((m) => out.push({ table: m.t, msg: 'bảng chỉ có ở database của Go', node: '', go: m.t }));
  const tabs = mn.filter((m) => keep(m) && inGo.has(m.t));
  // Ghép cặp id uuid của các bảng khoá uuid theo thứ tự tạo (2 phía tạo cùng thứ tự)
  for (const m of tabs.filter((x) => x.idt === 'uuid')) {
    const q = 'select id::text id from public."' + m.t + '" order by ' + (m.ca ? 'created_at, ' : '') + (m.t === 'users' ? 'username' : m.t === 'companies' ? 'code, name' : 'id');
    const [a, b] = await Promise.all([pools.node.query(q), pools.go.query(q)]);
    if (a.rows.length === b.rows.length) a.rows.forEach((r, i) => norm.bind(r.id, b.rows[i].id));
  }
  for (const m of tabs) {
    const byId = m.idt && m.idt !== 'uuid';
    let a, b;
    try { [a, b] = await Promise.all([rowsOf(pools.node, m.t, byId ? 'id' : ''), rowsOf(pools.go, m.t, byId ? 'id' : '')]); }
    catch (e) { out.push({ table: m.t, msg: 'lỗi đọc: ' + e.message }); continue; }
    if (byId && m.t === 'notifications' && a.length === b.length && a.some((r, i) => norm.diff(r, b[i]))) {
      /* Node không xác định: getAdmins_ (server/auth.js:450) đọc danh sách admin KHÔNG có ORDER BY rồi chèn mỗi admin 1 thông báo, nên trong
         một sự kiện, admin nào nhận id nào tuỳ thứ tự vật lý của bảng users ở từng database (Go dùng cùng câu truy vấn). Chỉ khi so từng dòng
         thấy khác mới xét: trong mỗi nhóm dòng LIỀN NHAU giống hệt nhau trừ id / user_id / created_at, xếp lại user_id theo nhãn đã chuẩn hoá
         rồi so như thường. Tập người nhận, id, nội dung và mốc thời gian vẫn phải khớp; bước được ghi là "khác có chủ ý" (ARCHITECTURE 10.6). */
      const regroup = (side, list) => {
        const rows = list.map((r) => JSON.parse(r));
        const key = (o) => JSON.stringify(Object.assign({}, o, { id: 0, user_id: '', created_at: '' }));
        for (let i = 0; i < rows.length;) {
          let j = i + 1; while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
          const us = rows.slice(i, j).map((o) => o.user_id).sort((p, q) => { const x = norm.text(side, String(p)), y = norm.text(side, String(q)); return x < y ? -1 : x > y ? 1 : 0; });
          for (let k = i; k < j; k++) rows[k].user_id = us[k - i];
          i = j;
        }
        return rows.map((o) => JSON.stringify(o));
      };
      const a2 = regroup('node', a), b2 = regroup('go', b);
      if (!a2.some((r, i) => norm.diff(r, b2[i]))) { notes.push({ table: m.t, msg: 'thứ tự admin nhận thông báo trong cùng một sự kiện khác nhau (cùng tập người nhận)' }); continue; }
    }
    if (byId) {
      if (a.length !== b.length) out.push({ table: m.t, msg: 'số dòng ' + a.length + ' / ' + b.length });
      let shown = 0;
      for (let i = 0; i < Math.min(a.length, b.length) && shown < 4; i++) {
        const d = norm.diff(a[i], b[i]);
        if (d) { shown++; out.push({ table: m.t, msg: 'dòng #' + i + ' khác từ ký tự ' + d.at, node: d.node, go: d.go }); }
      }
      const extra = a.length > b.length ? a.slice(b.length) : b.slice(a.length);
      extra.slice(0, 3).forEach((r) => out.push({ table: m.t, msg: 'dòng chỉ có ở ' + (a.length > b.length ? 'Node' : 'Go'), node: a.length > b.length ? r.slice(0, 400) : '', go: a.length > b.length ? '' : r.slice(0, 400) }));
    } else {
      const canon = (side, list) => list.map((r) => { const ts = []; return { t: norm.text(side, r, ts), ts }; }).sort((p, q) => (p.t < q.t ? -1 : p.t > q.t ? 1 : cmpTs(p.ts, q.ts)));
      const X = canon('node', a), Y = canon('go', b);
      const x = X.map((r) => r.t), y = Y.map((r) => r.t);
      const cy = new Map(); y.forEach((r) => cy.set(r, (cy.get(r) || 0) + 1));
      const onlyA = []; x.forEach((r) => { const n = cy.get(r) || 0; if (n) cy.set(r, n - 1); else onlyA.push(r); });
      const onlyB = []; cy.forEach((n, r) => { for (let i = 0; i < n; i++) onlyB.push(r); });
      if (!onlyA.length && !onlyB.length) {
        // 2 tập giống nhau sau chuẩn hoá: dòng thứ i của 2 phía là một cặp (dòng trùng văn bản thì xếp theo mốc thời gian) -> so giá trị mốc thời gian
        let shown = 0;
        for (let i = 0; i < X.length && shown < 4; i++) {
          for (let k = 0; k < X[i].ts.length; k++) {
            if (!(Math.abs(X[i].ts[k] - Y[i].ts[k]) > norm.tsTol)) continue;   // NaN (chuỗi giống ngày giờ nhưng không hợp lệ) không tính
            shown++; out.push({ table: m.t, msg: 'mốc thời gian #' + k + ' của dòng lệch ' + (Y[i].ts[k] - X[i].ts[k]) + ' ms', node: X[i].t.slice(0, 300), go: new Date(X[i].ts[k]).toISOString() + ' / ' + new Date(Y[i].ts[k]).toISOString() });
            break;
          }
        }
        continue;
      }
      out.push({ table: m.t, msg: a.length + ' / ' + b.length + ' dòng; chỉ có ở Node ' + onlyA.length + ', chỉ có ở Go ' + onlyB.length });
      for (let i = 0; i < Math.min(4, Math.max(onlyA.length, onlyB.length)); i++) {
        const p = onlyA[i] || '', q = onlyB[i] || ''; let k = 0; while (k < p.length && p[k] === q[k]) k++;
        out.push({ table: m.t, msg: 'khác từ ký tự ' + k, node: p.slice(Math.max(0, k - 120), k + 240), go: q.slice(Math.max(0, k - 120), k + 240) });
      }
    }
  }
  return { tables: tabs.length, diffs: out, notes };
}
module.exports = { dbDiff };
