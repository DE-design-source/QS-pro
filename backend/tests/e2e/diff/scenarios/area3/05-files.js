'use strict';
/* File và route lẻ của vùng 3:
   - uploadImage / uploadFile (rpc + REST) và POST /upload/file (server/store_supa.js 965-1003, server/index.js 763-778) với KHO FILE GIẢ:
     so cả những gì mỗi server gửi lên kho (đường dẫn, header, nội dung);
   - POST /export/san-pham (server/index.js 652-687, 744-760), so file .xlsx từng ô;
   - 3 file mẫu /mau-nhap-*.xlsx (module categories), có và không có ?hm=;
   - GET /media (module files) với Lark GIẢ: token, lỗi, bộ nhớ đệm token. */
const zlib = require('zlib');
const { fx, SPEC } = require('./_fx');
const { PNG } = require('../../lib/fake');
const { Pair } = require('../../lib/harness');

module.exports = {
  name: 'area3/05 uploads, export, templates, media',
  async run(h) {
    const f = await fx(h), S = f.S, fake = h.fake;
    const tk = (s, side) => (s.token instanceof Pair ? s.token[side] : s.token);
    const bearer = (s) => (s.token ? { Authorization: h.pair('Bearer ' + tk(s, 'node'), 'Bearer ' + tk(s, 'go')) } : {});
    const view = (s) => (s.view != null ? { 'x-view-company': s.view } : {});
    const b64 = (buf) => Buffer.from(buf).toString('base64');
    const png64 = b64(PNG), pdf = Buffer.from('%PDF-1.4\n% tài liệu thử\n' + 'x'.repeat(3000));
    fake.take();

    /* ================= uploadImage ================= */
    await f.matrix('uploadImage', ['data:image/png;base64,' + png64, 'anh.png']);
    h.fakeCheck('kho file sau ma trận quyền uploadImage');
    for (const a of [[png64], [png64, null], ['data:image/jpeg;base64,' + png64, 'a.jpeg'], ['data:image/webp;base64,' + png64], ['data:image/svg+xml;base64,' + png64], ['data:application/pdf;base64,' + b64(pdf)], ['data:text/plain;charset=utf-8;base64,' + png64], ['data:;base64,' + png64], ['data:image;base64,' + png64], ['data:IMAGE/PNG;base64,' + png64], ['data:image/jpeg/x;base64,' + png64],
      [png64 + '\n' + png64], [' ' + png64 + ' '], [png64.replace(/\+/g, '-').replace(/\//g, '_')], [png64.replace(/=+$/, '')], ['!!!' + png64], ['QQ'], ['Q'], ['data:image/png;base64,'], ['data:image/png;base64,!!!'], [''], [null], [], [0], [12345678], [true], [{}], [[]], [['QUJD']], [png64, 'tên có dấu.png', 'thừa']]) {
      await h.both(S.adminA, 'uploadImage', a, { label: 'uploadImage ' + JSON.stringify(a).slice(0, 80) });
      h.fakeCheck('kho file: uploadImage ' + JSON.stringify(a).slice(0, 50));
    }
    // kho trả lỗi / đứt kết nối
    for (const [ten, mode] of [['400 JSON', { status: 400, body: '{"statusCode":"400","error":"Invalid","message":"bad"}', type: 'application/json' }], ['413', { status: 413, body: 'Payload too large', type: 'text/plain' }], ['500 dài', { status: 500, body: 'lỗi kho '.repeat(60), type: 'text/plain' }], ['399', { status: 399, body: 'lạ', type: 'text/plain' }], ['204 rỗng', { status: 204, body: '', type: null }], ['302', { status: 302, body: '', type: null, headers: { Location: '/storage/v1/object/products/khac' } }], ['đứt kết nối', 'drop']]) {
      fake.set('storage', mode);
      await h.both(S.adminA, 'uploadImage', ['data:image/png;base64,' + png64], { label: 'uploadImage khi kho trả ' + ten });
      await h.both(S.adminA, 'uploadFile', [b64(pdf), 'tai-lieu.pdf'], { label: 'uploadFile khi kho trả ' + ten });
      h.fakeCheck('kho file trả ' + ten);
    }
    fake.set('storage', { status: 400, body: '{"error":"Payload too large","message":"The object exceeded the maximum allowed size"}', type: 'application/json' });
    await h.both(S.adminA, 'uploadFile', [b64(pdf), 'lon.pdf'], { label: 'uploadFile khi kho báo vượt giới hạn (maximum allowed size)' });
    await h.both(S.adminA, 'uploadImage', [png64], { label: 'uploadImage khi kho báo vượt giới hạn' });
    fake.reset(); h.fakeCheck('kho file báo vượt giới hạn');

    /* ================= uploadFile (base64 qua rpc) ================= */
    await f.matrix('uploadFile', ['data:application/pdf;base64,' + b64(pdf), 'Bản vẽ tầng 1.pdf']);
    h.fakeCheck('kho file sau ma trận quyền uploadFile');
    const names = ['a.pdf', 'A.PDF', 'ảnh đẹp.JPG', 'x.jpeg', 'x.webp', 'x.gif', 'x.png', 'bản vẽ.dwg', 'x.dxf', 'x.skp', 'x.zip', 'x.rar', 'x.7z', 'x.doc', 'x.docx', 'x.xls', 'x.xlsx', 'x.ppt', 'x.pptx', 'x.exe', 'x.js', 'x.html', 'x.svg', 'x.txt', 'x.pdf.exe', 'x.tar.gz', 'khongduoi', '.pdf', 'pdf', 'x.', 'x..pdf', '.', '', '   ', 'C:\\Users\\A\\Tài liệu\\Hồ sơ.pdf', '/tmp/a/b/c.zip', 'a/b\\c.png', '../../etc/passwd.pdf', 'thư mục/',
      'Đường Đi đến ĐÂU.pdf', 'tên   nhiều   khoảng trắng & ký tự !@#$%^()+=.pdf', '---.pdf', '___.pdf', 'a_b-c.pdf', 'x'.repeat(100) + '.pdf', '😀 emoji.pdf', 'e\u0301 tổ hợp.pdf', 'x.PdF ', ' x.pdf', 'x.pdf?y=1', 'x.pdf#z', 'a%20b.pdf', 'x.docm', 'x.xlsm', 'x.jpg.', 'tệp.Docx', 'x.jpe', 'x.jpgg'];
    for (const n of names) { await h.both(S.edit, 'uploadFile', [b64(pdf), n], { label: 'uploadFile tên ' + JSON.stringify(n).slice(0, 70) }); }
    h.fakeCheck('kho file: uploadFile theo tên');
    for (const a of [[], [null], [''], [b64(pdf)], [b64(pdf), null], [b64(pdf), 0], [b64(pdf), 123], [b64(pdf), true], [b64(pdf), ['a.pdf']], [b64(pdf), ['a.pdf', 'b.zip']], [b64(pdf), {}], [b64(pdf), { name: 'a.pdf' }], ['data:;base64,' + b64(pdf), 'a.pdf'], ['data:text/plain;base64,' + b64(pdf), 'a.pdf'], ['data:application/x-zip;charset=x;base64,' + b64(pdf), 'a.zip'],
      ['data:base64,' + b64(pdf), 'a.pdf'], ['!!!', 'a.pdf'], ['data:application/pdf;base64,', 'a.pdf'], [0, 'a.pdf'], [12345678, 'a.pdf'], [true, 'a.pdf'], [{}, 'a.pdf'], [['QUJD'], 'a.pdf'], [b64(pdf), 'a.pdf', 'thừa']]) {
      await h.both(S.edit, 'uploadFile', a, { label: 'uploadFile tham số ' + JSON.stringify(a).slice(0, 80) });
    }
    h.fakeCheck('kho file: uploadFile theo tham số');

    /* ================= POST /upload/file (thân nhị phân) ================= */
    const up = (label, s, query, body, hd, opts) => h.raw('POST /upload/file' + query + ' ' + label, { method: 'POST', path: '/upload/file' + query, headers: Object.assign({}, bearer(s), view(s), (hd && hd['Content-Type'] === null) ? {} : hd || {}), body }, opts);
    for (const s of f.all.concat([S.adminView, S.viewB])) await up('@' + s.label, s, '?name=' + encodeURIComponent('Hồ sơ.pdf'), pdf, { 'Content-Type': 'application/pdf' });
    h.fakeCheck('kho file sau ma trận quyền /upload/file');
    await up('token sai', h.session('token rác', 'abc.def'), '?name=a.pdf', pdf, { 'Content-Type': 'application/pdf' });
    await up('token ở query (không nhận)', S.anon, h.pair('?name=a.pdf&token=' + S.adminA.token.node, '?name=a.pdf&token=' + S.adminA.token.go), pdf, { 'Content-Type': 'application/pdf' });
    await up('Authorization viết thường bearer', S.anon, '?name=a.pdf', pdf, { 'Content-Type': 'application/pdf', Authorization: h.pair('bearer   ' + S.adminA.token.node, 'bearer   ' + S.adminA.token.go) });
    for (const [ct, body] of [['application/pdf', pdf], ['image/png', PNG], ['application/octet-stream', pdf], ['text/plain; charset=utf-8', Buffer.from('văn bản')], ['application/x-www-form-urlencoded', Buffer.from('a=1&b=2')], ['multipart/form-data; boundary=x', Buffer.from('--x\r\n\r\nabc\r\n--x--')], ['application/zip', pdf], ['x', pdf], ['', pdf], [null, pdf], ['APPLICATION/PDF', pdf], ['application/pdf', Buffer.alloc(0)], ['application/pdf', undefined]])
      await up('content-type ' + JSON.stringify(ct) + (body && body.length ? '' : ' (thân rỗng)'), S.adminA, '?name=a.pdf', body, { 'Content-Type': ct });
    h.fakeCheck('kho file: /upload/file theo content-type');
    for (const q of ['', '?name=', '?name=a.exe', '?name=khongduoi', '?ten=a.pdf', '?name=a.pdf&name=b.zip', '?name[]=a.pdf', '?name[]=a.pdf&name[]=b.png', '?name[0]=a.pdf', '?name[x]=a.pdf', '?name=a.pdf&x=1#frag', '?name=%E1%BA%A3nh%20%C4%91%E1%BA%B9p.png', '?name=a%2Fb%5Cc.pdf', '?name=%ZZ.pdf', '?name=a+b.pdf', '?name=a%20b.pdf', '?NAME=a.pdf', '?name=..%2F..%2Fx.pdf', '?name=a.pdf;x=1', '?name=%00.pdf', '?&name=a.pdf&', '?name', '?name=a.pdf=b.png', '?name=' + 'd'.repeat(300) + '.pdf'])
      await up('query ' + q.slice(0, 70), S.adminA, q, pdf, { 'Content-Type': 'application/pdf' });
    h.fakeCheck('kho file: /upload/file theo query');
    // thân JSON: express.json đọc trước express.raw -> req.body là object / mảng / chuỗi; token trong thân JSON cũng đăng nhập được
    for (const j of ['{}', '[]', '{"length":5}', '{"length":0}', '{"length":"3"}', '[1,2,3]', '"chuỗi"', '123', 'null', 'true', '{"a":1}', '\uFEFF', ''])
      await up('thân JSON ' + JSON.stringify(j), S.adminA, '?name=a.pdf', j, { 'Content-Type': 'application/json' }, { accept: f.badJson });
    await up('token trong thân JSON', S.anon, '?name=a.pdf', h.pair(JSON.stringify({ token: S.adminA.token.node, length: 4 }), JSON.stringify({ token: S.adminA.token.go, length: 4 })), { 'Content-Type': 'application/json' });
    await up('thân JSON hỏng', S.adminA, '?name=a.pdf', '{"a":', { 'Content-Type': 'application/json' }, { accept: f.badJson });
    h.fakeCheck('kho file: /upload/file thân JSON');
    // thân nén
    await up('gzip', S.adminA, '?name=a.pdf', zlib.gzipSync(pdf), { 'Content-Type': 'application/pdf', 'Content-Encoding': 'gzip' });
    await up('deflate', S.adminA, '?name=a.pdf', zlib.deflateSync(pdf), { 'Content-Type': 'application/pdf', 'Content-Encoding': 'deflate' });
    await up('identity', S.adminA, '?name=a.pdf', pdf, { 'Content-Type': 'application/pdf', 'Content-Encoding': 'identity' });
    h.fakeCheck('kho file: /upload/file thân nén');
    // phương thức khác
    for (const m of ['GET', 'PUT', 'DELETE']) await h.raw(m + ' /upload/file', { method: m, path: '/upload/file?name=a.pdf', headers: bearer(S.adminA) });
    // kho lỗi
    fake.set('storage', { status: 413, body: 'too large', type: 'text/plain' }); await up('khi kho trả 413', S.adminA, '?name=a.pdf', pdf, { 'Content-Type': 'application/pdf' });
    fake.set('storage', { status: 500, body: 'hỏng', type: 'text/plain' }); await up('khi kho trả 500', S.adminA, '?name=a.pdf', pdf, { 'Content-Type': 'application/pdf' });
    fake.set('storage', 'drop'); await up('khi kho đứt kết nối', S.adminA, '?name=a.pdf', pdf, { 'Content-Type': 'application/pdf' });
    fake.reset(); h.fakeCheck('kho file: /upload/file khi kho lỗi');
    // giới hạn kích thước: 50 MB vừa đủ, 50 MB + 1 byte (hàm từ chối), 52 MB (vượt giới hạn thân -> 413 JSON), thân JSON 31 MB
    const big = Buffer.alloc(50 * 1024 * 1024 + 1, 0x41);
    await up('đúng 50 MB', S.adminA, '?name=lon.zip', big.subarray(0, 50 * 1024 * 1024), { 'Content-Type': 'application/zip' });
    await up('50 MB + 1 byte', S.adminA, '?name=lon.zip', big, { 'Content-Type': 'application/zip' });
    await up('52 MB (quá giới hạn thân)', S.adminA, '?name=lon.zip', Buffer.alloc(52 * 1024 * 1024, 0x41), { 'Content-Type': 'application/zip' });
    await up('52 MB chưa đăng nhập', S.anon, '?name=lon.zip', Buffer.alloc(52 * 1024 * 1024, 0x41), { 'Content-Type': 'application/zip' });
    await up('thân JSON 31 MB', S.adminA, '?name=lon.zip', '{"a":"' + 'x'.repeat(31 * 1024 * 1024) + '"}', { 'Content-Type': 'application/json' });
    h.fakeCheck('kho file: /upload/file file lớn');

    /* ================= POST /export/san-pham ================= */
    const ids = [];
    for (let i = 1; i <= 4; i++) ids.push(f.idOf(await h.rpc(S.adminA, 'saveDbProduct', [f.denData(500 + i, { 'MÃ SẢN PHẨM': 'DX-DEN-' + i })])));
    for (const ng of ['vs', 'son', 'ct']) ids.push(f.idOf(await h.rpc(S.adminA, 'saveDbProduct', [f.specData(ng, SPEC[ng].HANG_MUC[1], 510, { 'MÃ SẢN PHẨM': 'DX-' + ng })])));
    await h.rpc(S.adminA, 'saveDbProduct', [{ 'TÊN SẢN PHẨM': '=CMD("x") công thức', 'MÃ SẢN PHẨM': 'DX-CT', 'GHI CHÚ': 'dòng 1\ndòng 2', 'GIÁ BÁN LẺ': 1234567.89, 'ẢNH SẢN PHẨM': 'https://img.test/1.jpg\nhttps://img.test/2.jpg' }]);
    const ex = (label, s, body, opts) => h.raw('POST /export/san-pham ' + label, { method: 'POST', path: '/export/san-pham', headers: Object.assign({ 'Content-Type': 'application/json' }, bearer(s), view(s)), body: body === undefined ? undefined : typeof body === 'string' ? body : body instanceof Pair ? h.pair(JSON.stringify(body.node), JSON.stringify(body.go)) : JSON.stringify(body) }, opts);
    for (const s of [S.anon, S.none, S.edit, S.adminA, S.adminB, S.adminC, S.viewA, S.viewB, S.adminView]) await ex('không keys @' + s.label, s, {});
    await ex('không keys @super (toàn bộ danh mục)', S.root, {});
    await ex('token trong thân', S.anon, h.pair({ token: S.adminA.token.node, keys: [ids[0]] }, { token: S.adminA.token.go, keys: [ids[0]] }));
    await ex('token sai', h.session('token rác', 'abc.def'), {});
    // [khoảng trống vùng 3: index.js:758] nhánh 500 của /export/san-pham: getProducts lỗi database vì x-view-company không phải uuid (bộ lọc công ty sai kiểu)
    for (const v of ['khong-phai-uuid', '00000000-0000-4000-8000-00000000eeeZ', ' ']) {
      const sv = h.with(S.root, { view: v, label: 'super, x-view-company = ' + JSON.stringify(v) });
      await ex('@' + sv.label + ' (không keys)', sv, {});
      await ex('@' + sv.label + ' (có keys)', sv, { keys: [ids[0]] });
    }
    for (const keys of [[ids[0]], [String(ids[1]), 'DX-DEN-3'], ids, ['DX-vs', 'DX-son', 'DX-ct'], ['DX-CT'], [], ['KHÔNG-CÓ'], [999999999], [null], [{}], [[ids[0]]], [true], 'DX-DEN-1', ids[0], null, { 0: ids[0] }, [ids[0], ids[0], 'DX-DEN-1'], ['dx-den-1'], [' DX-DEN-1 ']])
      await ex('keys = ' + f.show(keys), S.adminA, { keys });
    await ex('keys của công ty khác @admin B', S.adminB, { keys: ids });
    await ex('keys kho chung @admin C', S.adminC, { keys: [1, 2, 3] });
    await ex('thân không phải object', S.adminA, '[1,2]'); await ex('thân null', S.adminA, 'null', { accept: f.badJson }); await ex('không thân', S.adminA, undefined); await ex('thân JSON hỏng', S.adminA, '{"keys":', { accept: f.badJson });
    await h.raw('POST /export/san-pham content-type text/plain', { method: 'POST', path: '/export/san-pham', headers: Object.assign({ 'Content-Type': 'text/plain' }, bearer(S.adminA)), body: JSON.stringify({ keys: [ids[0]] }) });
    await h.raw('GET /export/san-pham', { method: 'GET', path: '/export/san-pham', headers: bearer(S.adminA) });

    /* ================= file mẫu nhập hàng loạt (module categories) ================= */
    const tpl = (p, opts) => h.raw('GET ' + p.slice(0, 110), { method: 'GET', path: p }, opts);
    for (const p of ['/mau-nhap-thiet-bi-ve-sinh.xlsx', '/mau-nhap-cong-tac-o-cam.xlsx', '/mau-nhap-son-nuoc.xlsx']) {
      await tpl(p);
      await h.raw('GET ' + p + ' (đã đăng nhập)', { method: 'GET', path: p, headers: bearer(S.adminA) });
      await h.raw('HEAD ' + p, { method: 'HEAD', path: p }, { noEtag: true });
      await h.raw('POST ' + p, { method: 'POST', path: p });
      for (const q of ['?hm=', '?hm=%20%20', '?hm=Kh%C3%B4ng%20c%C3%B3', '?hm=a&hm=b', '?hm[]=a', '?hm[x]=1', '?x=1', '?hm=%ZZ', '?HM=x'])
        await tpl(p + q);
    }
    for (const hm of SPEC.vs.HANG_MUC.slice(0, 3)) await tpl('/mau-nhap-thiet-bi-ve-sinh.xlsx?hm=' + encodeURIComponent(hm));
    for (const hm of SPEC.son.HANG_MUC) await tpl('/mau-nhap-son-nuoc.xlsx?hm=' + encodeURIComponent(hm));
    for (const hm of SPEC.ct.HANG_MUC) await tpl('/mau-nhap-cong-tac-o-cam.xlsx?hm=' + encodeURIComponent(hm));
    for (const hm of ['son noi that', 'SƠN LÓT', '  Sơn dầu  ', 'Bả matit', 'sơn sàn EPOXY', 'Dung môi & phụ gia']) await tpl('/mau-nhap-son-nuoc.xlsx?hm=' + encodeURIComponent(hm));
    for (const hm of ['o cam dien', 'CÔNG TẮC CƠ', '  Dimmer / điều tốc quạt ', 'Ổ cắm tín hiệu (TV / LAN / Tel / HDMI)']) await tpl('/mau-nhap-cong-tac-o-cam.xlsx?hm=' + encodeURIComponent(hm));
    await tpl('/mau-nhap-son-nuoc.xlsx?hm=' + encodeURIComponent('Sơn lót') + '#x?hm=y');
    await tpl('/mau-nhap-den.xlsx'); await tpl('/MAU-NHAP-SON-NUOC.XLSX'); await tpl('/mau-nhap-son-nuoc.xlsx/');
    // file mẫu vừa tải nhập lại được: importParse trên chính file của từng server
    for (const [p, ng] of [['/mau-nhap-thiet-bi-ve-sinh.xlsx', 'vs'], ['/mau-nhap-son-nuoc.xlsx', 'son'], ['/mau-nhap-cong-tac-o-cam.xlsx', 'ct']]) {
      const t = await tpl(p + '?lan=2');
      await h.rpc(S.adminA, 'importParse', [h.pair(b64(t.node.buf), b64(t.go.buf)), 'xlsx', ng], { label: 'importParse file mẫu ' + ng + ' do chính server sinh ra' });
    }

    /* ================= GET /media (Lark giả) ================= */
    const media = (q, opts) => h.raw('GET /media' + q.slice(0, 90), { method: 'GET', path: '/media' + q }, opts);
    fake.take();
    await media(''); await media('?token='); await media('?x=1');
    h.fakeCheck('Lark: thiếu token không gọi ra ngoài', { count: 0 });
    fake.set('larkToken', { status: 200, body: '{"code":99991663,"msg":"app not found"}', type: 'application/json' });
    await media('?token=img-png'); h.fakeCheck('Lark: lấy token lỗi (code khác 0)');
    fake.set('larkToken', { status: 500, body: 'không phải JSON', type: 'text/plain' });
    await media('?token=img-png'); h.fakeCheck('Lark: endpoint token trả 500 không JSON');
    fake.set('larkToken', 'drop');
    await media('?token=img-png'); h.fakeCheck('Lark: endpoint token đứt kết nối');
    // token sống 61 giây -> coi là còn hạn trong 1 giây đầu, sau đó lấy lại
    fake.set('larkToken', { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 't-ngan', expire: 61 }), type: 'application/json' });
    await media('?token=img-png'); await media('?token=txt-utf8'); h.fakeCheck('Lark: token 61 giây, lần 2 dùng bộ nhớ đệm');
    await h.sleep(1600);
    fake.set('larkToken', { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 't-chu', expire: 'abc' }), type: 'application/json' });
    await media('?token=img-png'); h.fakeCheck('Lark: token hết hạn -> lấy lại (expire không phải số -> 7200)');
    fake.reset();
    for (const s of [S.anon, S.adminA]) await h.raw('GET /media?token=img-png @' + s.label, { method: 'GET', path: '/media?token=img-png', headers: bearer(s) });
    for (const t of ['img-png', 'txt-utf8', 'no-type', 'empty', 'big', 'err500', 'err403', 'khong-co', 'a%2Fb', 'a%20b', 'a+b', '%E1%BA%A3nh', '..', '.', '%2e%2e', '...', '..%2Fx', 'a%3Fb%23c', 'a%25b', 'a%26b', '%ZZ', '%00', 'x'.repeat(500)])
      await media('?token=' + t);
    for (const q of ['?token=a&token=b', '?token[]=a', '?token[x]=1', '?token[toString]=x', '?token=img-png&x=1#frag', '?TOKEN=img-png', '?token=img-png&token=', '?&token=img-png'])
      await media(q);
    for (const m of ['HEAD', 'POST']) await h.raw(m + ' /media?token=img-png', { method: m, path: '/media?token=img-png' });
    h.fakeCheck('Lark: tải media theo token');
    await h.dbCheck('sau kịch bản file', ['products', 'audit_logs', 'product_histories']);
  },
};
