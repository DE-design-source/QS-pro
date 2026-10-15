'use strict';
/* Sinh db/pg/compat_views.sql — schema "qs" gồm các VIEW mang TÊN BẢNG / CỘT CŨ (Supabase) trỏ vào bảng mới tiếng Anh,
   để server (store_supa / auth qua server/pgrest.js) chạy nguyên logic cũ trên Postgres mới.
   - Bảng 1-1: view đơn giản -> Postgres tự cho ghi xuyên view. cong_ty_id của bảng con lấy từ bảng cha (chỉ đọc).
   - db_san_pham (products + 4 bảng thông số), du_an_data (project_data_entries + company_settings), chi_tiet_de_xuat
     (proposal_discount_items + proposal_payment_installments): trigger INSTEAD OF chia dòng về đúng bảng.
   Đọc cấu trúc bảng mới từ Postgres docker; cột cũ lấy từ bản chụp export/supa-snapshot.
   Chạy: node scripts/supa-to-pg/compat.js  (ghi file)  rồi psql -f db/pg/compat_views.sql                          */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { AUTO, colsOf } = require('./map.js');
const SNAP = path.join(__dirname, '..', '..', 'export', 'supa-snapshot');
const OUT = path.join(__dirname, '..', '..', 'db', 'pg', 'compat_views.sql');

const meta = JSON.parse(cp.execFileSync('docker', ['exec', 'qspro-db', 'psql', '-U', 'qspro', '-d', 'qspro', '-Atc',
  `select json_agg(json_build_object('t',table_name,'c',column_name,'gen',is_generated='ALWAYS','id',is_identity='YES','def',column_default) order by table_name, ordinal_position)
   from information_schema.columns where table_schema='public'`]).toString());
const COL = {}; meta.forEach(function (m) { (COL[m.t] = COL[m.t] || {})[m.c] = m; });
function cotCu(t) {
  const a = JSON.parse(fs.readFileSync(path.join(SNAP, t + '.json'), 'utf8')); const ks = [];
  a.forEach(function (r) { Object.keys(r).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); }); });
  return ks;
}
const q = function (x) { return '"' + x + '"'; };
const L = [];
L.push('-- TỰ SINH bởi scripts/supa-to-pg/compat.js — đừng sửa tay. Chạy lại được nhiều lần.');
L.push('begin;', 'drop schema if exists qs cascade;', 'create schema qs;', '');

// ---- 1. bảng 1-1 ----
const CHA = {   // cong_ty_id của bảng con = company_id của bảng cha
  sp_combo: '(select p.company_id from public.products p where p.id = t.product_id)',
  db_bao_gia: '(select p.company_id from public.projects p where p.project_code = t.project_code)',
  khai_toan: '(select p.company_id from public.projects p where p.project_code = t.project_code)',
  chi_tiet_mua_hang: '(select o.company_id from public.purchase_orders o where o.order_code = t.order_code)'
};
const canhBao = [];
Object.keys(AUTO).forEach(function (moi) {
  const cu = AUTO[moi].from;
  if (cu === 'db_san_pham' || cu === 'du_an_data') return;
  const m = colsOf(moi), nguoc = {};
  Object.keys(m).forEach(function (k) { if (!COL[moi][k]) throw new Error(moi + '.' + k + ' không có'); if (nguoc[m[k]]) canhBao.push(cu + '.' + m[k] + ' trùng: ' + nguoc[m[k]] + ' / ' + k); else nguoc[m[k]] = k; });
  const sel = cotCu(cu).map(function (c) {
    if (nguoc[c]) return 't.' + q(nguoc[c]) + (nguoc[c] === c ? '' : ' as ' + q(c));
    if (c === 'cong_ty_id' && CHA[cu]) return CHA[cu] + ' as cong_ty_id';
    throw new Error('Cột cũ ' + cu + '.' + c + ' không có chỗ trong bảng mới');
  });
  L.push('create view qs.' + q(cu) + ' as select ' + sel.join(', ') + ' from public.' + q(moi) + ' t;');
});
L.push('');

