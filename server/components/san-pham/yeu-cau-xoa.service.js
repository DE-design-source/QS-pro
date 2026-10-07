'use strict';
const supa = require('../../libraries/supa');
const { getUserById } = require('../users/users.repository');
const { getAdmins_, notify_ } = require('../thong-bao/thong-bao.service');
const { audit } = require('../thong-bao/audit');
const repo = require('./san-pham.repository');   // để xóa sản phẩm khi admin duyệt yêu cầu

/* ---------- Yêu cầu xóa sản phẩm (duyệt bởi admin) ---------- */
function parseItems_(s) { try { return JSON.parse(s || '[]') || []; } catch (e) { return []; } }
async function requestDeleteProducts(actor, items) {
  items = (Array.isArray(items) ? items : []).map(function (it) { return { maSP: String(it.maSP || it.ma || ''), id: it.id ? String(it.id) : '', ten: String(it.ten || '') }; }).filter(function (it) { return it.maSP; });
  if (!items.length) throw new Error('Chưa chọn sản phẩm hợp lệ');
  const me = await getUserById(actor.uid);
  const who = me ? (me.ho_ten || me.username) : actor.u;
  const req = (await supa.insert('delete_requests', { requester_id: actor.uid, requester_name: who, items: JSON.stringify(items), status: 'pending' }))[0];
  const admins = await getAdmins_();
  for (var i = 0; i < admins.length; i++) await notify_(admins[i].id, 'delete_request', 'Yêu cầu xóa sản phẩm', who + ' yêu cầu xóa ' + items.length + ' sản phẩm', req.id);
  await audit(actor, 'request_delete', who + ' yêu cầu xóa ' + items.length + ' SP');
  return { ok: true, count: items.length };
}
async function listDeleteRequests(actor) {
  const rows = await supa.select('delete_requests', { order: 'created_at.desc', limit: 200 });
  return rows.map(function (r) { return { id: r.id, requester: r.requester_name, items: parseItems_(r.items), status: r.status, at: r.created_at, resolvedAt: r.resolved_at, resolver: r.resolver_name }; });
}
async function resolveDeleteRequest(actor, id, approve) {
  const r = (await supa.select('delete_requests', { filter: supa.eq('id', id), limit: 1 }))[0];
  if (!r) throw new Error('Không tìm thấy yêu cầu');
  if (r.status !== 'pending') throw new Error('Yêu cầu đã được xử lý');
  const items = parseItems_(r.items);
  const me = await getUserById(actor.uid);
  const resolver = me ? (me.ho_ten || me.username) : actor.u;
  const now = new Date().toISOString();
  const claim = await supa.update('delete_requests', supa.eq('id', id) + '&status=eq.pending',
    { status: approve ? 'approved' : 'rejected', resolver_name: resolver, resolved_at: now });
  if (!claim || !claim.length) throw new Error('Yêu cầu đã được xử lý');
  if (approve) {
    var deleted = 0;
    var loiXoa = '';
    // xoá theo id dòng = đúng biến thể người gửi chọn (theo mã thì xoá nhầm biến thể có id nhỏ nhất)
    for (var i = 0; i < items.length; i++) { try { await repo.deleteDbProduct(actor, items[i].id || items[i].maSP); deleted++; } catch (e) { loiXoa = loiXoa || (e && e.message) || ''; } }
    await notify_(r.requester_id, 'delete_approved', 'Yêu cầu xóa đã được duyệt', 'Đã xóa ' + deleted + '/' + items.length + ' sản phẩm bạn yêu cầu', r.id);
    await audit(actor, 'approve_delete', 'Duyệt xóa ' + deleted + ' SP (yêu cầu #' + id + ' của ' + r.requester_name + ')');
    return { ok: true, deleted: deleted, loi: loiXoa };
  } else {
    await notify_(r.requester_id, 'delete_rejected', 'Yêu cầu xóa bị từ chối', 'Yêu cầu xóa ' + items.length + ' sản phẩm không được duyệt', r.id);
    await audit(actor, 'reject_delete', 'Từ chối yêu cầu xóa #' + id);
    return { ok: true };
  }
}

module.exports = { requestDeleteProducts, listDeleteRequests, resolveDeleteRequest };
