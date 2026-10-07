'use strict';
/************************************************************
 * QS PRO – Express app
 *  - Phục vụ giao diện public/index.html
 *  - POST /api/:fn  -> gọi hàm nghiệp vụ tương ứng (libraries/rpc.js)
 *  - Route lẻ (/export/*, /upload/file, /media, file mẫu) nằm trong components/<domain>/<domain>.routes.js
 ************************************************************/
const path = require('path');
const express = require('express');
const rpc = require('./libraries/rpc');

// Mỗi domain 1 file routes: phần /api/:fn của nó (fns + quyền) và router Express nếu có route lẻ
const ROUTES = [
  require('./components/auth/auth.routes'),
  require('./components/users/users.routes'),
  require('./components/cong-ty/cong-ty.routes'),
  require('./components/thong-bao/thong-bao.routes'),
  require('./components/san-pham/san-pham.routes'),
  require('./components/du-an/du-an.routes'),
  require('./components/cong-tac/cong-tac.routes'),
  require('./components/mua-hang/mua-hang.routes'),
  require('./components/bao-cao/bao-cao.routes'),
  require('./components/xuat-file/xuat-file.routes'),
  require('./components/tep-tin/tep-tin.routes')
];

const app = express();
app.use(express.json({ limit: '30mb' }));
// Thư viện bảng tính (MIT) lấy từ node_modules — không phụ thuộc CDN bên ngoài
app.use('/vendor/jspreadsheet', express.static(path.join(__dirname, '..', 'node_modules', 'jspreadsheet-ce', 'dist'), { maxAge: '7d' }));
app.use('/vendor/formula', express.static(path.join(__dirname, '..', 'node_modules', '@jspreadsheet', 'formula', 'dist'), { maxAge: '7d' }));
app.use('/vendor/jsuites', express.static(path.join(__dirname, '..', 'node_modules', 'jsuites', 'dist'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: function (res, filePath) {
    // HTML/JS/CSS luôn revalidate -> deploy mới là trình duyệt lấy ngay (không kẹt cache cũ)
    if (/\.(html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  }
}));

const reg = rpc.gom(ROUTES);
rpc.mount(app, reg);
ROUTES.forEach(function (r) { if (r.router) app.use(r.router); });

app.get('/healthz', function (req, res) { res.json({ ok: true }); });

// Swagger UI (/api-docs): mặc định chỉ bật khi chạy ở máy dev; muốn bật trên server thật thì đặt SWAGGER=1
const SWAGGER_ON = process.env.SWAGGER === '1' ||
  (process.env.SWAGGER !== '0' && process.env.NODE_ENV !== 'production' && !process.env.RENDER);
if (SWAGGER_ON) {
  require('./libraries/swagger').mount(app, reg);
}

module.exports = { app, reg, SWAGGER_ON };