// ---- 2. db_san_pham = products + 4 bảng thông số ----
const SP = ['products', 'product_lighting_specs', 'product_paint_specs', 'product_sanitary_specs', 'product_switch_socket_specs'];
const BI = { products: 'p', product_lighting_specs: 'l', product_paint_specs: 'n', product_sanitary_specs: 'v', product_switch_socket_specs: 'c' };
const spNguoc = {}, spGhi = {};   // cột cũ -> [bảng, cột mới]; bảng -> [[mới, cũ]] ghi được
const colsSP = Object.assign({}, colsOf('products'), { dealer_price: 'gia_dai_ly' });     // dealer_price tự tính: chỉ đọc
SP.forEach(function (t) {
  const m = t === 'products' ? colsSP : colsOf(t); spGhi[t] = [];
  Object.keys(m).forEach(function (k) {
    if (t !== 'products' && k === 'product_id') return;
    if (spNguoc[m[k]]) { canhBao.push('db_san_pham.' + m[k] + ' trùng ' + spNguoc[m[k]].join('.') + ' / ' + t + '.' + k); return; }
    spNguoc[m[k]] = [t, k];
    if (!COL[t][k].gen && !(t === 'products' && k === 'id')) spGhi[t].push([k, m[k]]);
  });
});
const spCu = cotCu('db_san_pham');
spCu.forEach(function (c) { if (!spNguoc[c]) throw new Error('db_san_pham.' + c + ' không có chỗ'); });
L.push('create view qs.db_san_pham as select ' + spCu.map(function (c) { const x = spNguoc[c]; return BI[x[0]] + '.' + q(x[1]) + (x[1] === c ? '' : ' as ' + q(c)); }).join(', ') +
  ' from public.products p' + SP.slice(1).map(function (t) { return ' left join public.' + t + ' ' + BI[t] + ' on ' + BI[t] + '.product_id = p.id'; }).join('') + ';');
const nw = function (ds) { return ds.map(function (x) { return 'NEW.' + q(x[1]); }).join(', '); };
L.push(`create function qs.db_san_pham_ghi() returns trigger language plpgsql as $f$
declare vid bigint;
begin
  if TG_OP = 'DELETE' then delete from public.products where id = OLD.id; return OLD; end if;
  if TG_OP = 'INSERT' then
    insert into public.products (id, ${spGhi.products.map(function (x) { return q(x[0]); }).join(', ')}) values (NEW.id, ${nw(spGhi.products)}) returning id into vid;
  else
    update public.products set (${spGhi.products.map(function (x) { return q(x[0]); }).join(', ')}) = row(${nw(spGhi.products)}) where id = OLD.id;
    vid := OLD.id;
  end if;
${SP.slice(1).map(function (t) {
  const ds = spGhi[t]; const cs = ds.map(function (x) { return q(x[0]); }).join(', ');
  return `  if concat(${nw(ds)}) <> '' then
    insert into public.${t} (product_id, ${cs}) values (vid, ${nw(ds)})
      on conflict (product_id) do update set (${cs}) = row(${ds.map(function (x) { return 'excluded.' + q(x[0]); }).join(', ')});
  else delete from public.${t} where product_id = vid; end if;`;
}).join('\n')}
  select * into NEW from qs.db_san_pham where id = vid;
  return NEW;
end $f$;
create trigger ghi instead of insert or update or delete on qs.db_san_pham for each row execute function qs.db_san_pham_ghi();`);

// mặc định của cột view (view có trigger không tự lấy mặc định của bảng gốc)
function macDinh(view, ds) {   // ds: [[bảng, cột mới, cột cũ]]
  ds.forEach(function (x) {
    const c = COL[x[0]][x[1]]; let d = c.def;
    if (c.id) d = "nextval(pg_get_serial_sequence('public." + x[0] + "', '" + x[1] + "'))";
    if (d) L.push('alter view qs.' + view + ' alter column ' + q(x[2]) + ' set default ' + d + ';');
  });
}
macDinh('db_san_pham', spCu.map(function (c) { return [spNguoc[c][0], spNguoc[c][1], c]; }));
L.push('');

// ---- 3. du_an_data: dữ liệu theo dự án + dữ liệu dùng chung công ty (ma_da '__cty:<id công ty>', bản cũ '__cty') ----
L.push(`create view qs.du_an_data as
  select e.project_code as ma_da, e.data_key as khoa, e.data_value as gia_tri, pr.company_id as cong_ty_id, e.updated_at as cap_nhat, e.updated_by as nguoi_sua
    from public.project_data_entries e left join public.projects pr on pr.project_code = e.project_code
  union all
  select '__cty' || coalesce(':' || s.company_id::text, ''), s.setting_key, s.setting_value, s.company_id, s.updated_at, s.updated_by from public.company_settings s;
alter view qs.du_an_data alter column cap_nhat set default now();
create function qs.du_an_data_ghi() returns trigger language plpgsql as $f$
declare r record; cty uuid;
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    if OLD.ma_da like '\\_\\_cty%' then delete from public.company_settings where company_id is not distinct from OLD.cong_ty_id and setting_key = OLD.khoa;
    else delete from public.project_data_entries where project_code = OLD.ma_da and data_key = OLD.khoa; end if;
    if TG_OP = 'DELETE' then return OLD; end if;
  end if;
  if NEW.ma_da like '\\_\\_cty%' then
    cty := coalesce(nullif(substring(NEW.ma_da from 7), '')::uuid, NEW.cong_ty_id);
    insert into public.company_settings (company_id, setting_key, setting_value, updated_at, updated_by)
      values (cty, NEW.khoa, NEW.gia_tri, coalesce(NEW.cap_nhat, now()), NEW.nguoi_sua)
      on conflict (company_id, setting_key) do update set setting_value = excluded.setting_value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  else
    insert into public.project_data_entries (project_code, data_key, data_value, updated_at, updated_by)
      values (NEW.ma_da, NEW.khoa, NEW.gia_tri, coalesce(NEW.cap_nhat, now()), NEW.nguoi_sua)
      on conflict (project_code, data_key) do update set data_value = excluded.data_value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;
  select * into r from qs.du_an_data d where d.ma_da = NEW.ma_da and d.khoa = NEW.khoa limit 1;
  NEW.cong_ty_id := r.cong_ty_id; NEW.cap_nhat := r.cap_nhat;
  return NEW;
end $f$;
create trigger ghi instead of insert or update or delete on qs.du_an_data for each row execute function qs.du_an_data_ghi();
`);

