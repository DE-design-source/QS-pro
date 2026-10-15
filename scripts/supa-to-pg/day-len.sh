#!/bin/sh
# Chuyển TOÀN BỘ dữ liệu Supabase -> Postgres đích (Render): chụp mới -> nạp vào docker -> đối soát -> view tên cũ -> chép nguyên CSDL sang đích.
# Dùng: sh scripts/supa-to-pg/day-len.sh "postgresql://user:pass@host/db"   (External Database URL của Render)
# CẢNH BÁO: XOÁ và ghi lại toàn bộ CSDL đích. Supabase chỉ được ĐỌC.
set -e
case "$1" in postgres://*|postgresql://*) ;; *) echo 'Địa chỉ CSDL đích phải bắt đầu bằng postgresql:// (copy External Database URL trên Render)'; exit 1;; esac
cd "$(dirname "$0")/../.."
node scripts/supa-to-pg/fetch.js
node scripts/supa-to-pg/load.js
node scripts/supa-to-pg/verify.js
node scripts/supa-to-pg/compat.js
docker exec -i qspro-db psql -U qspro -d qspro -v ON_ERROR_STOP=1 -q < db/pg/compat_views.sql
docker exec qspro-db pg_dump -U qspro -d qspro --no-owner --no-acl -Fc -f /tmp/qspro.dump
docker exec qspro-db pg_restore --no-owner --no-acl --clean --if-exists --exit-on-error -d "$1" /tmp/qspro.dump
docker exec qspro-db psql "$1" -Atc "select 'Đích: ' || (select count(*) from public.products) || ' SP, ' || (select count(*) from public.projects) || ' dự án, ' || (select count(*) from public.quotation_lines) || ' dòng báo giá'"
