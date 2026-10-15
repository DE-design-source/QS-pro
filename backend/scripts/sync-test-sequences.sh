#!/usr/bin/env bash
# Đưa mọi sequence của hai database THỬ (qspro_gotest, qspro_nodetest) về cùng giá trị (lấy số lớn hơn),
# để các lần đối chiếu Node <-> Go sau đó sinh cùng id. Chỉ đụng tới hai database thử trong container qspro-postgres.
set -euo pipefail
PSQL="docker exec -i qspro-postgres psql -U qspro -At -v ON_ERROR_STOP=1"
Q="select sequencename, coalesce(last_value, 0) from pg_sequences where schemaname = 'public' order by 1"
declare -A a b
while IFS='|' read -r n v; do a[$n]=$v; done < <($PSQL -d qspro_gotest -c "$Q")
while IFS='|' read -r n v; do b[$n]=$v; done < <($PSQL -d qspro_nodetest -c "$Q")
for n in "${!a[@]}"; do
  [ -n "${b[$n]:-}" ] || continue
  m=${a[$n]}; [ "${b[$n]}" -gt "$m" ] && m=${b[$n]}
  [ "$m" -gt 0 ] || continue
  if [ "${a[$n]}" != "${b[$n]}" ]; then
    echo "$n: gotest=${a[$n]} nodetest=${b[$n]} -> $m"
    $PSQL -d qspro_gotest -c "select setval('public.\"$n\"', $m, true)" > /dev/null
    $PSQL -d qspro_nodetest -c "select setval('public.\"$n\"', $m, true)" > /dev/null
  fi
done
echo "xong"
