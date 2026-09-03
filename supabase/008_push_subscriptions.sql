-- =====================================================================================
-- 008 — Thông báo đẩy lên điện thoại bố mẹ khi bé xin thêm giờ
-- =====================================================================================
-- Bảng này nhớ "địa chỉ nhận thư" của từng điện thoại đã bật thông báo. Mỗi máy (mỗi
-- trình duyệt) có một địa chỉ riêng, nên bật trên iPhone của bố và iPhone của mẹ thì bảng
-- có 2 dòng, và cả 2 máy đều nhận được.
--
-- CÁCH CHẠY: vào https://supabase.com > chọn ĐÚNG project của app Ytube
-- (project ref: gwedgpvvshqslhpglxaq) > menu trái chọn "SQL Editor" > "New query" >
-- dán TOÀN BỘ nội dung file này vào > bấm "Run".
--
-- File này CHỈ THÊM MỚI, không xoá và không sửa dữ liệu nào đang có.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- endpoint = địa chỉ nhận thư do chính Apple/Google cấp cho máy đó. Đặt unique để bật
  -- lại nhiều lần trên cùng 1 máy cũng chỉ có đúng 1 dòng, không bị gửi trùng.
  endpoint text not null unique,
  -- 2 khoá dùng để mã hoá nội dung thông báo, để trên đường đi không ai đọc trộm được.
  p256dh text not null,
  auth text not null,
  -- Tên gợi nhớ do người bật tự đặt, vd "iPhone của bố" — để sau này nhìn bảng còn biết
  -- dòng nào là máy nào mà xoá.
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bảo mật: cùng nguyên tắc với các bảng trước (app dùng trong nhà) — cho phép đọc/ghi
-- qua anon key.
alter table push_subscriptions enable row level security;
create policy "push_subscriptions_all" on push_subscriptions for all using (true) with check (true);

-- Kiểm tra lại: chạy xong câu này phải trả về bảng rỗng (0 dòng), không báo lỗi.
select * from push_subscriptions;
