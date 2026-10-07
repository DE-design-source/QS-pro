'use strict';
// Tải ảnh / tài liệu lên kho Supabase Storage
const supa = require('../../libraries/supa');
const { s } = require('../../libraries/utils');

async function uploadImage(base64, fileName) {
  const raw = s(base64).replace(/^data:([^;]+);base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) throw new Error('Ảnh rỗng.');
  const m = /^data:([^;]+);base64,/.exec(s(base64)); const ct = m ? m[1] : 'image/jpeg';
  const ext = (ct.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const path = 'sp/' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.' + ext;
  const url = await supa.uploadToStorage(buf, path, ct);
  return { token: url, url: url };
}

// Tải FILE tài liệu (PDF, bản vẽ DWG/DXF, ảnh, ZIP…) lên kho — giữ đuôi & tên gốc để người xem nhận ra
const DOC_EXT = /^(pdf|png|jpe?g|webp|gif|dwg|dxf|skp|zip|rar|7z|docx?|xlsx?|pptx?)$/i;
const DOC_MAX_MB = 50;                      // = giới hạn 1 file của Supabase Storage (gói free)
// Bản cũ (base64 qua /api/uploadFile) — GIỮ cho tab mở từ trước khi deploy vẫn chạy (xoá là tab cũ báo lỗi)
async function uploadFile(base64, fileName) {
  const m = /^data:([^;]*);base64,/.exec(s(base64));
  return uploadFileBuf(Buffer.from(s(base64).replace(/^data:[^;]*;base64,/, ''), 'base64'), fileName, m && m[1]);
}
// Nhận file NHỊ PHÂN (route /upload/file) — không qua base64 nên file lớn không bị phình 33%
async function uploadFileBuf(buf, fileName, contentType) {
  if (!buf || !buf.length) throw new Error('File rỗng.');
  if (buf.length > DOC_MAX_MB * 1024 * 1024)
    throw new Error('File ' + (buf.length / 1048576).toFixed(1) + 'MB quá lớn (tối đa ' + DOC_MAX_MB + 'MB) — hãy dán link thay vì tải lên.');
  const ten = s(fileName).split(/[\\/]/).pop() || 'tai-lieu';
  const ext = (ten.split('.').pop() || '').toLowerCase();
  if (!DOC_EXT.test(ext)) throw new Error('Định dạng .' + ext + ' chưa hỗ trợ (PDF, ảnh, DWG/DXF, SKP, ZIP/RAR, Word, Excel).');
  const goc = ten.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tai-lieu';
  const path = 'docs/' + Date.now() + '-' + goc + '.' + ext;
  let url;
  try { url = await supa.uploadToStorage(buf, path, contentType || 'application/octet-stream'); }
  catch (e) {
    if (/\b413\b|too large|maximum allowed size/i.test(e.message || ''))
      throw new Error('Kho file từ chối: file ' + (buf.length / 1048576).toFixed(1) + 'MB vượt giới hạn — hãy dán link thay vì tải lên.');
    throw e;
  }
  return { url: url, name: ten };
}

module.exports = { uploadImage, uploadFile, uploadFileBuf, DOC_MAX_MB };
