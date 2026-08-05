'use strict';
/**
 * Gửi thông báo "đã deploy" lên webhook bot Lark mỗi khi server khởi động
 * sau một lần build trên Render. Nội dung = commit vừa deploy (đã sửa gì).
 *
 * - Chỉ gửi khi chạy trên Render (RENDER=true) để không spam lúc chạy local.
 *   Muốn test thủ công: đặt BUILD_NOTIFY=1.
 * - Webhook lấy từ env LARK_BUILD_WEBHOOK (có sẵn giá trị mặc định bên dưới).
 */
const fs = require('fs');
const path = require('path');

const WEBHOOK = process.env.LARK_BUILD_WEBHOOK ||
  'https://open.larksuite.com/open-apis/bot/v2/hook/da87d0e4-648f-4106-83a0-21c87f7eb136';

function readInfo() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'build-info.json'), 'utf8')); }
  catch (e) { return {}; }
}

function nowVN() {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date());
  } catch (e) { return new Date().toISOString(); }
}

async function sendBuildNotice() {
  const forced = process.env.BUILD_NOTIFY === '1';
  if (!forced && String(process.env.RENDER) !== 'true') return;   // bỏ qua khi chạy local
  if (!WEBHOOK) return;

  const info = readInfo();
  const subject = info.subject || 'Deploy mới';
  const body = (info.body || '').trim();
  const files = (info.files || []).slice(0, 12);

  const lines = [];
  lines.push('**📝 Thay đổi:** ' + subject);
  if (body) lines.push(body);
  if (files.length) lines.push('**Tệp:** ' + files.map(function (f) { return '`' + f + '`'; }).join(', '));
  lines.push('**Commit:** `' + (info.sha || '?') + '`  •  **Nhánh:** ' + (info.branch || 'main'));
  lines.push('**🕒 ' + nowVN() + ' (giờ VN)**');

  const payload = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: { template: 'green', title: { tag: 'plain_text', content: '🚀 QS Pro đã deploy xong' } },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: lines.join('\n') } },
        { tag: 'note', elements: [{ tag: 'plain_text', content: 'DECOX • QS Pro • tự động khi build xong' }] }
      ]
    }
  };

  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const d = await res.json().catch(function () { return {}; });
    if (d.code && d.code !== 0) console.warn('Lark webhook trả lỗi:', d.code, d.msg);
    else console.log('Đã gửi thông báo build lên Lark.');
  } catch (e) {
    console.warn('Không gửi được thông báo Lark:', e.message);
  }
}

module.exports = { sendBuildNotice };
