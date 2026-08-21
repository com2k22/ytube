-- =====================================================================
-- Ytube (Mina & Cốm) — Phần 3: cho phép 1 nội dung dùng chung cho cả 2 bé
-- =====================================================================
-- Cách dùng: chạy SAU 001_schema.sql và 002_time_management.sql.
-- An toàn để chạy lại nhiều lần (script chỉ nới lỏng ràng buộc, không xoá dữ liệu).
-- =====================================================================

-- Trước đây mỗi nội dung (allowed_sources) bắt buộc phải gán cho đúng 1 bé
-- (profile_id NOT NULL). Giờ cho phép để trống (NULL) để đánh dấu "dùng chung cho
-- cả Mina & Cốm" — trang chủ của cả 2 hồ sơ sẽ cùng thấy nội dung này.
alter table allowed_sources alter column profile_id drop not null;

-- =====================================================================
-- XONG. Từ giờ khi thêm nội dung ở tab "Thêm nội dung", chọn cả 2 ô Mina và Cốm
-- sẽ lưu profile_id = NULL (dùng chung), chỉ chọn 1 bé thì lưu id của bé đó.
-- =====================================================================
