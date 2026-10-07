'use strict';
// Điểm khởi động: mở cổng + bật lịch báo cáo. Toàn bộ route nằm ở app.js.
const config = require('./config');
const { app, SWAGGER_ON } = require('./app');

app.listen(config.port, function () {
  console.log('QS Pro chạy tại http://localhost:' + config.port);
  if (SWAGGER_ON) console.log('Swagger UI: http://localhost:' + config.port + '/api-docs');
});
require('./components/bao-cao/bao-cao.job').start();
