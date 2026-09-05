-- ════════════════════════════════════════════════════════════════
-- TÊN CHIP LED — tách riêng khỏi LOẠI CHIP LED
--   ten_chip_led  : hãng / model chip (Bridgelux, Cree Mỹ, Samsung LM301B…)
--   loai_chip_led : loại đóng gói     (COB / SMD / Modul)
-- CHẠY FILE NÀY TRƯỚC. Muốn dọn dữ liệu cũ thì chạy tiếp db/chip_name_migrate.sql
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham add column if not exists ten_chip_led text;
notify pgrst, 'reload schema';
