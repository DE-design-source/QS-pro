'use strict';
/* Chuẩn đối chiếu của module quotations: chạy các bước trong cases.json qua MÃ NODE THẬT (store_supa.js + export.js)
   trên qspro_nodetest và in mỗi bước 1 dòng "tên<TAB>json". Bản Go (TestSteps với kho giả, TestDBDiff trên qspro_gotest)
   chạy cùng các bước rồi so từng dòng với golden.txt.
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen.js > golden.txt
   Tuỳ chọn:  --xlsx <thư mục>  ghi thêm file .xlsx của từng bước xuất (để compare.js so với file của Go)
              --real <thư mục>  xuất thêm 1 dự án THẬT của database thử (có dòng + tờ bìa): ghi real-quote.json (dữ liệu
                                cho bản giả bên Go) và real.xlsx; không đưa vào golden vì là dữ liệu thật.
   File xuất được đọc lại bằng ExcelJS (xlsx-dump.js) nên golden mô tả ĐÚNG file Node ghi ra.
   getLines / getProject (module takeoff / projects bên Go) được thay bằng dữ liệu cố định của cases.json; ảnh lấy từ bản giả
   của lark.mediaDownload và fetch. Dòng tạo ra mang tiền tố ZZ_quotations_ và bị xoá khi xong. */
const fs = require('fs');
const path = require('path');
const ref = require('./noderef');
const { dump, model } = require('./xlsx-dump');
const spec = require('./cases.json');

const store = ref.store();
const exp = ref.exportBaoGia();
const supa = ref.supa();
const tenant = ref.tenant();
const lark = ref.lark();

function argOf(flag) { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null; }
const xlsxDir = argOf('--xlsx'), realDir = argOf('--real');
[xlsxDir, realDir].forEach(function (d) { if (d) fs.mkdirSync(d, { recursive: true }); });

const PNG = Buffer.from(spec.png, 'base64'), JPG = Buffer.from(spec.jpg, 'base64');
let fetched = [], media = [];
// Bản giả của fetch: theo đường dẫn trả png / jpg / trang html / 404 / content-length quá lớn. Không ra mạng.
global.fetch = async function (url) {
  // fetch thật từ chối URL sai / kèm tài khoản (new Request ném lỗi) và scheme không phải http(s)
  const rq = new Request(url);
  if (!/^https?:$/.test(new URL(rq.url).protocol)) throw new TypeError('fetch failed');
  fetched.push(String(url));
  const u = String(url);
  if (u.indexOf('notfound') >= 0) return { ok: false, status: 404, headers: { get: function () { return null; } }, arrayBuffer: async function () { return Buffer.alloc(0); } };
  const body = u.indexOf('.jpg') >= 0 ? JPG : (u.indexOf('.png') >= 0 ? PNG : Buffer.from('<html></html>'));
  const big = u.indexOf('toobig') >= 0;
  return { ok: true, status: 200,
    headers: { get: function (k) { return String(k).toLowerCase() === 'content-length' ? (big ? '6000000' : String(body.length)) : null; } },
    arrayBuffer: async function () { return body; } };
};
lark.mediaDownload = async function (token) {
  media.push(token);
  if (token === 'bad') throw new Error('Tải media lỗi HTTP 404');
  return { buffer: token.indexOf('jpg') === 0 ? JPG : PNG, contentType: 'application/octet-stream' };
};

