-- Nhắc gia hạn: ghi lại mốc đã nhắc để không gửi trùng nhiều lần trong ngày
alter table public.cong_ty add column if not exists nhac_lan_cuoi date;   -- ngày gửi nhắc gần nhất
alter table public.cong_ty add column if not exists nhac_moc int;         -- mốc đã nhắc (30/14/7/3/1/0)
notify pgrst, 'reload schema';
