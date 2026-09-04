-- =====================================================================
-- Ytube (Mina & Cốm) — Phần 10: Gán nhãn cho video/playlist đã thêm
-- =====================================================================
-- Cách dùng: chạy SAU 001..009. An toàn để chạy lại nhiều lần.
--
-- Tính năng: mỗi dòng trong whitelist (playlist/kênh/video lẻ/link trực tiếp/playlist tự
-- tạo) có thể được gán 1 hoặc nhiều "nhãn" (VD: Học tập, Giải trí...). 2 nhãn có sẵn giữ
-- HÀNH VI ĐẶC BIỆT cố định (không xoá được, không đổi is_priority/is_hidden được — chỉ đổi
-- tên nếu muốn):
--   - "Ưu tiên" (is_priority = true): nội dung gán nhãn này hiện lên ĐẦU TIÊN trong mỗi
--     mục ở Trang chủ (Tiếp tục xem / Danh sách / Video đề xuất).
--   - "Ẩn" (is_hidden = true): nội dung gán nhãn này KHÔNG hiện ở Trang chủ nữa (nhưng vẫn
--     xem được nếu bé tự vào đúng trang Kênh chứa nó — không phải xoá hẳn).
-- Các nhãn khác (Học tập, Giải trí, Khác, hoặc do phụ huynh tự đặt tên) chỉ là nhãn mô tả
-- thường, không có hành vi đặc biệt gì.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CONTENT_LABELS — danh sách nhãn (dùng chung cho cả nhà, không tách riêng theo bé)
-- ---------------------------------------------------------------------
create table if not exists content_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- true = nhãn "Ưu tiên" (đẩy lên đầu mỗi mục ở Trang chủ). Chỉ đúng 1 nhãn có cờ này.
  is_priority boolean not null default false,
  -- true = nhãn "Ẩn" (ẩn khỏi Trang chủ). Chỉ đúng 1 nhãn có cờ này.
  is_hidden boolean not null default false,
  -- true = nhãn có sẵn của hệ thống (Ưu tiên/Ẩn) — không cho xoá, chỉ đổi được tên.
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Nhãn có sẵn — chỉ chèn nếu bảng đang trống (tránh tạo trùng nếu chạy lại file này).
insert into content_labels (name, is_priority, is_hidden, is_builtin)
select * from (values
  ('Ưu tiên', true, false, true),
  ('Ẩn', false, true, true),
  ('Học tập', false, false, false),
  ('Giải trí', false, false, false),
  ('Khác', false, false, false)
) as seed(name, is_priority, is_hidden, is_builtin)
where not exists (select 1 from content_labels);

-- ---------------------------------------------------------------------
-- 2) ALLOWED_SOURCES — thêm cột lưu danh sách id nhãn đã gán cho từng dòng whitelist
-- ---------------------------------------------------------------------
alter table allowed_sources add column if not exists label_ids uuid[] not null default '{}';

-- Tra nhanh "dòng nào có gán nhãn X" (dùng khi Trang chủ lọc/sắp theo nhãn Ưu tiên/Ẩn).
create index if not exists idx_allowed_sources_label_ids on allowed_sources using gin (label_ids);

-- ---------------------------------------------------------------------
-- 3) Xoá 1 nhãn thì TỰ ĐỘNG gỡ nhãn đó khỏi mọi dòng whitelist đang gán nó — không làm thì
--    label_ids sẽ còn sót lại id "ma" (nhãn đã xoá nhưng vẫn nằm trong mảng), về sau lỡ tạo
--    lại 1 nhãn mới trùng đúng id đó (hiếm nhưng không phải không thể) sẽ bị gán oan.
-- ---------------------------------------------------------------------
create or replace function strip_deleted_label() returns trigger as $$
begin
  update allowed_sources
  set label_ids = array_remove(label_ids, old.id)
  where old.id = any(label_ids);
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_strip_deleted_label on content_labels;
create trigger trg_strip_deleted_label
  before delete on content_labels
  for each row execute function strip_deleted_label();

-- =====================================================================
-- BẢO MẬT (Row Level Security) — mở hết như các bảng khác trong app (xem 001_schema.sql).
-- =====================================================================
alter table content_labels enable row level security;

create policy "content_labels_select" on content_labels for select using (true);
create policy "content_labels_insert" on content_labels for insert with check (true);
create policy "content_labels_update" on content_labels for update using (true);
create policy "content_labels_delete" on content_labels for delete using (true);

-- =====================================================================
-- XONG. Nếu bước "create policy" báo lỗi "already exists" khi chạy lại lần 2, đó là chuyện
-- bình thường (bảo mật đã thiết lập từ trước) — bỏ qua dòng báo lỗi đó là được.
-- =====================================================================
