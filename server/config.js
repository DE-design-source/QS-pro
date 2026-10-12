'use strict';
require('dotenv').config();

// Dữ liệu nằm trên PostgreSQL (server/supa.js, biến DATABASE_URL). Lark chỉ còn dùng để tải ảnh cũ qua /media.
module.exports = {
  port: Number(process.env.PORT) || 3000,
  larkDomain: (process.env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/+$/, ''),
  larkAppId: process.env.LARK_APP_ID || '',
  larkAppSecret: process.env.LARK_APP_SECRET || ''
};
