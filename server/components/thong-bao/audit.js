'use strict';
/************************************************************
 * Nhật ký hoạt động (bảng audit_log) — ghi nuốt lỗi, không được làm hỏng nghiệp vụ.
 ************************************************************/
const supa = require('../../libraries/supa');
const { s } = require('../../libraries/utils');

/* ---------- audit ---------- */
async function audit(actor, action, detail, congTyId) {
  try {
    const row = {
      user_id: actor && actor.uid ? actor.uid : null,
      username: actor ? (actor.u || actor.username || '') : '',
      action: String(action || ''), detail: String(detail || '')
    };
    if (congTyId) row.cong_ty_id = congTyId;   // login chạy ngoài ngữ cảnh công ty
    await supa.insert('audit_log', row);
  } catch (e) { /* nhật ký không được làm hỏng nghiệp vụ */ }
}
// Ghi nhật ký hoạt động (bảng audit_log) — nuốt lỗi, không được làm hỏng nghiệp vụ
async function logAudit_(actor, action, detail) {
  try {
    await supa.insert('audit_log', {
      user_id: (actor && actor.uid) || null, username: (actor && (actor.u || actor.username)) || '',
      action: s(action), detail: s(detail)
    });
  } catch (e) { /* nhật ký hỏng không được chặn nghiệp vụ */ }
}
// Lỗi JS phía trình duyệt người dùng: ghi lại để thấy được lỗi vặt thay vì chỉ nằm trong console máy họ
async function logClientError(actor, info) {
  info = info || {};
  const d = ['[' + String(info.tab || '').slice(0, 20) + ']', String(info.msg || '').slice(0, 300),
    info.src ? '@ ' + String(info.src).replace(/^https?:\/\/[^/]+\//, '').slice(0, 120) : ''].filter(Boolean).join(' ');
  console.warn('[lỗi giao diện] ' + ((actor && actor.u) || '?') + ' ' + d);
  await audit(actor, 'loi_giao_dien', d);
  return { ok: true };
}
async function getAuditLog(limit) {
  const rows = await supa.select('audit_log', { order: 'created_at.desc', limit: Math.min(Number(limit) || 200, 1000) });
  return rows.map(function (r) { return { id: r.id, username: r.username, action: r.action, detail: r.detail, at: r.created_at }; });
}

module.exports = { audit, logAudit_, logClientError, getAuditLog };
