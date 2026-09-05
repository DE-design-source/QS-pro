-- Cho phép công ty dùng chung DANH SÁCH SẢN PHẨM của Dezon (kho mẫu)
alter table public.cong_ty add column if not exists dung_sp_dezon boolean default false;
notify pgrst, 'reload schema';
