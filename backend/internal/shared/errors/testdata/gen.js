'use strict';
// Sinh colerr.json từ MÃ NODE THẬT: cắt nguyên văn HD_MIG / COL_SQL / colErr_ / khongCoCha_ / DA_MAT / s
// khỏi server/store_supa.js rồi chạy (không nạp supa.js nên không đụng database).
//   node backend/internal/shared/errors/testdata/gen.js > backend/internal/shared/errors/testdata/colerr.json
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../../../..');
const VS = require(path.join(root, 'backend/internal/shared/specs/js/vs-spec.js'));
const SON = require(path.join(root, 'backend/internal/shared/specs/js/son-spec.js'));
const CT = require(path.join(root, 'backend/internal/shared/specs/js/ct-spec.js'));
const src = fs.readFileSync(path.join(root, 'server/store_supa.js'), 'utf8');
function cut(from, to) {
  const a = src.indexOf(from); if (a < 0) throw new Error('không thấy: ' + from);
  const b = src.indexOf(to, a); if (b < 0) throw new Error('không thấy: ' + to);
  return src.slice(a, b);
}
const code = cut('const HD_MIG =', '// Chưa chạy db/sp_nguoi_tao.sql') +
  cut('function khongCoCha_(e)', 'async function getProjData') +
  cut('function s(v)', 'function nowIso()') +
  '\nreturn { HD_MIG, COL_SQL, colErr_, khongCoCha_, DA_MAT, s };';
const m = new Function('VS', 'SON', 'CT', code)(VS, SON, CT);

const cols = Object.keys(m.COL_SQL);
const msgs = [];
cols.forEach(function (c) {
  msgs.push('DB POST db_san_pham -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'' + c + '\' column of \'db_san_pham\' in the schema cache"}');
});
[
  '',
  'DB PATCH db_san_pham -> 400 {"code":"42703","details":null,"hint":null,"message":"column \\"nganh\\" of relation \\"db_san_pham\\" does not exist"}',
  'DB PATCH du_an -> 400 {"code":"42703","message":"COLUMN \\"link_dezon\\" does not exist"}',
  'DB PATCH du_an -> 400 {"code":"PGRST204","message":"Could not find the \'link_dezon\' in the SCHEMA CACHE"}',
  'DB PATCH du_an -> 400 {"code":"PGRST204","message":"Could not find link_dezon in the schema  cache"}',
  'thiếu nganh nhưng không có từ khoá',
  'column tinh_nang và kich_thuoc và nganh',
  'column file_ban_ve, ten_chip_led',
  'column ' + cols[cols.length - 1] + ' ' + cols[0],
  'column ' + cols[cols.length - 1] + ' ' + cols[25],
  'column khong_co_trong_danh_sach does not exist',
  'DB POST db_bao_gia -> 409 {"code":"23503","message":"insert or update on table \\"db_bao_gia\\" violates foreign key constraint"}',
  'columns: xnganhx',
  'Column luu_y',
  'schema cache thiet_ke_abc',
  'DB POST cong_tac -> 400 {"code":"PGRST204","message":"Could not find the \'yeu_thich\' column of \'cong_tac\' in the schema cache"}'
].forEach(function (x) { msgs.push(x); });

const fk = [
  '', '23503', 'x 23503 y', '"code":"23503"', 'a23503', '23503b', '_23503', '123503', '235030', '23503.', '-23503-', 'é23503é',
  'DB POST db_bao_gia -> 409 {"code":"23503","details":"Key (ma_du_an)=(X) is not present in table \\"du_an\\".","message":"insert or update on table \\"db_bao_gia\\" violates foreign key constraint \\"db_bao_gia_ma_du_an_fkey\\""}',
  'DB POST db_bao_gia -> 409 {"code":"23505"}'
];

process.stdout.write(JSON.stringify({
  hdMig: m.HD_MIG,
  daMat: m.DA_MAT,
  cols: cols,
  colErr: msgs.map(function (x) { const e = new Error(x); const r = m.colErr_(e); return { in: x, out: r.message, same: r === e }; }),
  khongCoCha: fk.map(function (x) { return { in: x, out: m.khongCoCha_(new Error(x)) }; }),
  s: [m.s(null), m.s(undefined), m.s(''), m.s(0), m.s(-0), m.s(false), m.s(true), m.s(12.5), m.s(1e21), m.s(1e-7), m.s(0.1 + 0.2),
    m.s(NaN), m.s(Infinity), m.s('abc'), m.s([1, null, 'a']), m.s({}), m.s([]), m.s(123456789012345680000)]
}, null, 1) + '\n');
