-- ════════════════════════════════════════════════════════════════
-- DỌN DỮ LIỆU CHIP CŨ (tuỳ chọn — chạy 1 lần, sau db/chip_name.sql)
-- Trước khi có cột "Tên chip LED", người nhập ghi TÊN HÃNG vào cột "Loại chip LED"
-- (Cree Mỹ, Osram, Bridgelux…). Câu lệnh dưới chuyển các giá trị đó sang đúng cột tên,
-- và chỉ giữ lại COB/SMD/Modul ở cột loại.
--
-- Chỉ đụng tới dòng CHƯA có tên chip -> chạy lại nhiều lần cũng không hỏng dữ liệu.
-- ════════════════════════════════════════════════════════════════

-- Xem trước sẽ đổi những gì (chạy riêng nếu muốn kiểm tra):
-- select loai_chip_led, count(*) from public.db_san_pham
--  where coalesce(ten_chip_led,'') = '' and coalesce(loai_chip_led,'') <> ''
--    and loai_chip_led not in ('COB','SMD','Modul','SMD 2835','SMD 3030','SMD 5730')
--  group by 1 order by 2 desc;

update public.db_san_pham
   set ten_chip_led = loai_chip_led,
       -- đoán lại LOẠI từ chính chuỗi cũ; không đoán được thì để trống cho người dùng chọn sau
       loai_chip_led = case
         when loai_chip_led ilike '%COB%' then 'COB'
         when loai_chip_led ilike '%SMD%' then 'SMD'
         when loai_chip_led ilike '%modul%' then 'Modul'
         else null
       end
 where coalesce(ten_chip_led, '') = ''
   and coalesce(loai_chip_led, '') <> ''
   and loai_chip_led not in ('COB', 'SMD', 'Modul', 'SMD 2835', 'SMD 3030', 'SMD 5730');

notify pgrst, 'reload schema';
