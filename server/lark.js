'use strict';
/************************************************************
 * Lark (Feishu/Lark Suite) Open API client
 * - Cache tenant_access_token
 * - CRUD bản ghi Bitable (có phân trang, batch)
 * - List/Create table & field
 * - Tải media (ảnh attachment)
 ************************************************************/
const config = require('./config');

const BASE = () => config.domain;

/*** ===== TOKEN ===== ***/
let _token = null;      // { value, exp } exp = epoch ms hết hạn
async function tenantToken(force) {
  const now = Date.now();
  if (!force && _token && _token.exp - now > 60 * 1000) return _token.value;
  config.assertCredentials();
  const res = await fetch(BASE() + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret })
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error('Lấy tenant_access_token lỗi: ' + data.code + ' ' + data.msg);
  _token = { value: data.tenant_access_token, exp: now + (Number(data.expire) || 7200) * 1000 };
  return _token.value;
}

/*** ===== HTTP ===== ***/
// Gọi API Lark; tự refresh token 1 lần khi gặp lỗi token (99991663/99991661/401)
async function call(method, apiPath, { query, body } = {}, _retried) {
  const token = await tenantToken();
  let url = BASE() + apiPath;
  if (query) {
    const qs = Object.keys(query)
      .filter(function (k) { return query[k] !== undefined && query[k] !== null && query[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); })
      .join('&');
    if (qs) url += (url.indexOf('?') > -1 ? '&' : '?') + qs;
  }
  const opts = { method: method, headers: { Authorization: 'Bearer ' + token } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json; charset=utf-8';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  if (ct.indexOf('application/json') === -1) {
    // media/tệp nhị phân
    return { _raw: res };
  }
  const data = await res.json();
  if (data.code === 99991663 || data.code === 99991661 || res.status === 401) {
    if (!_retried) { await tenantToken(true); return call(method, apiPath, { query, body }, true); }
  }
  if (data.code !== 0) {
    const err = new Error('Lark API ' + method + ' ' + apiPath + ' -> ' + data.code + ' ' + data.msg);
    err.code = data.code;
    throw err;
  }
  return data.data;
}

/*** ===== BITABLE: RECORDS ===== ***/
// Lấy toàn bộ record (gộp phân trang). filter theo cú pháp Lark FilterInfo (tuỳ chọn).
async function listRecords(tableId, { filter, pageSize } = {}) {
  const out = [];
  let pageToken = '';
  const app = config.appToken;
  do {
    const query = { page_size: Math.min(pageSize || 500, 500) };
    if (pageToken) query.page_token = pageToken;
    if (filter) query.filter = filter;
    const data = await call('GET',
      '/open-apis/bitable/v1/apps/' + app + '/tables/' + tableId + '/records', { query });
    (data.items || []).forEach(function (it) { out.push(it); });
    pageToken = data.has_more ? data.page_token : '';
  } while (pageToken);
  return out;
}

// Tìm bản ghi theo điều kiện (POST search) — dùng lọc dòng theo Mã DA cho nhẹ payload
async function searchRecords(tableId, conditions, conjunction) {
  const out = [];
  let pageToken = '';
  const app = config.appToken;
  const body = { filter: { conjunction: conjunction || 'and', conditions: conditions || [] } };
  do {
    const query = { page_size: 500 };
    if (pageToken) query.page_token = pageToken;
    const data = await call('POST',
      '/open-apis/bitable/v1/apps/' + app + '/tables/' + tableId + '/records/search',
      { query, body });
    (data.items || []).forEach(function (it) { out.push(it); });
    pageToken = data.has_more ? data.page_token : '';
  } while (pageToken);
  return out;
}
// Lọc theo 1 field = 1 giá trị
function findByField(tableId, fieldName, value) {
  return searchRecords(tableId, [{ field_name: fieldName, operator: 'is', value: [String(value)] }]);
}
function getRecord(tableId, recordId) {
  return call('GET',
    '/open-apis/bitable/v1/apps/' + config.appToken + '/tables/' + tableId + '/records/' + recordId, {})
    .then(function (d) { return d.record; });
}

