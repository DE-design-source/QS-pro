'use strict';
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const TABLES_FILE = path.join(__dirname, 'tables.local.json');

// Đọc bảng đã được app tự tạo (ghi ở lần setup đầu tiên)
function readSavedTables() {
  try { return JSON.parse(fs.readFileSync(TABLES_FILE, 'utf8')); } catch (e) { return {}; }
}
function saveTables(obj) {
  try { fs.writeFileSync(TABLES_FILE, JSON.stringify(obj, null, 2)); } catch (e) {}
}

const saved = readSavedTables();

const config = {
  domain: (process.env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/+$/, ''),
  appId: process.env.LARK_APP_ID || '',
  appSecret: process.env.LARK_APP_SECRET || '',
  appToken: process.env.LARK_APP_TOKEN || '',
  port: Number(process.env.PORT) || 3000,
  tables: {
    products: process.env.LARK_TBL_PRODUCTS || saved.products || '',
    projects: process.env.LARK_TBL_PROJECTS || saved.projects || '',
    lines: process.env.LARK_TBL_LINES || saved.lines || '',
    cover: process.env.LARK_TBL_COVER || saved.cover || ''
  }
};

// Cập nhật id bảng vừa tạo vào bộ nhớ + đĩa
config.setTable = function (key, id) {
  config.tables[key] = id;
  const cur = readSavedTables();
  cur[key] = id;
  saveTables(cur);
};

config.assertCredentials = function () {
  if (!config.appId || !config.appSecret) {
    throw new Error('Thiếu LARK_APP_ID / LARK_APP_SECRET trong .env');
  }
  if (!config.appToken) throw new Error('Thiếu LARK_APP_TOKEN (app_token của Base) trong .env');
};

module.exports = config;
