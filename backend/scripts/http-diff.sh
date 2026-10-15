#!/usr/bin/env bash
# So lớp HTTP của bản Go với bản Node: cùng một loạt request gửi tới hai server, so mã trạng thái,
# vài header và thân trả về.  Dùng:  scripts/http-diff.sh http://localhost:3997 http://localhost:3998
# (server Node ở tham số 1, server Go ở tham số 2; cả hai phải chạy trên database THỬ).
# ĐIỀU KIỆN: hai server phải chạy với CÙNG giá trị RENDER_GIT_COMMIT (header x-app-ver được so). Để trống thì mỗi
# server lấy thời điểm khởi động của mình và mọi request tới /api/<fn> báo khác.
NODE=${1:-http://localhost:3997}
GO=${2:-http://localhost:3998}

ver() { curl -s -i --max-time 20 -X POST "$1/api/khongCo" | tr -d '\r' | grep -i '^x-app-ver:' | sed -E 's/^[^:]+: *//'; }
va=$(ver "$NODE"); vb=$(ver "$GO")
if [ "$va" != "$vb" ]; then
  echo "CHÚ Ý: x-app-ver khác nhau (Node '$va', Go '$vb'): đặt cùng RENDER_GIT_COMMIT cho hai server rồi chạy lại." >&2
fi
HDRS='etag|last-modified|content-length|content-range|content-type|cache-control|x-app-ver|content-security-policy|x-content-type-options|accept-ranges|location'
bad=0; n=0

one() { # one <base> <curl args...>  -> in "mã\nheader đã lọc\nthân"
  local base=$1 path=$2; shift 2
  local out head body=""
  out=$(curl -s -i --max-time 20 "$@" "$base$path" | tr -d '\r')
  head=${out%%$'\n\n'*}
  [[ "$out" == *$'\n\n'* ]] && body=${out#*$'\n\n'}
  echo "$head" | head -1 | awk '{print $2}'
  # tên header về chữ thường, xếp theo chữ cái để không phụ thuộc thứ tự server ghi; GIỮ nguyên giá trị
  echo "$head" | grep -iE "^($HDRS):" | sed -E 's/^([^:]+):/\L\1:/' | sort
  echo "--"
  echo "$body"
}

check() { # check <tên> <path> [curl args...]
  local name=$1; shift
  n=$((n + 1))
  local a b
  a=$(one "$NODE" "$@")
  b=$(one "$GO" "$@")
  if [ "$a" == "$b" ]; then
    echo "OK    $name"
  else
    bad=$((bad + 1))
    echo "KHÁC  $name"
    diff <(echo "$a") <(echo "$b") | head -12 | cut -c1-300 | sed 's/^/        /'
  fi
}

J='Content-Type: application/json'
check "GET /"                      /
check "GET /index.html"            /index.html
check "GET /app.js (HEAD)"         /app.js -I
check "GET /logo.svg"              /logo.svg
check "GET xlsx (HEAD)"            /mau-nhap-hang-loat.xlsx -I
check "GET vendor js (HEAD)"       /vendor/jsuites/jsuites.js -I
check "GET vendor css (HEAD)"      /vendor/jspreadsheet/jspreadsheet.css -I
check "GET vendor formula (HEAD)"  /vendor/formula/index.js -I
check "GET /vendor/jsuites"        /vendor/jsuites
check "GET /healthz"               /healthz
check "GET 404"                    /khong-co
check "GET 404 có ký tự lạ"        "/kh%C3%B4ng%20c%C3%B3?x=<1>"
check "GET file ẩn"                /.env
check "GET leo thư mục"            /..%2Fpackage.json
check "GET /api/login"             /api/login
check "POST file tĩnh"             /app.js -X POST
check "POST hàm lạ"                /api/khongCo -X POST -H "$J" -d '{"args":[]}'
check "POST hàm lạ không thân"     /api/khongCo -X POST
check "POST hàm lạ có ký tự lạ"    "/api/kh%C3%B4ng%3Cb%3E" -X POST
check "POST me chưa đăng nhập"     /api/me -X POST -H "$J" -d '{"args":[]}'
check "POST me token rác"          /api/me -X POST -H "$J" -H 'Authorization: Bearer abc.def' -d '{"args":[]}'
check "POST me token trong body"   /api/me -X POST -H "$J" -d '{"token":"abc.def","args":[]}'
check "POST admin chưa đăng nhập"  /api/adminListUsers -X POST -H "$J" -d '{"args":[]}'
check "POST super chưa đăng nhập"  /api/listCongTy -X POST -H "$J" -d '{}'
check "POST getProducts chưa ĐN"   /api/getProducts -X POST
check "POST thân mảng"             /api/getProjects -X POST -H "$J" -d '[1,2]'
check "POST login thiếu tham số"   /api/login -X POST -H "$J" -d '{"args":[]}'
check "POST login sai mật khẩu"    /api/login -X POST -H "$J" -d '{"args":["khong-co-user","sai"]}'
check "POST login không thân"      /api/login -X POST
check "PUT /api/login"             /api/login -X PUT -H "$J" -d '{}'

echo "$n request, $bad khác"
[ "$bad" == 0 ]
