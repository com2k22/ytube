-- =====================================================================================
-- 006 — Gộp "Quản lý thời gian" dùng CHUNG cho cả 2 bé
-- =====================================================================================
-- Trước đây mỗi bé có bộ khung giờ riêng (cột profile_id trỏ tới từng bé). Nay chuyển
-- sang MỘT bộ dùng chung: quy ước profile_id = NULL nghĩa là "áp dụng cho cả nhà".
--
-- CÁCH CHẠY: vào https://supabase.com > chọn ĐÚNG project của app Ytube > menu trái chọn
-- "SQL Editor" > bấm "New query" > dán TOÀN BỘ nội dung file này vào > bấm "Run".
--
-- ⚠️ File này CÓ XOÁ dữ liệu: cấu hình giờ xem riêng của bé thứ hai (Cốm) sẽ bị xoá, vì
-- từ nay chỉ còn 1 bộ chung. Bộ được GIỮ LẠI làm bộ chung là cấu hình của Mina. Chạy xong
-- bạn vào lại tab "⏰ Quản lý thời gian" trong app để chỉnh lại cho vừa ý — giờ chỉ còn 1
-- bộ duy nhất, không phải chọn bé nào nữa.

-- 1) Cho phép cột profile_id để trống (NULL = dùng chung cho cả nhà).
alter table time_rule_groups alter column profile_id drop not null;

-- 2) Lấy cấu hình của Mina làm cấu hình CHUNG.
update time_rule_groups
set profile_id = null,
    updated_at = now()
where profile_id = '11111111-1111-1111-1111-111111111111';

-- 3) Xoá các cấu hình riêng còn lại (của Cốm) — từ nay không dùng nữa.
delete from time_rule_groups where profile_id is not null;

-- 4) Phòng trường hợp bảng đang trống: tạo sẵn 1 nhóm ngày mặc định để app có cái để hiện.
insert into time_rule_groups (profile_id, days, daily_minutes, session_minutes, windows)
select null, '["T2","T3","T4","T5","T6"]'::jsonb, 45, 15,
       '[{"start":"17:00","end":"18:00"}]'::jsonb
where not exists (select 1 from time_rule_groups where profile_id is null);

-- 5) Kiểm tra lại (chạy xong phải thấy các dòng đều có profile_id để trống):
select id, profile_id, days, daily_minutes, session_minutes, windows from time_rule_groups;
