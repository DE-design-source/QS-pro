'use strict';
const { n, round0_ } = require('../../libraries/utils');
const { getProjects, getProject } = require('./du-an.repository');
const { getLines } = require('./dong-boc-tach.repository');
const { getProductsCached } = require('../san-pham/san-pham.repository');

/*** ===== DASHBOARD / QUOTE / BOOTSTRAP ===== ***/
async function getQuote(maDA) {
  const lines = await getLines(maDA);
  const proj = await getProject(maDA);
  let subtotal = 0; lines.forEach(function (l) { subtotal += n(l.thanhTienBan); });
  const vatPct = proj ? n(proj.vat) : 0;
  const vat = round0_(subtotal * vatPct / 100);
  return { maDA: maDA, project: proj, lines: lines, subtotal: subtotal, vatPct: vatPct, vat: vat, total: subtotal + vat };
}
async function bootstrap(maDA) {
  // Dùng BẢN CACHE của danh mục SP (5 phút, tự xoá mỗi khi có SP thay đổi):
  // trước đây mỗi lần boot lại kéo toàn bộ ~800 SP + kho chung + yêu thích + combo
  // nên thêm/xoá 1 bản nháp cũng phải chờ cả danh mục tải lại.
  const [projects, products] = await Promise.all([getProjects(), getProductsCached()]);
  let lines = [];
  if (maDA) { try { lines = await getLines(maDA); } catch (e) { lines = []; } }
  const catSheets = getCatalogSheetsFrom_(products);
  return { projects: projects, products: products, lines: lines, catSheets: catSheets, sheetCols: [] };
}
function getCatalogSheetsFrom_(products) {
  const seen = {}, out = [];
  products.forEach(function (p) { if (p.nhom && !seen[p.nhom]) { seen[p.nhom] = 1; out.push(p.nhom); } });
  return out;
}

module.exports = { getQuote, bootstrap };
