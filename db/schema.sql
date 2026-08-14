-- ============================================================
-- QS PRO — Schema Supabase (Postgres)  |  chạy 1 lần trong SQL Editor
-- Dùng đúng mã cột API theo "Từ điển trường" trên Google Sheet.
-- ============================================================

-- ---------- 1) DANH MỤC SẢN PHẨM ----------
create table if not exists db_san_pham (
  id               bigint generated always as identity primary key,
  ma_sp            text unique,
  ten_sp           text not null,
  dong_sp          text,
  hang_muc         text,
  nhom_sp          text,
  thuong_hieu      text,
  nha_cung_cap     text,
  cong_suat_w      numeric,
  nhiet_do_mau_k   text,
  quang_thong_lm   numeric,
  goc_chieu_deg    text,
  goc_nghieng_deg  text,
  mau_sac          text,
  chat_lieu        text,
  chieu_cao_mm     numeric,
  duong_kinh_mm    numeric,
  cutout_mm        numeric,
  chi_so_ip        text,
  cri              text,
  hieu_suat_lm_w   numeric,
  ugr              text,
  sdcm             text,
  coi              text,
  tuoi_tho         text,
  loai_chip_led    text,
  class_rating     text,
  lap_nguon_roi    boolean,
  ten_bo_nguon     text,
  ma_bo_nguon      text,
  hang_bo_nguon    text,
  vi_tri_lap_nguon text,
  dieu_khien       text,
  dong_ra_max_ma   numeric,
  bao_hanh_nam     numeric,
  dvt              text,
  gia_ban_le       numeric,
  ck_dai_ly_pct    numeric,
  gia_dai_ly       numeric generated always as (round(coalesce(gia_ban_le,0) * (1 - coalesce(ck_dai_ly_pct,0)/100.0))) stored,
  anh_sp           text,          -- URL ảnh (nhiều ảnh cách nhau bằng xuống dòng, ảnh đầu = ảnh chính)
  link_datasheet   text,
  trang_thai       text,
  ghi_chu          text,
  ngay_cap_nhat    timestamptz default now()
);
create index if not exists idx_sp_hang_muc on db_san_pham (hang_muc);
create index if not exists idx_sp_thuong_hieu on db_san_pham (thuong_hieu);

-- ---------- 2) CHI TIẾT BÁO GIÁ ----------
create table if not exists db_bao_gia (
  id                bigint generated always as identity primary key,
  ma_du_an          text,
  stt               text,
  khu_vuc           text,
  phong             text,
  ma_so_ban_ve      text,
  ma_sp             text,
  ten_sp            text,
  thuong_hieu       text,
  dvt               text,
  so_luong          numeric default 0,
  gia_dai_ly        numeric default 0,   -- giá vốn (dẫn từ SP)
  loi_nhuan_pct     numeric default 0,
  gia_ban           numeric default 0,   -- = gia_dai_ly*(1+loi_nhuan_pct/100)
  ck_khach_hang_pct numeric default 0,
  don_gia           numeric default 0,   -- = gia_ban*(1-ck_khach_hang_pct/100)
  thanh_tien        numeric default 0,   -- = don_gia*so_luong
  markup_pct        numeric default 0,
  margin_pct        numeric default 0,
  loi_nhuan_vnd     numeric default 0,
  trang_thai        text,
  ghi_chu           text,
  sort_no           numeric default 0,
  created_at        timestamptz default now()
);
create index if not exists idx_bg_ma_du_an on db_bao_gia (ma_du_an);

-- ---------- 3) DỰ ÁN ----------
create table if not exists du_an (
  id           bigint generated always as identity primary key,
  ma_da        text unique,
  ten_du_an    text,
  khach_hang   text,
  dia_chi      text,
  sdt          text,
  trang_thai   text,
  vat_pct      numeric default 0,
  tien_do_pct  numeric default 0,
  ghi_chu      text,
  quy_mo       text,
  tong_dt      text,
  dt_bao_gia   text,
  nhu_cau      text,
  phan_khuc    text,
  ma_bao_gia   text,
  nhom_tu_tao  text,
  tang_tu_tao  text,
  ngay_tao     timestamptz default now(),
  cap_nhat     timestamptz default now()
);

-- ---------- 4) KHÁI TOÁN (tờ bìa) ----------
create table if not exists khai_toan (
  id       bigint generated always as identity primary key,
  ma_da    text,
  stt      text,
  hang_muc text,
  mo_ta    text,
  chi_phi  numeric default 0,
  sort_no  numeric default 0
);
create index if not exists idx_kt_ma_da on khai_toan (ma_da);

-- ---------- 5) MUA HÀNG ----------
-- Mỗi đơn = 1 nhà cung cấp, cho 1 bản nháp (ma_du_an = ma_da), trong 1 hạng mục bóc tách.
create table if not exists don_mua_hang (
  id             bigint generated always as identity primary key,
  ma_don         text unique,                 -- mã đơn tự sinh (MH-...)
  ma_du_an       text,                         -- = du_an.ma_da của bản nháp
  ten_du_an      text,
  hang_muc       text,                         -- node bóc tách (vd '3.2' / tên hạng mục)
  nha_cung_cap   text,
  so_sp          integer default 0,
  tong_truoc_vat numeric default 0,
  vat_pct        numeric default 0,
  vat            numeric default 0,
  tong_cong      numeric default 0,            -- = tong_truoc_vat + vat
  trang_thai     text default 'Đã gửi',        -- Đã gửi / Đã nhận / Huỷ
  kenh_gui       text default 'Lark',
  ket_qua_gui    text,                          -- ok / lỗi
  nguoi_gui      text,
  phong_ban      text,
  ghi_chu        text,
  ngay_gui       timestamptz default now()
);
create index if not exists idx_dmh_ma_du_an on don_mua_hang (ma_du_an);
create index if not exists idx_dmh_ncc on don_mua_hang (nha_cung_cap);

-- Chi tiết từng SP trong đơn mua hàng (snapshot tại thời điểm gửi)
create table if not exists chi_tiet_mua_hang (
  id           bigint generated always as identity primary key,
  ma_don       text,                            -- -> don_mua_hang.ma_don
  ma_sp        text,
  ten_sp       text,
  thuong_hieu  text,
  phong        text,
  dvt          text,
  so_luong     numeric default 0,
  don_gia      numeric default 0,               -- giá mua (giá đại lý)
  thanh_tien   numeric default 0,               -- = so_luong * don_gia
  hinh_anh     text,
  sort_no      integer default 0
);
create index if not exists idx_ctmh_ma_don on chi_tiet_mua_hang (ma_don);
