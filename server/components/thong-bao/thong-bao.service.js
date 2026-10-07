'use strict';
const supa = require('../../libraries/supa');

/* ---------- Thông báo (notifications) ---------- */
async function getAdmins_() { return (await supa.select('users', { filter: supa.eq('role', 'admin') })).filter(function (u) { return u.active !== false; }); }
async function notify_(userId, kind, title, body, refId) {
  if (!userId) return;
  try { await supa.insert('notifications', { user_id: userId, kind: kind, title: title || '', body: body || '', ref_id: refId || null, is_read: false }); } catch (e) { console.warn('[notify] insert lỗi:', e && e.message); }
}
async function notifCount(actor) {
  const rows = await supa.select('notifications', { select: 'id', filter: supa.eq('user_id', actor.uid) + '&' + supa.eq('is_read', false), limit: 500 });
  return { unread: rows.length };
}
async function notifList(actor, limit) {
  const rows = await supa.select('notifications', { filter: supa.eq('user_id', actor.uid), order: 'created_at.desc', limit: Math.min(Number(limit) || 30, 100) });
  return rows.map(function (n) { return { id: n.id, kind: n.kind, title: n.title, body: n.body, refId: n.ref_id, read: n.is_read !== false ? n.is_read === true : false, at: n.created_at }; });
}
async function notifRead(actor, id) { await supa.update('notifications', supa.eq('id', id) + '&' + supa.eq('user_id', actor.uid), { is_read: true }); return { ok: true }; }
async function notifReadAll(actor) { await supa.update('notifications', supa.eq('user_id', actor.uid) + '&' + supa.eq('is_read', false), { is_read: true }); return { ok: true }; }

module.exports = { getAdmins_, notify_, notifCount, notifList, notifRead, notifReadAll };
