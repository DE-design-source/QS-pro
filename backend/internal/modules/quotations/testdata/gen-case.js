'use strict';
/* Bảng đổi hoa - thường của Node cho TỪNG điểm mã: in các điểm mã mà toUpperCase() hoặc toLowerCase() đổi khác chính nó.
     node gen-case.js > case-node.txt
   Mỗi dòng: <hex điểm mã> TAB <hex kết quả upper, cách nhau dấu cách> TAB <hex kết quả lower>. TestJSCaseBang đọc file này. */
const hex = function (s) { return Array.from(s).map(function (c) { return c.codePointAt(0).toString(16); }).join(' '); };
const out = ['# node ' + process.version + ' unicode ' + process.versions.unicode];
for (let cp = 0; cp <= 0x10FFFF; cp++) {
  if (cp >= 0xD800 && cp <= 0xDFFF) continue;
  const s = String.fromCodePoint(cp);
  const u = s.toUpperCase(), l = s.toLowerCase();
  if (u !== s || l !== s) out.push(cp.toString(16) + '\t' + hex(u) + '\t' + hex(l));
}
process.stdout.write(out.join('\n') + '\n');
