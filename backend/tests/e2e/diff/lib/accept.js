'use strict';
/* Khác biệt CÓ CHỦ Ý dùng chung cho các kịch bản (ARCHITECTURE mục 10). Mỗi luật:
     reason: lý do in trong báo cáo;  only: loại chỗ khác mà luật được phép che (chỗ khác loại khác vẫn là KHÁC);
     test(node, go): điều kiện ở CẢ 2 phía - luật chỉ che đúng tình huống đã mô tả.
   Trang lỗi của Express: Node chạy chế độ dev nên in stack (<pre>SyntaxError: ...), Go luôn in dạng production (<pre>Bad Request</pre>). */
const html = (r) => /text\/html/.test(r.headers['content-type'] || '');

// Thân JSON hỏng: body-parser ném SyntaxError -> 400. Chỉ che phần thân của trang lỗi; mã HTTP, Content-Type phải giống.
const badJson = { reason: 'ARCH 10: thân JSON hỏng -> trang 400 dạng production (Node dev kèm stack)', only: /^body/,
  test: (n, g) => n.status === 400 && g.status === 400 && html(n) && html(g) && /<pre>SyntaxError: /.test(n.text) && /<pre>Bad Request<\/pre>/.test(g.text) };

// Lỗi khác của tầng Express (tham số đường dẫn không giải mã được, charset / Content-Encoding lạ, thân quá lớn): cùng cơ chế trang lỗi
const errPage = { reason: 'ARCH 10 (cùng cơ chế trang lỗi Express): Go trả dạng production, Node dev kèm stack', only: /^body/,
  test: (n, g) => n.status === g.status && n.headers['content-type'] === g.headers['content-type'] && /<pre>[A-Za-z ]+<\/pre>/.test(g.text) && /<pre>\w*Error: /.test(n.text) };

/* Tên hàm trùng thuộc tính của Object.prototype (/api/toString, /api/constructor...): REGISTRY của Node là object thường nên coi đó
   là hàm đã đăng ký (chưa đăng nhập -> 401; đã đăng nhập -> gọi hàm của prototype: 200 hoặc 500 TypeError). Go trả 404 như tên lạ. */
const registryLeak = { reason: 'ARCH 10: không tái hiện rò prototype của REGISTRY (/api/toString... -> Go trả 404)', only: /^(status|body)/,
  test: (n, g) => [200, 401, 500].indexOf(n.status) >= 0 && !/Không hỗ trợ hàm/.test(n.text) && g.status === 404 && /^\{"error":"Không hỗ trợ hàm: /.test(g.text) };

module.exports = { badJson, errPage, registryLeak };
