-- =====================================================================================
-- 005 — Đặt giao diện mặc định là "Dark TV" cho cả 2 hồ sơ
-- =====================================================================================
-- Vì sao cần file này: giao diện của mỗi bé được LƯU RIÊNG trong bảng profiles (cột
-- theme_preference), nên app luôn hiển thị đúng theo giá trị đã lưu trong đó — sửa code
-- không đổi được. Lúc tạo dữ liệu ban đầu (file 001_schema.sql), hồ sơ Mina được đặt sẵn
-- 'chibi_cute', nên TV mở lên là ra giao diện hồng.
--
-- Chạy file này 1 lần để chuyển cả 2 hồ sơ về giao diện tối (Dark TV).
--
-- CÁCH CHẠY: vào https://supabase.com > chọn project của bạn > menu trái chọn
-- "SQL Editor" > bấm "New query" > dán TOÀN BỘ nội dung file này vào > bấm "Run".
--
-- (Cách khác, không cần vào Supabase: trên TV bấm nút 🎨 Giao diện ở cuối menu trái —
-- app sẽ đổi giao diện VÀ tự lưu lại cho hồ sơ đang chọn. Nhớ làm cho cả Mina lẫn Cốm.)

update profiles
set theme_preference = 'dark_tv',
    updated_at = now()
where theme_preference <> 'dark_tv';

-- Từ nay hồ sơ mới tạo (nếu có) cũng mặc định là giao diện tối — cột này vốn đã khai báo
-- default 'dark_tv' ở file 001_schema.sql, dòng dưới chỉ để chắc chắn không bị đổi.
alter table profiles
  alter column theme_preference set default 'dark_tv';

-- Kiểm tra lại kết quả (chạy xong sẽ thấy cả 2 dòng đều là dark_tv):
select name, theme_preference from profiles order by name;
