-- M8.3: "Hiện trạng" của dự án, cùng nhóm với Quy mô (project_scale) / Nhu cầu (requirements); in ở đầu tờ bìa báo giá.
-- Code: du_an.hien_trang (db-map.json), client hienTrang. Chỉ ghi khi client gửi khoá; dự án cũ giữ NULL.
-- Kiểm tra trước: cột chưa có (add column báo lỗi nếu đã có -> cả file quay lui).
-- Quay lui: alter table projects drop column current_condition;

alter table projects
  add column current_condition text;

comment on column projects.current_condition is 'Current condition of the site / building shown on the quotation cover (free text); NULL = not entered';

-- Xác minh sau
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'projects' and column_name = 'current_condition') then
    raise exception '0011: thiếu cột projects.current_condition';
  end if;
end $$;