// id của dòng trong thông báo lỗi Postgres khác nhau giữa hai database, id công ty tuỳ database thử -> che đi
function emit(name, v) {
  process.stdout.write(name + '\t' + JSON.stringify(v).replace(/Failing row contains \(\d+,/g, 'Failing row contains (<id>,')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>') + '\n');
}
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

async function exportOut(name, res, dir) {
  const buf = Buffer.from(res.base64, 'base64');
  if (dir) fs.writeFileSync(path.join(dir, name + '.xlsx'), buf);
  return { name: res.name, mimeType: res.mimeType, media: media, fetched: fetched, dump: model(await dump(buf)) };
}

(async function () {
  const us = await supa.select('users', { filter: 'cong_ty_id=not.is.null&active=is.true', order: 'id.asc', limit: 1, noScope: true });
  if (!us.length) throw new Error('database thử không có tài khoản nào thuộc công ty');
  const ctx = { uid: us[0].id, role: 'admin', congTyId: us[0].cong_ty_id, viewAs: null };
  const like = 'ma_da=like.' + spec.prefix + '*';

  async function cleanup() {
    await supa.remove('khai_toan', like, { noScope: true });
    await supa.remove('du_an', like, { noScope: true });
  }
  await cleanup();
  try {
    await tenant.run(ctx, function () { return supa.insert('du_an', { ma_da: spec.p1, ten_du_an: spec.prefix + 'du an thu' }); });
    for (const st of spec.steps) {
      const lines = spec.lines[st.lines || 'NONE'], project = st.project ? spec.projects[st.project] : null;
      store.__stub({ getLines: async function () { return clone(lines); }, getProject: async function () { return clone(project); } });
      fetched = []; media = [];
      let out;
      try {
        if (st.dump === 'rows') {
          const rows = await tenant.run(ctx, function () { return supa.select('khai_toan', { filter: supa.eq('ma_da', spec.p1), order: 'sort_no.asc' }); });
          out = rows.map(function (r) { const c = Object.assign({}, r); delete c.id; return c; });
        } else if (st.fn === 'urls') {
          out = [];
          for (const u of spec.urls) { fetched = []; const r = await exp.fetchImage(u); out.push([u, fetched.length > 0, !!r]); }
        } else if (st.fn === 'bang') {
          const buf = Buffer.from(await exp.buildBangXlsx.apply(null, clone(st.args)));
          if (xlsxDir) fs.writeFileSync(path.join(xlsxDir, st.n + '.xlsx'), buf);
          out = { ok: { dump: model(await dump(buf)) } };
        } else if (st.fn === 'exportBaoGia') {
          const res = await tenant.run(ctx, function () { return exp.apply(null, clone(st.args)); });
          out = { ok: await exportOut(st.n, res, xlsxDir) };
        } else {
          const res = await tenant.run(ctx, function () { return store[st.fn].apply(null, clone(st.args || [])); });
          out = { ok: res === undefined ? null : res };
        }
      } catch (e) { out = { err: e.message }; }
      emit(st.n, out);
    }

    if (realDir) {
      // dự án thật đầu tiên của công ty có cả dòng bóc tách lẫn tờ bìa đã lưu
      store.__stub(store.__real);
      const found = await tenant.run(ctx, async function () {
        const ps = await supa.select('du_an', { select: 'ma_da', order: 'ma_da.desc', limit: 400 });
        for (const p of ps) {
          if (String(p.ma_da).indexOf(spec.prefix) === 0) continue;
          const cv = await supa.select('khai_toan', { select: 'id', filter: supa.eq('ma_da', p.ma_da), limit: 1 });
          if (!cv.length) continue;
          const ls = await store.__real.getLines(p.ma_da);
          if (ls.length >= 10) return { maDA: p.ma_da, lines: ls, project: await store.__real.getProject(p.ma_da) };
        }
        return null;
      });
      if (!found) throw new Error('không có dự án thật nào có cả dòng lẫn tờ bìa');
      const args = [found.maDA, null, 'xlsx', null, spec.steps.find(function (s) { return s.n === 'export-default'; }).args[4], null,
        [['Cộng chưa VAT', 1000000], ['VAT 8%', 80000], ['TỔNG THANH TOÁN', 1080000]], 'Công ty thử'];
      fetched = []; media = [];
      const res = await tenant.run(ctx, function () { return exp.apply(null, clone(args)); });
      const out = await exportOut('real', res, realDir);
      fs.writeFileSync(path.join(realDir, 'real-quote.json'), JSON.stringify({ congTyId: ctx.congTyId, uid: ctx.uid, args: args,
        lines: found.lines, project: found.project, name: out.name, media: out.media, fetched: out.fetched }));
      console.error('real: ' + found.maDA + ' - ' + found.lines.length + ' dòng, ' + out.dump.sheets.length + ' sheet, ' +
        out.dump.sheets.reduce(function (n, s) { return n + s.images.length; }, 0) + ' ảnh');
    }
  } finally {
    await cleanup();
    await supa.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
