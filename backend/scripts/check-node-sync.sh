#!/usr/bin/env sh
# Kiểm bản sao chép tay db-map.json của bản Go còn giống bản gốc bên Node (xem docs/DATABASE.md, mục "Đồng bộ với bản Node").
# Migration + schema.sql không còn bản chép: bản Go đọc thẳng infra/db/. Chỉ đọc file, không cần database.  Dùng (đứng ở đâu cũng được):  sh backend/scripts/check-node-sync.sh
cd "$(dirname "$0")/../.." || exit 2
bad=0

so() { # so <bản gốc Node> <bản sao Go>
  if cmp -s "$1" "$2"; then
    echo "OK    $2"
  else
    bad=$((bad + 1))
    echo "KHÁC  $2  (gốc: $1)"
  fi
}

so server/db-map.json backend/internal/platform/database/db-map.json

echo "$bad khác"
[ "$bad" = 0 ]
