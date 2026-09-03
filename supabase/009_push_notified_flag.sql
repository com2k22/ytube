-- =====================================================================================
-- 009 — Chống gửi trùng thông báo đẩy
-- =====================================================================================
-- Thêm 1 cột đánh dấu "lời xin này đã bắn thông báo rồi". Nhờ nó, dù ai đó gọi lại
-- /api/send-push nhiều lần với cùng một lời xin thì điện thoại cũng chỉ rung ĐÚNG MỘT LẦN.
--
-- CÁCH CHẠY: vào https://supabase.com > chọn ĐÚNG project của app Ytube
-- (project ref: gwedgpvvshqslhpglxaq) > menu trái chọn "SQL Editor" > "New query" >
-- dán TOÀN BỘ nội dung file này vào > bấm "Run".
--
-- File này CHỈ THÊM MỘT CỘT, không xoá và không sửa dữ liệu nào đang có.

alter table time_requests add column if not exists notified_at timestamptz;

-- Kiểm tra lại: chạy xong phải thấy cột notified_at xuất hiện (giá trị đang để trống).
select id, status, created_at, notified_at from time_requests order by created_at desc limit 5;
