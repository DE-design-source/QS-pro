'use strict';
/* Chuẩn hoá những giá trị VỐN khác nhau giữa 2 server (token, UUID mới sinh, mốc thời gian, băm bcrypt, mã ngẫu nhiên)
   theo MẪU, không xoá cả trường. UUID: ghép cặp theo vị trí xuất hiện (cái thứ i bên Node <-> cái thứ i bên Go),
   cặp đã ghép dùng chung một nhãn <U#n> cho cả lần chạy -> trả nhầm id của dòng khác vẫn bị phát hiện.
   Mã tự sinh (DA- / MH- / CK- / TT-) cũng ghép cặp như UUID (nhãn <DA-MA#n>...), và chỉ ghép khi mốc thời gian nằm trong mã
   của 2 phía lệch không quá ngưỡng; mã 2 phía giống hệt nhau (do kịch bản đặt) thì giữ nguyên văn. */
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// (?<!...) ở đầu: chuỗi dài toàn chữ (vd 2 MB chữ "a") chỉ bị thử 1 lần, không thử lại từ từng vị trí (O(n^2))
const RE_TOKEN = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g;
const RE_TS = /(\d{4}-\d{2}-\d{2})([T ])(\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?/g;
const RE_BCRYPT = /(\$2[aby]\$\d\d\$)[.\/A-Za-z0-9]{53}/g;
const RE_CODE = /\b(DA|MH|CK|TT)-[0-9A-Z]{6,10}-[0-9A-Z]{1,12}\b/g;
const RE_TSVN = /\b\d{1,2}:\d{2}(:\d{2})? \d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}(:\d{2})?\b/g;

// Địa chỉ gốc của server giả (lib/fake.js): mỗi phía một cổng, Go gọi qua host.docker.internal
const RE_FAKE = /http:\/\/(?:127\.0\.0\.1:4101|host\.docker\.internal:4102)(?![0-9])/g;
// Đường dẫn file trên kho: sp/<Date.now()>-<ngẫu nhiên>.<đuôi> và docs/<Date.now()>-<tên>.<đuôi> ("/" có thể đã mã hoá 1 hoặc 2 lần)
const RE_STORE_SP = /\bsp(\/|%2F|%252F)\d{13}-\d{1,6}\./g;
const RE_STORE_DOC = /\bdocs(\/|%2F|%252F)\d{13}-/g;

/* Mốc thời gian (ms) nằm trong mã tự sinh, NaN nếu chuỗi không có dạng mã do server sinh:
   DA-<yyyymmdd>-<hhmmss><2 ký tự ngẫu nhiên> theo giờ Việt Nam (store_supa.js genMaDA_);
   MH- / CK- / TT-<Date.now() hệ 36, viết hoa>-<số ngẫu nhiên dưới 10000> (genMaDon_, genMaDeXuat_). */
function codeTime(code) {
  const p = String(code).split('-');
  if (p[0] === 'DA') {
    const d = /^(\d{4})(\d{2})(\d{2})$/.exec(p[1] || ''), t = /^(\d{2})(\d{2})(\d{2})[0-9A-Z]{0,2}$/.exec(p[2] || '');
    return d && t ? Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], +t[3]) - 7 * 3600e3 : NaN;
  }
  if (!/^[0-9A-Z]{8}$/.test(p[1] || '') || !/^\d{1,4}$/.test(p[2] || '')) return NaN;
  const ms = parseInt(p[1], 36);
  return ms > 1e12 && ms < 1e13 ? ms : NaN;
}