// ---- 4. chi_tiet_de_xuat: phiếu 'ck' -> dòng giảm giá; phiếu 'tt' -> đợt thanh toán (ten_sp = tên đợt) ----
L.push(`create view qs.chi_tiet_de_xuat as
  select d.id, d.proposal_code as ma_de_xuat, d.sort_order as sort_no, d.product_code as ma_sp, d.product_name as ten_sp, d.brand as thuong_hieu,
         d.room as phong, d.unit as dvt, d.quantity as so_luong, d.original_unit_price as don_gia_goc, d.rate_pct as ty_le_pct, d.unit_price as don_gia,
         d.amount as thanh_tien, null::date as ngay_du_kien, null::text as ghi_chu, d.image_urls as hinh_anh, pp.company_id as cong_ty_id
    from public.proposal_discount_items d join public.purchase_proposals pp on pp.proposal_code = d.proposal_code
  union all
  select -i.id, i.proposal_code, i.sort_order, null, i.label, null, null, null, null, null, i.rate_pct, null, i.amount, i.due_date, i.note, null, pp.company_id
    from public.proposal_payment_installments i join public.purchase_proposals pp on pp.proposal_code = i.proposal_code;
create function qs.chi_tiet_de_xuat_ghi() returns trigger language plpgsql as $f$
declare loai text; vid bigint;
begin
  if TG_OP = 'DELETE' then
    if OLD.id < 0 then delete from public.proposal_payment_installments where id = -OLD.id; else delete from public.proposal_discount_items where id = OLD.id; end if;
    return OLD;
  end if;
  if TG_OP = 'UPDATE' then raise exception 'chi_tiet_de_xuat: không sửa dòng, xoá rồi thêm lại'; end if;
  select proposal_type into loai from public.purchase_proposals where proposal_code = NEW.ma_de_xuat;
  if loai is null then raise exception 'Không có đề xuất %', NEW.ma_de_xuat using errcode = '23503'; end if;
  if loai = 'tt' then
    insert into public.proposal_payment_installments (proposal_code, sort_order, label, rate_pct, amount, due_date, note)
      values (NEW.ma_de_xuat, coalesce(NEW.sort_no, 0), NEW.ten_sp, coalesce(NEW.ty_le_pct, 0), coalesce(NEW.thanh_tien, 0), NEW.ngay_du_kien, NEW.ghi_chu) returning -id into vid;
  else
    insert into public.proposal_discount_items (proposal_code, sort_order, product_code, product_name, brand, room, unit, quantity, original_unit_price, rate_pct, unit_price, amount, image_urls)
      values (NEW.ma_de_xuat, coalesce(NEW.sort_no, 0), NEW.ma_sp, NEW.ten_sp, NEW.thuong_hieu, NEW.phong, NEW.dvt, coalesce(NEW.so_luong, 0), coalesce(NEW.don_gia_goc, 0),
              coalesce(NEW.ty_le_pct, 0), coalesce(NEW.don_gia, 0), coalesce(NEW.thanh_tien, 0), NEW.hinh_anh) returning id into vid;
  end if;
  select * into NEW from qs.chi_tiet_de_xuat where id = vid;
  return NEW;
end $f$;
create trigger ghi instead of insert or update or delete on qs.chi_tiet_de_xuat for each row execute function qs.chi_tiet_de_xuat_ghi();
`);
L.push('commit;');
fs.writeFileSync(OUT, L.join('\n') + '\n');
console.log('Đã ghi ' + path.relative(process.cwd(), OUT) + ' (' + L.length + ' dòng)');
if (canhBao.length) console.log('Cột cũ khớp 2 cột mới (lấy cột đầu):\n  ' + canhBao.join('\n  '));
