'use strict';
/************************************************************
 * NGỮ CẢNH CÔNG TY (multi-tenant) — theo từng request.
 * Dùng AsyncLocalStorage nên KHÔNG phải sửa chữ ký mọi hàm,
 * và không bị lẫn dữ liệu giữa các request chạy song song.
 ************************************************************/
const { AsyncLocalStorage } = require('async_hooks');
const als = new AsyncLocalStorage();

// Chạy 1 handler trong ngữ cảnh của công ty
function run(ctx, fn) { return als.run(ctx || {}, fn); }
function ctx() { return als.getStore() || {}; }

// Công ty hiện hành: super admin có thể "xem như" 1 công ty (viewAs)
function tenantId() { const c = ctx(); return c.viewAs || c.congTyId || null; }
function isSuper() { return ctx().role === 'super'; }
function isAdmin() { const r = ctx().role; return r === 'admin' || r === 'super'; }
function uid() { return ctx().uid || null; }

// Có áp bộ lọc công ty không?
//  - Không có ngữ cảnh (vd đang login)  -> KHÔNG lọc
//  - Super admin chưa chọn công ty nào  -> KHÔNG lọc (thấy toàn hệ thống)
//  - Còn lại                            -> lọc theo công ty
function scoped() { return !!tenantId(); }

module.exports = { run, ctx, tenantId, isSuper, isAdmin, uid, scoped };
