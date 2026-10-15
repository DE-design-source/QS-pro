          `-- ════════════════════════════════════════════════════════════════
          --  CÔNG TẮC - Ổ CẮM (đề mục 3.2.6.2) — thêm cột thông số vào db_san_pham
          --  Nguồn trường: public/ct-spec.js (theo file THIẾT_BỊ_Ổ_CẮM_CÔNG_TẮC.xlsx — sheet TỪ ĐIỂN TRƯỜNG)
          --  Hạng mục: Ổ cắm điện · Ổ cắm sạc USB · Ổ cắm tín hiệu · Ổ cắm âm sàn / âm bàn · Ổ cắm thông minh · Ổ cắm khác
          --            Công tắc cơ · Công tắc cảm ứng · Công tắc thông minh · Dimmer / điều tốc quạt · Công tắc cảm biến
          --            Nút nhấn / chuông · Công tắc thẻ từ / chìa khoá phòng · Công tắc khác
          --  Mọi cột là TEXT (cho nhập "16A", "50/60", "2.5 / 4"…). Các cột dùng chung với ngành khác
          --  (mau_sac, chat_lieu, chi_so_ip, kieu_lap_dat, bao_hanh_nam, nganh…) đã có sẵn.
          --  Chạy 1 lần trong Supabase → SQL Editor. Chạy lại không sao (if not exists).
          -- ════════════════════════════════════════════════════════════════
          alter table public.db_san_pham
            add column if not exists thanh_phan text,
            add column if not exists so_o_cam text,
            add column if not exists kieu_chau text,
            add column if not exists so_nut text,
            add column if not exists kieu_mach text,
            add column if not exists kieu_thao_tac text,
            add column if not exists den_bao text,
            add column if not exists man_che text,
            add column if not exists quy_cach text,
            add column if not exists dong_dm_a text,
            add column if not exists dien_ap_v text,
            add column if not exists cong_suat_max_w text,
            add column if not exists cong_suat_tai_max_w text,
            add column if not exists cong_suat_tai_min_w text,
            add column if not exists loai_tai text,
            add column if not exists tuoi_tho_lan text,
            add column if not exists tan_so_hz text,
            add column if not exists vat_lieu_tiep_diem text,
            add column if not exists chong_chay text,
            add column if not exists tieu_chuan text,
            add column if not exists chung_nhan text,
            add column if not exists so_usb_a text,
            add column if not exists so_usb_c text,
            add column if not exists cong_suat_sac_w text,
            add column if not exists usb_ra text,
            add column if not exists loai_tin_hieu text,
            add column if not exists thong_minh text,
            add column if not exists giao_thuc text,
            add column if not exists he_sinh_thai text,
            add column if not exists day_trung_tinh text,
            add column if not exists loai_cam_bien text,
            add column if not exists tinh_nang_tm text,
            add column if not exists so_module text,
            add column if not exists rong_mm text,
            add column if not exists cao_mm text,
            add column if not exists sau_mm text,
            add column if not exists loai_de text,
            add column if not exists sau_hop_am_mm text,
            add column if not exists tiet_dien_day text;
          
          notify pgrst, 'reload schema';
`