function createRecord(tableId, fields) {
  return call('POST',
    '/open-apis/bitable/v1/apps/' + config.appToken + '/tables/' + tableId + '/records',
    { body: { fields: fields } }).then(function (d) { return d.record; });
}
function updateRecord(tableId, recordId, fields) {
  return call('PUT',
    '/open-apis/bitable/v1/apps/' + config.appToken + '/tables/' + tableId + '/records/' + recordId,
    { body: { fields: fields } }).then(function (d) { return d.record; });
}
function deleteRecord(tableId, recordId) {
  return call('DELETE',
    '/open-apis/bitable/v1/apps/' + config.appToken + '/tables/' + tableId + '/records/' + recordId, {});
}
// Batch (mỗi lần tối đa 500 record theo giới hạn Lark)
async function batchCreate(tableId, recordsFields) {
  const app = config.appToken;
  for (var i = 0; i < recordsFields.length; i += 500) {
    const chunk = recordsFields.slice(i, i + 500).map(function (f) { return { fields: f }; });
    await call('POST',
      '/open-apis/bitable/v1/apps/' + app + '/tables/' + tableId + '/records/batch_create',
      { body: { records: chunk } });
  }
}
async function batchDelete(tableId, recordIds) {
  const app = config.appToken;
  for (var i = 0; i < recordIds.length; i += 500) {
    const chunk = recordIds.slice(i, i + 500);
    if (!chunk.length) continue;
    await call('POST',
      '/open-apis/bitable/v1/apps/' + app + '/tables/' + tableId + '/records/batch_delete',
      { body: { records: chunk } });
  }
}

/*** ===== BITABLE: TABLES & FIELDS ===== ***/
async function listTables() {
  const out = [];
  let pageToken = '';
  do {
    const query = { page_size: 100 };
    if (pageToken) query.page_token = pageToken;
    const data = await call('GET', '/open-apis/bitable/v1/apps/' + config.appToken + '/tables', { query });
    (data.items || []).forEach(function (it) { out.push(it); });
    pageToken = data.has_more ? data.page_token : '';
  } while (pageToken);
  return out;
}
async function listFields(tableId) {
  const out = [];
  let pageToken = '';
  do {
    const query = { page_size: 100 };
    if (pageToken) query.page_token = pageToken;
    const data = await call('GET',
      '/open-apis/bitable/v1/apps/' + config.appToken + '/tables/' + tableId + '/fields', { query });
    (data.items || []).forEach(function (it) { out.push(it); });
    pageToken = data.has_more ? data.page_token : '';
  } while (pageToken);
  return out;
}
// fields: [{ field_name, type }]  (type: 1 text, 2 number, 17 attachment, ...)
function createTable(name, fields) {
  return call('POST', '/open-apis/bitable/v1/apps/' + config.appToken + '/tables',
    { body: { table: { name: name, default_view_name: 'Grid', fields: fields } } });
}

/*** ===== MEDIA (ảnh attachment) ===== ***/
// Trả về { buffer, contentType } của 1 file_token
async function mediaDownload(fileToken) {
  const token = await tenantToken();
  const url = BASE() + '/open-apis/drive/v1/medias/' + encodeURIComponent(fileToken) + '/download';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('Tải media lỗi HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buffer: buf, contentType: res.headers.get('content-type') || 'application/octet-stream' };
}

module.exports = {
  tenantToken, call, listRecords, searchRecords, findByField, getRecord,
  createRecord, updateRecord, deleteRecord,
  batchCreate, batchDelete, listTables, listFields, createTable, mediaDownload,
  FieldType: { TEXT: 1, NUMBER: 2, SINGLE_SELECT: 3, DATETIME: 5, ATTACHMENT: 17, AUTO_NUMBER: 1005 }
};
