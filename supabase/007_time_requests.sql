-- =====================================================================================
-- 007 — "Con xin thêm giờ": bé bấm xin, bố mẹ duyệt từ điện thoại
-- =====================================================================================
-- Trước đây hết giờ thì phải có người cầm điều khiển ra tận TV nhập mã PIN. Bảng này cho
-- phép bé bấm 1 nút để GỬI LỜI XIN, bố mẹ đang ở phòng khác mở khu Bố mẹ trên điện thoại
-- là thấy ngay và bấm duyệt — TV tự mở khoá, không cần ai chạy đi đâu cả.
--
-- CÁCH CHẠY: vào https://supabase.com > chọn ĐÚNG project của app Ytube
-- (project ref: gwedgpvvshqslhpglxaq) > menu trái chọn "SQL Editor" > bấm "New query" >
-- dán TOÀN BỘ nội dung file này vào > bấm "Run".
--
-- File này CHỈ THÊM MỚI, không xoá và không sửa dữ liệu nào đang có.

create table if not exists time_requests (
  id uuid primary key default gen_random_uuid(),
  -- Bé nào đang xin (để bố mẹ biết là Mina hay Cốm).
  profile_id uuid not null references profiles(id) on delete cascade,
  -- pending  = đang chờ bố mẹ
  -- approved = đã duyệt, TV tự mở khoá thêm granted_minutes phút
  -- denied   = bố mẹ từ chối
  -- cancelled= bé tự rút lại / hết hạn không ai trả lời
  status text not null default 'pending',
  -- Số phút bé xin (mặc định 15) và số phút bố mẹ THỰC SỰ cho (có thể khác).
  requested_minutes int not null default 15,
  granted_minutes int,
  -- Vì sao bị chặn lúc xin: 'daily_limit' (hết giờ hôm nay) hay 'outside_window' (chưa tới giờ).
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_time_requests_status on time_requests(status, created_at desc);
create index if not exists idx_time_requests_profile on time_requests(profile_id, created_at desc);

-- Bảo mật: cùng nguyên tắc với các bảng trước (app dùng trong nhà, không có nhiều tài
-- khoản thật) — cho phép đọc/ghi qua anon key.
alter table time_requests enable row level security;
create policy "time_requests_all" on time_requests for all using (true) with check (true);

-- Bật Realtime: đây là phần QUAN TRỌNG NHẤT của tính năng này.
-- Nhờ nó, bé bấm xin ở TV thì điện thoại bố mẹ hiện lên NGAY (không phải bấm tải lại),
-- và bố mẹ bấm duyệt thì TV cũng mở khoá NGAY.
alter publication supabase_realtime add table time_requests;

-- Kiểm tra lại: chạy xong câu này phải trả về bảng rỗng (0 dòng), không báo lỗi.
select * from time_requests;
