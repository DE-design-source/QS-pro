-- Bảng cong_ty chưa tắt RLS nên app (dùng publishable key) không đọc/ghi được.
alter table public.cong_ty disable row level security;
grant all on public.cong_ty to anon, authenticated, service_role;

-- Tạo lại công ty Dezon và gắn ĐÚNG id mà dữ liệu cũ đang trỏ tới
insert into public.cong_ty (id, ten, ma, tinh_nang, gioi_han_user, active)
select '90c41ced-2477-4342-97da-e226344354f1'::uuid, 'Dezon', 'dezon',
       'dash,boc,chiphi,export,muahang,duan,sanpham,import', 50, true
where not exists (select 1 from public.cong_ty where id = '90c41ced-2477-4342-97da-e226344354f1');

notify pgrst, 'reload schema';
