-- =====================================================================
-- Ytube (Mina & Cốm) — Phần 4: Playlist tự tạo từ video đơn lẻ, ngay trong app
-- =====================================================================
-- Cách dùng: chạy SAU 001, 002, 003. An toàn để chạy lại nhiều lần.
-- =====================================================================

-- Cột lưu danh sách video của 1 "playlist tự tạo" — chỉ dùng khi
-- allowed_sources.type = 'custom_playlist'. Mỗi phần tử: {videoId, title, thumbnail}.
alter table allowed_sources add column if not exists items jsonb not null default '[]'::jsonb;

-- Cho phép type = 'custom_playlist' (playlist do phụ huynh tự ghép từ nhiều video
-- đơn lẻ, khác với 'youtube_playlist' là playlist thật lấy từ YouTube).
alter table allowed_sources drop constraint if exists allowed_sources_type_check;
alter table allowed_sources add constraint allowed_sources_type_check
  check (type in ('youtube_playlist', 'youtube_video', 'youtube_channel', 'direct_url', 'custom_playlist'));

-- =====================================================================
-- XONG. Nếu bước "drop constraint" báo không tìm thấy constraint tên
-- allowed_sources_type_check (project cũ đặt tên khác lúc tạo bảng), báo lại cho
-- Claude để chỉnh câu lệnh cho đúng tên constraint thật trên project của bạn.
-- =====================================================================
