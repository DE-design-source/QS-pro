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
const CT = require('../../public/ct-spec.js');
const AUTO = require('./mapping.auto.json');
function pg(sql, input) { return cp.execFileSync('docker', ['exec', '-i', 'qspro-db', 'psql', '-U', 'qspro', '-d', 'qspro', '-v', 'ON_ERROR_STOP=1', '-Atq'].concat(input ? [] : ['-c', sql]), { input: input, maxBuffer: 1 << 28 }).toString(); }
function cu(t) { return JSON.parse(fs.readFileSync(path.join(SNAP, t + '.json'), 'utf8')); }

// Cột trống trong dump (không dò được) / dò nhầm -> đặt tay theo tên. null = bỏ cột (để mặc định của DB)
const SUA = {
  users: { last_login_at: 'last_login' },
  companies: { primary_color: 'mau_chinh' },
  products: { dealer_price: null },                                   // cột TỰ TÍNH (generated) — không ghi
  product_lighting_specs: { coi: 'coi' },
  product_paint_specs: { particle_characteristics: 'dac_tinh_hat' },
  product_sanitary_specs: { bowl_count: 'so_ho', faucet_hole_count: 'so_lo_voi', thickness: 'do_day' },
  product_combos: { note: 'ghi_chu' },
  delete_requests: { requester_id: 'requester_id', note: 'note' },
  projects: { note: 'ghi_chu', project_scale: 'quy_mo', total_area: 'tong_dt', quoted_area: 'dt_bao_gia', requirements: 'nhu_cau',
    segment: 'phan_khuc', quotation_code: 'ma_bao_gia', custom_groups: 'nhom_tu_tao', custom_floors: 'tang_tu_tao' },
  quotation_lines: { zone: 'khu_vuc', drawing_code: 'ma_so_ban_ve', status: 'trang_thai', note: 'ghi_chu', sort_order: 'sort_no',
    is_saved_to_catalog: 'da_luu_dm' },
  purchase_proposals: { vat_amount: 'vat', total_amount: 'tong_cong', note: 'ghi_chu', resolver_name: 'nguoi_duyet', resolved_at: 'ngay_duyet' },
  work_items: { image_urls: 'hinh_anh', specifications: 'thong_so', scope: 'pham_vi', document_url: 'link_tai_lieu', approved_by: 'nguoi_duyet',
    approved_at: 'ngay_duyet', supplier_name: 'nha_cung_cap', takeoff_section: 'de_muc', updated_by: 'nguoi_sua' }
};
// Công tắc - ổ cắm: bảng thông số mới có ĐÚNG 39 cột theo thứ tự cột DB của public/ct-spec.js (trừ 4 cột dùng chung nằm ở products)
const CHUNG_SP = { mau_sac: 1, chat_lieu: 1, chi_so_ip: 1, kieu_lap_dat: 1 };
const CT_COLS = Object.values(CT.METRIC).map(function (m) { return m[0]; }).filter(function (c) { return !CHUNG_SP[c]; });
const CT_NEW = ['component_type', 'socket_count', 'plug_type', 'gang_count', 'circuit_type', 'operation_type', 'indicator_light', 'safety_shutter',
  'pack_quantity', 'rated_current_a', 'rated_voltage_v', 'max_power_w', 'max_load_power_w', 'min_load_power_w', 'load_type', 'operation_cycles',
  'frequency_hz', 'contact_material', 'flame_resistance', 'standards', 'certifications', 'usb_a_port_count', 'usb_c_port_count', 'usb_charging_power_w',
  'usb_output', 'signal_connector_type', 'smart_integration', 'connectivity_protocol', 'compatible_ecosystem', 'neutral_wire', 'sensor_type',
  'smart_features', 'module_count', 'face_width_mm', 'face_height_mm', 'face_depth_mm', 'mounting_box_type', 'min_box_depth_mm', 'max_wire_cross_section'];
// so khớp theo THỨ TỰ cột của file SQL đã chạy (db/cong_tac_o_cam.sql liệt kê đúng thứ tự này)
const CT_SQL_ORDER = ['thanh_phan', 'so_o_cam', 'kieu_chau', 'so_nut', 'kieu_mach', 'kieu_thao_tac', 'den_bao', 'man_che', 'quy_cach', 'dong_dm_a', 'dien_ap_v',
  'cong_suat_max_w', 'cong_suat_tai_max_w', 'cong_suat_tai_min_w', 'loai_tai', 'tuoi_tho_lan', 'tan_so_hz', 'vat_lieu_tiep_diem', 'chong_chay', 'tieu_chuan',
  'chung_nhan', 'so_usb_a', 'so_usb_c', 'cong_suat_sac_w', 'usb_ra', 'loai_tin_hieu', 'thong_minh', 'giao_thuc', 'he_sinh_thai', 'day_trung_tinh',
  'loai_cam_bien', 'tinh_nang_tm', 'so_module', 'rong_mm', 'cao_mm', 'sau_mm', 'loai_de', 'sau_hop_am_mm', 'tiet_dien_day'];
if (CT_SQL_ORDER.length !== CT_NEW.length || CT_COLS.some(function (c) { return CT_SQL_ORDER.indexOf(c) < 0; })) throw new Error('Cột công tắc - ổ cắm lệch với ct-spec.js');
AUTO.product_switch_socket_specs = { from: 'db_san_pham', cols: { product_id: 'id' } };
CT_NEW.forEach(function (c, i) { AUTO.product_switch_socket_specs.cols[c] = CT_SQL_ORDER[i]; });

const SPEC = { product_lighting_specs: 1, product_paint_specs: 1, product_sanitary_specs: 1, product_switch_socket_specs: 1 };
const THU_TU = ['companies', 'users', 'products', 'product_lighting_specs', 'product_paint_specs', 'product_sanitary_specs', 'product_switch_socket_specs',
  'product_combos', 'favorite_products', 'product_histories', 'audit_logs', 'notifications', 'delete_requests', 'projects', 'project_data_entries',
  'quotation_lines', 'cost_estimate_lines', 'purchase_orders', 'purchase_order_items', 'purchase_proposals', 'work_items', 'work_item_histories'];

const goi = {}, tom = {};
THU_TU.forEach(function (t) {
  const m = AUTO[t]; if (!m) throw new Error('Thiếu ánh xạ ' + t);
  const cols = Object.assign({}, m.cols, SUA[t] || {});
  Object.keys(cols).forEach(function (k) { if (cols[k] == null) delete cols[k]; });
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
