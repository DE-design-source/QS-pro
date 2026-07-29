'use strict';
/************************************************************
 * npm run introspect
 * In cấu trúc Base + field của bảng Danh mục sản phẩm và vài record mẫu,
 * để chốt việc ánh xạ tên cột trước khi build tầng nghiệp vụ.
 ************************************************************/
const config = require('./config');
const lark = require('./lark');

const FIELD_TYPE_NAME = {
  1: 'Text', 2: 'Number', 3: 'SingleSelect', 4: 'MultiSelect', 5: 'DateTime',
  7: 'Checkbox', 11: 'User', 13: 'Phone', 15: 'Url', 17: 'Attachment',
  18: 'Link', 19: 'Lookup', 20: 'Formula', 21: 'DuplexLink', 22: 'Location',
  23: 'GroupChat', 1001: 'CreatedTime', 1002: 'ModifiedTime', 1003: 'CreatedUser',
  1004: 'ModifiedUser', 1005: 'AutoNumber'
};

function short(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v).slice(0, 60);
}

(async function () {
  try {
    config.assertCredentials();
    console.log('Domain     :', config.domain);
    console.log('App token  :', config.appToken);
    console.log('Products tbl:', config.tables.products || '(chưa cấu hình)');
    console.log('');

    console.log('=== Danh sách bảng trong Base ===');
    const tables = await lark.listTables();
    tables.forEach(function (t) { console.log(' -', t.table_id, '|', t.name); });
    console.log('');

    const prodTbl = config.tables.products;
    if (!prodTbl) { console.log('Chưa có LARK_TBL_PRODUCTS -> bỏ qua phần field.'); return; }

    console.log('=== Field bảng sản phẩm (' + prodTbl + ') ===');
    const fields = await lark.listFields(prodTbl);
    fields.forEach(function (f) {
      console.log('  •', JSON.stringify(f.field_name), '  [' + (FIELD_TYPE_NAME[f.type] || f.type) + ']');
    });
    console.log('');

    console.log('=== 3 record mẫu ===');
    const recs = await lark.listRecords(prodTbl, { pageSize: 3 });
    recs.slice(0, 3).forEach(function (r, i) {
      console.log('--- record #' + (i + 1) + ' (id ' + r.record_id + ') ---');
      Object.keys(r.fields).forEach(function (k) {
        console.log('    ' + k + ': ' + short(r.fields[k]));
      });
    });
    console.log('\nTổng số record đọc thử:', recs.length);
  } catch (e) {
    console.error('LỖI:', e.message);
    process.exit(1);
  }
})();
