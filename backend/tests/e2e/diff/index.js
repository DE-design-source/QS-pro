'use strict';
/* Bộ so sánh vi sai Node (tham chiếu) <-> Go. KHÔNG tự bật server và KHÔNG reset database: việc đó của run.ps1.
   Chạy tay (2 server đã chạy trên 2 database vừa reset về cùng seed):
     NODE_DB=postgresql://.../qspro_nodetest GO_DB=postgresql://.../qspro_gotest AUTH_SECRET=<giống 2 server>
     node backend/tests/e2e/diff/index.js [lọc tên kịch bản...]
   Biến khác: NODE_URL (http://localhost:3997), GO_URL (http://localhost:3998), VERBOSE=1 (in mọi bước), DIFF_OUT (thư mục báo cáo),
   TS_TOL_MS (độ lệch mốc thời gian cho phép, mặc định 15000), DIFF_FAST=1 (bỏ bước chờ 31 giây của area1/04; chỉ dùng khi dò lỗi).
   Kịch bản: mọi file scenarios/**.js không bắt đầu bằng "_", chạy theo thứ tự tên; mỗi file export { name, run(h) }.
   Sau mỗi kịch bản so toàn bộ bảng của 2 database. Thoát mã 1 nếu có chỗ khác.
   Loại bước: rpc / rest / raw (cùng request tới 2 server), goonly (chỉ Go, so với kỳ vọng cố định của docs/API.md), race (n lời gọi
   đồng thời, so tập kết quả), token, fake, db, check. Header được so: xem HEADERS trong lib/harness.js. Luật chấp nhận: lib/accept.js. */
const fs = require('fs');
const path = require('path');
const { Harness } = require('./lib/harness');
const { Fake } = require('./lib/fake');

const dbName = (u) => { try { return new URL(u).pathname.replace(/^\//, ''); } catch (e) { return ''; } };
const NODE_DB = process.env.NODE_DB || '', GO_DB = process.env.GO_DB || '';
if (dbName(NODE_DB) !== 'qspro_nodetest' || dbName(GO_DB) !== 'qspro_gotest') { console.error('Chỉ chạy với NODE_DB = .../qspro_nodetest và GO_DB = .../qspro_gotest.'); process.exit(2); }

function listScenarios(dir) {
  let out = [];
  fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listScenarios(p));
    else if (/\.js$/.test(e.name) && e.name[0] !== '_') out.push(p);
  });
  return out;
}

(async () => {
  const h = new Harness({ nodeUrl: process.env.NODE_URL || 'http://localhost:3997', goUrl: process.env.GO_URL || 'http://localhost:3998', nodeDb: NODE_DB, goDb: GO_DB,
    secret: process.env.AUTH_SECRET || 'qs-pro-dev-secret-change-me', verbose: process.env.VERBOSE === '1', tsTolMs: Number(process.env.TS_TOL_MS) || 15000 });
  const outDir = process.env.DIFF_OUT || path.join(__dirname, '.out');
  fs.mkdirSync(outDir, { recursive: true });
  h.cfg.progress = path.join(outDir, 'progress.log');
  fs.writeFileSync(h.cfg.progress, '');
  let fatal = null;
  h.fake = new Fake();
  try {
    await h.fake.start();
    for (const side of ['node', 'go']) {
      let up = false;
      for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(h.url[side] + '/healthz')).ok; } catch (e) { /* chưa lên */ } if (!up) await h.sleep(500); }
      if (!up) throw new Error('Server ' + side + ' chưa chạy ở ' + h.url[side]);
    }
    const root = path.join(__dirname, 'scenarios');
    const filters = process.argv.slice(2);
    const files = listScenarios(root).filter((f) => !filters.length || filters.some((x) => path.relative(root, f).replace(/\\/g, '/').indexOf(x) >= 0));
    h.scenario = 'khởi điểm'; h.out('== khởi điểm');
    await h.dbCheck('2 database giống nhau trước khi chạy');
    for (const f of files) {
      const sc = require(f);
      h.scenario = sc.name || path.relative(root, f).replace(/\\/g, '/');
      h.out('== ' + h.scenario);
      const t0 = Date.now(), n0 = h.steps.length;
      h.fake.reset();
      try { await sc.run(h); }
      catch (e) { h.record('lỗi', 'kịch bản dừng giữa chừng', { status: 0 }, { status: 0 }, [{ what: 'exception', node: (e && e.stack) || String(e), go: '' }]); }
      // request tới server giả mà kịch bản chưa so: so nốt, không bỏ sót
      if (h.fake.log.node.length || h.fake.log.go.length) h.fakeCheck('request tới server giả chưa so trong kịch bản');
      await h.dbCheck('database sau kịch bản');
      const mine = h.steps.slice(n0);
      console.log('[' + h.scenario + '] ' + mine.length + ' bước, ' + mine.filter((s) => s.state === 'DIFF').length + ' khác, ' + mine.filter((s) => s.state === 'ACCEPT').length + ' khác có chủ ý, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    }
  } catch (e) { fatal = e; }
  const s = h.summary();
  h.out('== TỔNG: ' + s.total + ' bước ' + JSON.stringify(s.kinds) + ', ' + s.diff + ' khác, ' + s.accept + ' khác có chủ ý, ' + s.skipped + ' lời gọi không có dạng REST');
  h.writeReport(outDir);
  console.log('\nTỔNG: ' + s.total + ' bước ' + JSON.stringify(s.kinds) + ', ' + s.diff + ' KHÁC, ' + s.accept + ' khác có chủ ý (chấp nhận), ' + s.skipped + ' lời gọi không có dạng REST');
  /* Lời gọi không có dạng REST (lib/rest-map.js trả null): tham số đường dẫn rỗng / không phải chuỗi, thân không phải object, query không phải chuỗi.
     Các dạng đó được thử riêng ở area1/06-rest-binding.js và area2/07-rest-binding.js (chỉ Go, so với docs/API.md). In theo từng hàm để thấy hàm nào bị bỏ nhiều. */
  if (s.skipped) console.log('  không có dạng REST theo hàm: ' + Object.keys(s.skippedBy).sort().map((k) => k + ' ' + s.skippedBy[k]).join(', '));
  // Bước có gửi lại phía Node (socket keep-alive bị đóng): nếu là lời gọi ghi thì Node có thể đã xử lý 2 lần -> lần chạy KHÔNG sạch hoàn toàn, xem report.json (retried)
  if (s.retries) console.log('  CHÚ Ý: gửi lại phía Node sau lỗi socket ' + s.retries + ' lần, ở các bước #' + s.retriedSteps.join(', #') + ' (ghi trong report.json)');
  const acc = {}; h.steps.filter((x) => x.state === 'ACCEPT').forEach((x) => { acc[x.reason] = (acc[x.reason] || 0) + 1; });
  Object.keys(acc).forEach((k) => console.log('  chấp nhận x' + acc[k] + ': ' + k));
  console.log('Báo cáo: ' + path.join(outDir, 'report.txt'));
  if (fatal) console.error('FATAL', fatal && fatal.stack || fatal);
  await h.close();
  await h.fake.stop();
  process.exit(fatal ? 2 : s.diff ? 1 : 0);
})();
