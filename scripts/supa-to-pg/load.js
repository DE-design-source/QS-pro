'use strict';
/* BƯỚC 3 — Nạp TOÀN BỘ dữ liệu Supabase (bản chụp ở export/supa-snapshot) vào Postgres docker (schema qspro_en2).
   - Ánh xạ cột: mapping.auto.json (dò bằng infer.js — ghép từng dòng theo khoá, cột trùng giá trị) + SUA bên dưới (cột trống
     trong dump nên không dò được, đặt theo tên; vài cột dò nhầm vì trùng giá trị ngẫu nhiên).
   - Xoá sạch dữ liệu cũ trong các bảng public rồi nạp lại (giữ nguyên id). Dòng vi phạm ràng buộc KHÔNG làm hỏng cả lần nạp:
     ghi vào quarantine.etl_rejects (bảng, dòng, lỗi) để xem lại.
   - Cả lần nạp trong 1 transaction: lỗi giữa chừng -> không đổi gì.
   Chạy: node scripts/supa-to-pg/fetch.js && node scripts/supa-to-pg/load.js                                              */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SNAP = path.join(__dirname, '..', '..', 'export', 'supa-snapshot');
const { AUTO, SPEC, THU_TU, colsOf } = require('./map.js');
function pg(sql, input) { return cp.execFileSync('docker', ['exec', '-i', 'qspro-db', 'psql', '-U', 'qspro', '-d', 'qspro', '-v', 'ON_ERROR_STOP=1', '-Atq'].concat(input ? [] : ['-c', sql]), { input: input, maxBuffer: 1 << 28 }).toString(); }
function cu(t) { return JSON.parse(fs.readFileSync(path.join(SNAP, t + '.json'), 'utf8')); }

const goi = {}, tom = {};
THU_TU.forEach(function (t) {
  const m = AUTO[t]; const cols = colsOf(t);
  const rows = [];
  cu(m.from).forEach(function (r) {
    const o = {}; let coGiaTri = false;
    Object.keys(cols).forEach(function (k) { const v = r[cols[k]]; if (v !== undefined) o[k] = v; if (k !== 'product_id' && v != null && v !== '') coGiaTri = true; });
    if (SPEC[t] && !coGiaTri) return;            // bảng thông số: chỉ có dòng khi có ít nhất 1 giá trị
    rows.push(o);
  });
  goi[t] = rows; tom[t] = rows.length;
});
const tmp = '/tmp/qspro_etl.json';
fs.writeFileSync(path.join(SNAP, '_load.json'), JSON.stringify(goi));
cp.execFileSync('docker', ['cp', path.join(SNAP, '_load.json'), 'qspro-db:' + tmp]);
const sql = `
\\set ON_ERROR_STOP on
begin;
create table if not exists quarantine.etl_rejects (id bigserial primary key, run_at timestamptz default now(), table_name text, row_data jsonb, error text);
truncate quarantine.etl_rejects;
truncate ${THU_TU.map(function (t) { return 'public.' + t; }).join(', ')} cascade;
do $$
declare d jsonb := pg_read_file('${tmp}')::jsonb; t text; r jsonb; cols text; n int; bad int; fixd int; cname text; fkcol text;
begin
  foreach t in array array[${THU_TU.map(function (t) { return "'" + t + "'"; }).join(',')}] loop
    n := 0; bad := 0; fixd := 0;
    for r in select * from jsonb_array_elements(d->t) loop
      select string_agg(quote_ident(k), ',') into cols from jsonb_object_keys(r) k;
      begin
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', t, cols, cols, t) using r;
        n := n + 1;
      exception when foreign_key_violation then
        -- người gửi / người sửa đã bị xoá: schema quy định ON DELETE SET NULL -> để trống tham chiếu rồi nạp (giống lần chuyển trước)
        get stacked diagnostics cname = constraint_name;
        fkcol := substring(cname from '^fk_' || t || '_(requester_id|changed_by_id)$');
        if fkcol is not null then
          begin
            r := r - fkcol;
            select string_agg(quote_ident(k), ',') into cols from jsonb_object_keys(r) k;
            execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', t, cols, cols, t) using r;
            n := n + 1; fixd := fixd + 1;
          exception when others then
            insert into quarantine.etl_rejects(table_name, row_data, error) values (t, r, sqlerrm); bad := bad + 1;
          end;
        else
          insert into quarantine.etl_rejects(table_name, row_data, error) values (t, r, sqlerrm); bad := bad + 1;
        end if;
      when others then
        insert into quarantine.etl_rejects(table_name, row_data, error) values (t, r, sqlerrm); bad := bad + 1;
      end;
    end loop;
    raise notice '% : % dòng nạp (% dòng để trống người gửi đã xoá), % dòng cách ly', t, n, fixd, bad;
  end loop;
end $$;
-- đặt lại bộ đếm id (identity) = id lớn nhất đã nạp
do $$ declare s record; mx bigint; begin
  for s in select c.relname tbl, a.attname col, pg_get_serial_sequence('public.'||c.relname, a.attname) seq from pg_class c join pg_attribute a on a.attrelid=c.oid
    where c.relnamespace='public'::regnamespace and c.relkind='r' and a.attidentity in ('a','d') loop
    execute format('select max(%I) from public.%I', s.col, s.tbl) into mx;
    if s.seq is not null then perform setval(s.seq, coalesce(mx, 0) + 1, false); end if;
  end loop; end $$;
commit;
select table_name||' | '||left(error,160)||' | x'||count(*) from quarantine.etl_rejects group by table_name, left(error,160) order by 1;
`;
const out = cp.spawnSync('docker', ['exec', '-i', 'qspro-db', 'psql', '-U', 'qspro', '-d', 'qspro', '-Atq'], { input: sql, maxBuffer: 1 << 28 });
console.log(String(out.stderr).replace(/psql:<stdin>:\d+: NOTICE:\s*/g, '  ').trim());
const lo = String(out.stdout).trim();
console.log(lo ? '\nCÁCH LY (vi phạm ràng buộc):\n' + lo : '\nKhông có dòng nào bị cách ly.');
if (out.status !== 0) process.exit(1);
