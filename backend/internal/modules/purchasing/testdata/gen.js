'use strict';
/* Sinh golden.json cho phần logic thuần của module purchasing từ MÃ NODE THẬT (không ghi database, không gọi mạng):
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen.js > golden.json
   Ngày trên thẻ cố định 05/01/2026 (đồng hồ giả) để không phụ thuộc lúc chạy. */
const ref = require('./noderef');
const cases = require('./pure-cases.json');

class FixedDate extends Date {
  constructor() { if (arguments.length) super(...arguments); else super(2026, 0, 5, 10, 0, 0); }
}
const idx = ref.loadIndex({ Date: FixedDate, fetch: function () { throw new Error('không được gọi mạng'); } });
const store = ref.loadStore();
const mh = store.__mh;

function tryStr(fn) { try { return { json: JSON.stringify(fn()) }; } catch (e) { return { err: e.message }; } }

const out = {
  fmtVN: cases.fmtVN.map(function (v) { return idx.fmtVN(v); }),
  purchaseCards: cases.purchaseCards.map(function (o) { return tryStr(function () { return idx.buildPurchaseCard(o); }); }),
  deXuatCards: cases.deXuatCards.map(function (c) { return tryStr(function () { return idx.buildDeXuatCard(c[0], c[1]); }); }),
  thieuBang: cases.thieuBang.map(function (m) { return mh.dxThieuBang_(new Error(m)); }),
  dxBang: cases.dxBang.map(function (l) { return mh.dxBang_(l); }),
  dxHead: cases.dxHead.map(function (r) { return JSON.stringify(store.dxHead_(r)); }),
  dxItem: cases.dxItem.map(function (r) { return JSON.stringify(store.dxItem_(r)); }),
  // dạng mã sinh ra (phần ngẫu nhiên không so được): chỉ ghi lại mẫu để test Go kiểm cùng biểu thức chính quy
  maDon: /^MH-[0-9A-Z]+-\d{1,4}$/.test(mh.genMaDon_()),
  maCK: /^CK-[0-9A-Z]+-\d{1,4}$/.test(mh.genMaDeXuat_('ck')) && /^CK-/.test(mh.genMaDeXuat_('x')),
  maTT: /^TT-[0-9A-Z]+-\d{1,4}$/.test(mh.genMaDeXuat_('tt'))
};
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
ref.supa().close && ref.supa().close();
