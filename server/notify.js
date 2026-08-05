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

// Lấy thông tin commit ngay lúc chạy bằng git (Render giữ .git ở runtime) — chính xác nhất.
function gitInfo() {
  try {
    const { execSync } = require('child_process');
    const opt = { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const g = function (c) { return execSync('git ' + c, opt).trim(); };
    return {
      sha: g('rev-parse --short HEAD'),
      subject: g('log -1 --pretty=%s'),
      body: g('log -1 --pretty=%b'),
      branch: process.env.RENDER_GIT_BRANCH || g('rev-parse --abbrev-ref HEAD'),
      files: g('show --name-only --pretty=format: HEAD').split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
    };
  } catch (e) { return null; }
}

// Thứ tự ưu tiên: git runtime -> file build-info.json -> biến môi trường Render.
function gatherInfo() {
  const gi = gitInfo();
  if (gi && gi.subject) return gi;
  const fi = readInfo();
  if (fi && fi.subject) return fi;
  return {
    sha: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || '?',
    subject: 'Cập nhật mới', body: '', branch: process.env.RENDER_GIT_BRANCH || 'main', files: []
  };
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
