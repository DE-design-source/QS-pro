'use strict';
/* Sinh testdata/qs.json (cho cả categories lẫn files) từ thư viện qs THẬT với đúng tuỳ chọn Express 4 truyền
   (node_modules/express/lib/utils.js:289): mỗi ca = [chuỗi query, khoá, String(giá trị), !!giá trị, lỗi của String()].
   Không cần database:  node backend/internal/modules/categories/testdata/gen-qs.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../../../../..');
const qs = require(path.join(root, 'node_modules/qs'));

const big = function (n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f(i)); return a.join('&'); };
const RAW = [
  '', 'hm', 'hm=', 'hm=a', 'hm=a+b', 'hm=%20a%20', 'hm=a&hm=b', 'hm=a&hm=', 'hm=&hm=', 'hm[]=a', 'hm[]=a&hm[]=b', 'hm[]=', 'hm[]',
  'hm[0]=a', 'hm[1]=b&hm[0]=a', 'hm[2]=c&hm[0]=a', 'hm[5]=x', 'hm[01]=x', 'hm[-1]=x', 'hm[1e3]=x', 'hm[999]=x', 'hm[1000]=x', 'hm[1001]=x',
  'hm[k]=v', 'hm[k]=v&hm=a', 'hm=a&hm[k]=v', 'hm[k]=v&hm[]=a', 'hm[]=a&hm[k]=v', 'hm[a][b]=c', 'hm[a][b][c][d][e][f][g]=x', 'hm[a[b]]=c',
  'hm[toString]=x', 'hm[toString][]=x', 'hm[valueOf]=x', 'hm[__proto__]=x', 'hm[__proto__][a]=x', 'hm[constructor]=x', 'hm[hasOwnProperty]=x', 'hm[length]=3',
  'hm[0][a]=1&hm[0][b]=2', 'hm[0][a]=1&hm[1][a]=2', 'hm[][a]=1&hm[][a]=2', 'hm[0]=a&hm[0]=b', 'hm[0]=a&hm[]=b', 'hm[0][]=a&hm[0][]=b', 'hm[1][]=a',
  'hm[=a', 'hm]=a', 'hm[a=b', 'hm[a]b=c', 'hm[a]]=c', 'hm[[a]]=c', 'hm[]a=b', '[hm]=a', '[]=a', '=a', '&&hm=a&&', 'hm=a=b', 'hm==a', 'hm[a]=b=c',
  'hm%5B%5D=a', 'hm%5b%5d=a&hm%5B%5D=b', 'hm%5Bk%5D=v', 'h%6D=a', 'hm=%E0%A4%A', 'hm=%', 'hm=%zz', '%68m=a', 'hm=S%C6%A1n+l%C3%B3t', 'hm=a%26b', 'hm=a;b', 'hm=a,b',
  'HM=a', 'hmx=a', 'xhm=a', 'x=1&hm=a&y=2', 'hm.a=b', 'hm=a&hm[]=b&hm[2]=c', 'hm[a]=1&hm[a]=2', 'hm[a][]=1&hm[a][]=2', 'hm[a]=1&hm[b]=2&hm[0]=z',
  'hm[10]=a&hm[2]=b', 'hm[b]=1&hm[10]=a&hm[2]=b', 'hm[0]=&hm[1]=b', 'hm[ ]=a', 'hm[+]=a', 'hm[%20]=a', 'hm[a]', 'hm[a]=', 'hm[][]=a', 'hm[][][]=a',
  'hm[0]=a&hm[toString]=b', 'hm[a][toString]=b', 'hm[][toString]=b', 'hm[]=a&hm[][toString]=b', 'hm=a&hm[toString]=b', 'hm[toString]=b&hm=a',
  'token=abc', 'token=a/b+c%2Fd', 'token[]=a&token[]=b', 'token[x]=1',
  big(1001, function () { return 'hm=a'; }), big(1000, function (i) { return 'hm[]=' + i; }), big(1002, function (i) { return 'x' + i + '=1'; }) + '&hm=a',
  big(999, function (i) { return 'x' + i + '=1'; }) + '&hm=a', big(30, function (i) { return 'hm[' + (i * 40) + ']=' + i; }),
  big(600, function () { return 'hm[]=a'; }) + '&' + big(600, function () { return 'hm=b'; })
];

const out = [];
RAW.forEach(function (raw) {
  ['hm', 'token'].forEach(function (key) {
    if (key === 'token' && raw.indexOf('token') < 0) return;
    const v = qs.parse(raw, { allowPrototypes: true, arrayLimit: 1000 })[key];
    let str = null, err = null;
    try { str = v === undefined ? '' : String(v); } catch (e) { err = e.message; }
    out.push([raw, key, str, !!v, err]);
  });
});
const json = JSON.stringify(out) + '\n';
fs.writeFileSync(path.join(__dirname, 'qs.json'), json);
fs.writeFileSync(path.join(__dirname, '../../files/testdata/qs.json'), json);
console.log('qs.json: ' + out.length + ' ca');
