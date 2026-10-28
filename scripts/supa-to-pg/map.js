'use strict';
/* Ánh xạ cột BẢNG MỚI (tiếng Anh, schema qspro_en2) <- BẢNG CŨ (Supabase). Dùng chung cho load.js (nạp dữ liệu) và compat.js (view tên cũ). */
const AUTO = JSON.parse(JSON.stringify(require('./mapping.auto.json')));
const CT = require('../../public/ct-spec.js');

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

// Điện lạnh (public/dl-spec.js) — bảng thông số product_hvac_specs (db/pg/dien_lanh.sql), cột cũ = cột DB trong dl-spec.js.
// Ngành mới sau khi chuyển khỏi Supabase nên bản chụp không có cột này: compat.js tự nối thêm vào view db_san_pham.
const DL_COLS = { unit_type: 'loai_may', cooling_capacity_kw: 'cs_lanh_kw', capacity_hp: 'cs_hp', capacity_btu: 'cs_btu', operation_mode: 'che_do_van_hanh',
  compressor_type: 'may_nen', refrigerant: 'moi_chat_lanh', power_supply: 'dien_nguon_dl', origin_country: 'xuat_xu',
  power_input_kw: 'cs_dien_kw', energy_efficiency: 'hieu_suat_nl', energy_label: 'nhan_nang_luong', airflow_m3h: 'luu_luong_gio',
  indoor_noise_db: 'do_on_dan_lanh', outdoor_noise_db: 'do_on_dan_nong', cooling_area: 'pham_vi_lam_lanh', air_filtration: 'loc_khi', control_type: 'dk_dieu_hoa',
  liquid_pipe: 'ong_long', gas_pipe: 'ong_hoi', max_pipe_length_m: 'ong_dai_max', max_height_diff_m: 'chenh_cao_max', drain_pipe: 'ong_thoat_nuoc',
  power_cable: 'day_nguon', control_cable: 'day_dieu_khien', panel_model: 'mat_na', max_indoor_units: 'so_dan_lanh_max', refrigerant_charge: 'gas_nap',
  indoor_unit_dimensions: 'kt_dan_lanh', indoor_unit_weight_kg: 'kl_dan_lanh', outdoor_unit_dimensions: 'kt_dan_nong', outdoor_unit_weight_kg: 'kl_dan_nong',
  panel_cutout_size: 'kt_mat_na', installation_location: 'vi_tri_lap_dat', outdoor_bracket: 'gia_do_dan_nong', min_clearance: 'kc_lap_min',
  installation_note: 'gc_lap_dat', material_spec: 'quy_cach_vt' };
AUTO.product_hvac_specs = { from: 'db_san_pham', cols: Object.assign({ product_id: 'id' }, DL_COLS) };

const SPEC = { product_lighting_specs: 1, product_paint_specs: 1, product_sanitary_specs: 1, product_switch_socket_specs: 1, product_hvac_specs: 1 };
const THU_TU = ['companies', 'users', 'products', 'product_lighting_specs', 'product_paint_specs', 'product_sanitary_specs', 'product_switch_socket_specs', 'product_hvac_specs',
  'product_combos', 'favorite_products', 'product_histories', 'audit_logs', 'notifications', 'delete_requests', 'projects', 'project_data_entries',
  'quotation_lines', 'cost_estimate_lines', 'purchase_orders', 'purchase_order_items', 'purchase_proposals', 'work_items', 'work_item_histories'];

// {cột mới: cột cũ} đã gộp mapping.auto.json + SUA (bỏ cột đặt null)
function colsOf(t) {
  const m = AUTO[t]; if (!m) throw new Error('Thiếu ánh xạ ' + t);
  const cols = Object.assign({}, m.cols, SUA[t] || {});
  Object.keys(cols).forEach(function (k) { if (cols[k] == null) delete cols[k]; });
  return cols;
}
module.exports = { AUTO: AUTO, SUA: SUA, SPEC: SPEC, THU_TU: THU_TU, colsOf: colsOf, DL_COLS: DL_COLS };