class Norm {
  constructor(tsTolMs) {
    this.map = { node: new Map(), go: new Map() };     // uuid -> nhãn
    this.codes = { node: new Map(), go: new Map() };   // mã tự sinh -> nhãn
    this.n = 0; this.nc = 0;
    this.tsTol = tsTolMs || 15000;
  }
  // Ghép sẵn một cặp id (vd id trả về từ bước tạo)
  bind(a, b) {
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
    if (a === b) return;
    if (this.map.node.has(a) || this.map.go.has(b)) return;
    const lab = '<U#' + (++this.n);
    this.map.node.set(a, lab); this.map.go.set(b, lab);
  }
  // Ghép một cặp mã tự sinh: cùng tiền tố, cả hai đúng dạng server sinh và mốc thời gian trong mã lệch trong ngưỡng
  // (+1 giây: mã DA- chỉ ghi tới giây). Không đạt -> để nguyên văn, bước so sẽ báo khác.
  bindCode(a, b) {
    if (a === b || this.codes.node.has(a) || this.codes.go.has(b)) return;
    if (a.slice(0, 3) !== b.slice(0, 3)) return;
    const ta = codeTime(a), tb = codeTime(b);
    if (ta !== ta || tb !== tb || Math.abs(ta - tb) > this.tsTol + 1000) return;
    const lab = '<' + a.slice(0, 2) + '-MA#' + (++this.nc) + '>';
    this.codes.node.set(a, lab); this.codes.go.set(b, lab);
  }
  // Ghép cặp UUID / mã tự sinh theo vị trí trong 2 chuỗi (chỉ ghép khi cả hai cùng chưa có nhãn và khác nhau)
  bindTexts(a, b) {
    const la = (a.match(RE_UUID) || []), lb = (b.match(RE_UUID) || []);
    if (la.length === lb.length) {
      for (let i = 0; i < la.length; i++) {
        const x = la[i].toLowerCase(), y = lb[i].toLowerCase();
        if (x !== y && !this.map.node.has(x) && !this.map.go.has(y)) this.bind(x, y);
      }
    }
    const ca = (a.match(RE_CODE) || []), cb = (b.match(RE_CODE) || []);
    if (ca.length === cb.length) for (let i = 0; i < ca.length; i++) this.bindCode(ca[i], cb[i]);
  }
  // Chuẩn hoá 1 chuỗi của 1 phía; ts (tuỳ chọn) nhận các mốc thời gian đã thay (ms) để so độ lệch
  text(side, s, ts) {
    const m = this.map[side], cm = this.codes[side];
    return String(s)
      .replace(RE_FAKE, 'http://fake')
      .replace(RE_STORE_SP, 'sp$1<MS>-<R>.')
      .replace(RE_STORE_DOC, 'docs$1<MS>-')
      .replace(RE_TOKEN, '<TOKEN>')
      .replace(RE_BCRYPT, '$1<BCRYPT>')
      // UUID đã ghép cặp -> nhãn chung; GIỮ dấu hiệu hoa / thường (server phải trả đúng dạng chữ như bên kia: vd audit ghi lại id
      // nguyên văn client gửi). UUID chưa ghép cặp: giữ nguyên văn.
      .replace(RE_UUID, (u) => { const lo = u.toLowerCase(), lab = m.get(lo); return lab ? lab + (u === lo ? '' : u === u.toUpperCase() ? ':HOA' : ':LẪN') + '>' : u; })
      .replace(RE_CODE, (c) => cm.get(c) || c)
      .replace(RE_TS, (all, d, sep, t, frac, tz) => {
        if (ts) ts.push(Date.parse(d + 'T' + t + (frac || '') + (tz ? tz.replace(/^([+-]\d{2})$/, '$1:00') : 'Z')));
        /* Dạng "...Z" là của Date.toISOString (luôn đúng 3 chữ số phần giây lẻ): giữ SỐ CHỮ SỐ trong nhãn để bắt cách viết khác.
           Dạng có độ lệch múi giờ là chuỗi do Postgres in ra (cắt số 0 cuối, 0 - 6 chữ số tuỳ giá trị) nên không so số chữ số. */
        return '<TS' + sep + (tz === 'Z' ? '.' + (frac ? frac.length - 1 : 0) : '') + (tz || '') + '>';
      })
      .replace(RE_TSVN, '<TSVN>');
  }
  // So 2 chuỗi thô của Node và Go. Trả null nếu giống, hoặc mô tả chỗ khác.
  diff(a, b) {
    this.bindTexts(a, b);
    const ta = [], tb = [];
    const x = this.text('node', a, ta), y = this.text('go', b, tb);
    if (x !== y) {
      let k = 0; while (k < x.length && x[k] === y[k]) k++;
      return { at: k, len: [x.length, y.length], node: x.slice(Math.max(0, k - 120), k + 240), go: y.slice(Math.max(0, k - 120), k + 240) };
    }
    for (let i = 0; i < ta.length; i++) {
      if (Math.abs(ta[i] - tb[i]) > this.tsTol) return { at: -1, len: [x.length, y.length], node: 'mốc thời gian #' + i + ' = ' + new Date(ta[i]).toISOString(), go: 'lệch ' + (tb[i] - ta[i]) + ' ms: ' + new Date(tb[i]).toISOString() };
    }
    return null;
  }
}
module.exports = { Norm, RE_UUID, RE_CODE, codeTime };
