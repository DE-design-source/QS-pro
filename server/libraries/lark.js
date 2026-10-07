'use strict';
/************************************************************
 * Lark Open API — chỉ còn TẢI ẢNH cũ (file_token) cho /media và xuất Excel.
 * Ảnh mới lưu trên Supabase Storage (URL http), không đi qua đây.
 ************************************************************/
const config = require('../config');

let _token = null;      // { value, exp } exp = epoch ms hết hạn
async function tenantToken(force) {
  const now = Date.now();
  if (!force && _token && _token.exp - now > 60 * 1000) return _token.value;
  if (!config.larkAppId || !config.larkAppSecret) throw new Error('Thiếu LARK_APP_ID / LARK_APP_SECRET');
  const res = await fetch(config.larkDomain + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: config.larkAppId, app_secret: config.larkAppSecret })
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error('Lấy tenant_access_token lỗi: ' + data.code + ' ' + data.msg);
  _token = { value: data.tenant_access_token, exp: now + (Number(data.expire) || 7200) * 1000 };
  return _token.value;
}

// Trả về { buffer, contentType } của 1 file_token
async function mediaDownload(fileToken) {
  const token = await tenantToken();
  const url = config.larkDomain + '/open-apis/drive/v1/medias/' + encodeURIComponent(fileToken) + '/download';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('Tải media lỗi HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buffer: buf, contentType: res.headers.get('content-type') || 'application/.octet-stream' };
}

module.exports = { mediaDownload };
