'use strict';
/* Kiểm tra chính bộ so sánh: route không cần đăng nhập, và một file .xlsx thật (để chắc phép so xlsx chạy được). */
module.exports = {
  name: '00 harness: healthz + file mẫu xlsx',
  async run(h) {
    await h.raw('GET /healthz', { method: 'GET', path: '/healthz' });
    await h.raw('GET /mau-nhap-thiet-bi-ve-sinh.xlsx', { method: 'GET', path: '/mau-nhap-thiet-bi-ve-sinh.xlsx' });
  },
};
