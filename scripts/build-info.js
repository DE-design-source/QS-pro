'use strict';
/**
 * Chạy trong bước BUILD (Render) — chụp lại thông tin commit vừa deploy
 * vào server/build-info.json để server đọc và gửi noti lên Lark khi khởi động.
 * An toàn khi chạy local: chỉ ghi 1 file, không gửi gì.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
function git(cmd) { return execSync('git ' + cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); }

let info = {};
try {
  info.sha = git('rev-parse --short HEAD');
  info.subject = git('log -1 --pretty=%s');
  info.body = git('log -1 --pretty=%b');
  info.dateIso = git('log -1 --pretty=%cI');
  info.branch = process.env.RENDER_GIT_BRANCH || git('rev-parse --abbrev-ref HEAD');
  info.files = git('show --name-only --pretty=format: HEAD').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
} catch (e) {
  // Không có git lúc build (hiếm) -> lấy tạm từ biến môi trường Render
  info.sha = (process.env.RENDER_GIT_COMMIT || '').slice(0, 7);
  info.subject = 'Deploy mới';
  info.body = '';
  info.branch = process.env.RENDER_GIT_BRANCH || 'main';
  info.files = [];
  info.error = e.message;
}

fs.writeFileSync(path.join(ROOT, 'server', 'build-info.json'), JSON.stringify(info, null, 2));
console.log('build-info.json:', info.sha, '-', info.subject);
