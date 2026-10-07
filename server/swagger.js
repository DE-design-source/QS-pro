'use strict';
/************************************************************
 * Swagger UI cho QS Pro — /api-docs (giao diện) + /api-docs.json (OpenAPI)
 *  - Tài liệu SINH TỰ ĐỘNG từ REGISTRY của server/index.js: thêm hàm vào REGISTRY
 *    là có ngay trên Swagger, không phải viết tay.
 *  - Tên tham số trong "args" đọc từ chữ ký hàm (bỏ "actor" với các hàm ACTOR_FNS).
 ************************************************************/

// Tên tham số của 1 hàm, đọc từ mã nguồn: "async function login(username, password)" -> ['username','password']
function paramNames_(fn) {
  const m = /^[^(]*\(([^)]*)\)/.exec(Function.prototype.toString.call(fn));
  if (!m) return [];
  return m[1].split(',').map(function (s) { return s.split('=')[0].replace(/^\s*\.\.\./, '').trim(); }).filter(Boolean);
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ERR = { type: 'object', properties: { error: { type: 'string' }, code: { type: 'string' } } };
function errRes_(desc) { return { description: desc, content: { 'application/json': { schema: ERR } } }; }
function xlsxRes_(desc) { return { description: desc, content: { [XLSX]: { schema: { type: 'string', format: 'binary' } } } }; }
function jsonBody_(schema, example) {
  const c = { schema: schema }; if (example !== undefined) c.example = example;
  return { required: true, content: { 'application/json': c } };
}

// Các route nằm ngoài /api/:fn (khai tay vì không có trong REGISTRY)
function otherPaths_() {
  const T = ['Xuất / tải file'];
  const auth401 = { 401: errRes_('Chưa đăng nhập') };
  return {
    '/export/cong-tac': { post: { tags: T, summary: 'Xuất Excel danh sách công tác xây dựng',
      requestBody: jsonBody_({ type: 'object', properties: { rows: { type: 'array', items: { type: 'object' } } } }, { rows: [] }),
      responses: Object.assign({ 200: xlsxRes_('File .xlsx'), 400: errRes_('Không có dòng nào để xuất') }, auth401) } },
    '/export/san-pham': { post: { tags: T, summary: 'Xuất Excel danh sách sản phẩm (keys = null -> tất cả)',
      requestBody: jsonBody_({ type: 'object', properties: { keys: { type: 'array', items: { type: 'string' }, nullable: true } } }, { keys: null }),
      responses: Object.assign({ 200: xlsxRes_('File .xlsx') }, auth401) } },
    '/export/bang': { post: { tags: T, summary: 'Xuất 1 bảng do client dựng sẵn ra Excel',
      requestBody: jsonBody_({ type: 'object', properties: {
        ten: { type: 'string' }, sheet: { type: 'string' },
        cols: { type: 'array', items: { type: 'object' } }, rows: { type: 'array', items: { type: 'object' } },
        tong: { type: 'array', items: { type: 'array', items: {} } } } },
        { ten: 'Bảng', sheet: 'Sheet1', cols: [{ label: 'Tên' }, { label: 'Số lượng', num: true }], rows: [{ cells: ['A', 1] }], tong: [] }),
      responses: Object.assign({ 200: xlsxRes_('File .xlsx'), 400: errRes_('Không có cột nào để xuất') }, auth401) } },
    '/upload/file': { post: { tags: T, summary: 'Tải file tài liệu dạng nhị phân (body = nội dung file)',
      parameters: [{ name: 'name', in: 'query', description: 'Tên file gốc', schema: { type: 'string' } }],
      requestBody: { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
      responses: Object.assign({ 200: { description: 'Thông tin file đã lưu', content: { 'application/json': { schema: { type: 'object' } } } },
        400: errRes_('Lỗi tải file'), 413: errRes_('File quá lớn') }, auth401) } },
    '/media': { get: { tags: T, summary: 'Proxy ảnh attachment cũ lưu trên Lark', security: [],
      parameters: [{ name: 'token', in: 'query', required: true, description: 'file_token của Lark', schema: { type: 'string' } }],
      responses: { 200: { description: 'Nội dung ảnh' }, 400: { description: 'Thiếu token' }, 502: { description: 'Không tải được ảnh' } } } },
    '/mau-nhap-thiet-bi-ve-sinh.xlsx': { get: { tags: T, summary: 'File mẫu nhập hàng loạt Thiết bị vệ sinh', security: [],
      responses: { 200: xlsxRes_('File mẫu .xlsx') } } },
    '/mau-nhap-son-nuoc.xlsx': { get: { tags: T, summary: 'File mẫu nhập hàng loạt Sơn nước', security: [],
      parameters: [{ name: 'hm', in: 'query', description: 'Hạng mục (bỏ trống = mẫu chung)', schema: { type: 'string' } }],
      responses: { 200: xlsxRes_('File mẫu .xlsx') } } },
    '/healthz': { get: { tags: ['Hệ thống'], summary: 'Kiểm tra server còn sống', security: [],
      responses: { 200: { description: 'OK', content: { 'application/json': { example: { ok: true } } } } } } }
  };
}

// o = { REGISTRY, PUBLIC_FNS, ACTOR_FNS, ADMIN_FNS, SUPER_FNS }
function buildSpec(o) {
  const paths = {};
  Object.keys(o.REGISTRY).forEach(function (fn) {
    let names = paramNames_(o.REGISTRY[fn]);
    if (o.ACTOR_FNS.has(fn)) names = names.slice(1);       // "actor" do server tự chèn, client không gửi
    const isPublic = o.PUBLIC_FNS.has(fn);
    const quyen = isPublic ? 'Công khai (không cần đăng nhập)'
      : o.SUPER_FNS.has(fn) ? 'Chỉ quản trị hệ thống (super)'
      : o.ADMIN_FNS.has(fn) ? 'Chỉ Admin'
      : 'Đã đăng nhập';
    const op = {
      tags: [quyen],
      summary: fn + '(' + names.join(', ') + ')',
      description: 'Quyền: **' + quyen + '**\n\nTham số truyền theo đúng thứ tự trong mảng `args`: ' +
        (names.length ? names.map(function (n) { return '`' + n + '`'; }).join(', ') : '_(không có)_'),
      operationId: fn,
      requestBody: jsonBody_(
        { type: 'object', required: ['args'], properties: { args: { type: 'array', items: {}, description: 'Tham số của hàm, theo thứ tự' } } },
        { args: names.map(function (n) { return '<' + n + '>'; }) }),
      responses: {
        200: { description: 'Thành công', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, result: {} } } } } },
        401: errRes_('Chưa đăng nhập'),
        403: errRes_('Không có quyền'),
        500: errRes_('Lỗi nghiệp vụ / máy chủ')
      }
    };
    if (isPublic) op.security = [];
    paths['/api/' + fn] = { post: op };
  });
  return {
    openapi: '3.0.3',
    info: {
      title: 'QS Pro API',
      version: require('../package.json').version,
      description: 'Mọi hàm nghiệp vụ gọi qua `POST /api/{tên hàm}` với body `{"args":[...]}`.\n\n' +
        '**Cách dùng:** gọi `login` -> chép token trong kết quả -> bấm **Authorize** -> dán token.\n\n' +
        'Tài khoản super có thể thêm header `x-view-company` để xem như một công ty.'
    },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    security: [{ bearerAuth: [] }],
    paths: Object.assign(paths, otherPaths_())
  };
}

function mount(app, o) {
  const swaggerUi = require('swagger-ui-express');
  app.get('/api-docs.json', function (req, res) { res.json(buildSpec(o)); });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
    customSiteTitle: 'QS Pro API',
    swaggerOptions: { url: '/api-docs.json', persistAuthorization: true, filter: true, docExpansion: 'none', tryItOutEnabled: true }
  }));
}

module.exports = { mount, buildSpec };
