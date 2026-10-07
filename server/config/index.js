'use strict';
require('dotenv').config();

// Webhook Lark (bot incoming webhook) nhận yêu cầu mua hàng / đề xuất
const purchaseWebhook = process.env.PURCHASE_WEBHOOK ||
  'https://open.larksuite.com/open-apis/bot/v2/hook/865751f9-d3e8-4e8e-9b4e-e0fa53ef4698';

// Dữ liệu nằm trên Supabase (libraries/supa.js). Lark chỉ còn dùng để tải ảnh cũ qua /media.
module.exports = {
  port: Number(process.env.PORT) || 3000,
  larkDomain: (process.env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/+$/, ''),
  larkAppId: process.env.LARK_APP_ID || '',
  larkAppSecret: process.env.LARK_APP_SECRET || '',
  purchaseWebhook: purchaseWebhook,
  // Webhook riêng cho báo cáo nhập SP; chưa đặt thì dùng chung webhook yêu cầu mua hàng
  reportWebhook: process.env.REPORT_WEBHOOK || purchaseWebhook
};
