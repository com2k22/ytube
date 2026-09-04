-- =====================================================================
-- Ytube (Mina & Cốm) — Phần 12: Hồ sơ bé linh hoạt + Quản lý thiết bị đăng nhập
-- =====================================================================
-- Cách dùng: chạy SAU 001..011. An toàn để chạy lại nhiều lần.
--
-- FILE NÀY LÀM GÌ:
--   1) Cho phép thêm/bớt hồ sơ bé ngay trong app (trước đây Mina & Cốm gắn cứng trong
--      code). Tận dụng lại cột "avatar" có sẵn từ đầu trong bảng profiles (trước giờ
--      chưa dùng tới) để lưu emoji đại diện cho từng bé.
--   2) Tạo bảng "family_devices" — danh sách các thiết bị/TV đã đăng nhập tài khoản
--      Google gia đình, để xem được & "đăng xuất từ xa" 1 thiết bị nếu cần (vd lỡ đăng
--      nhập nhầm trên TV nhà người khác, hoặc đổi TV không dùng cái cũ nữa).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Gắn sẵn emoji cho Mina & Cốm vào cột "avatar" có sẵn (chưa từng dùng tới).
-- ---------------------------------------------------------------------
update profiles set avatar = '🐵' where id = '11111111-1111-1111-1111-111111111111' and avatar is null;
update profiles set avatar = '🦄' where id = '22222222-2222-2222-2222-222222222222' and avatar is null;

-- ---------------------------------------------------------------------
-- 2) FAMILY_DEVICES — mỗi thiết bị đã từng đăng nhập là 1 dòng. Đọc/ghi/xoá đều bắt buộc
--    phải đăng nhập đúng tài khoản Google gia đình (giống các bảng cấu hình khác) — người
--    lạ không đăng nhập được nên không xem/đụng gì vào danh sách này.
-- ---------------------------------------------------------------------
create table if not exists family_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade default current_family_id(),
  device_id text not null,
  label text not null default 'Thiết bị',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (family_id, device_id)
);

alter table family_devices enable row level security;

drop policy if exists "family_devices_select" on family_devices;
drop policy if exists "family_devices_insert" on family_devices;
drop policy if exists "family_devices_update" on family_devices;
drop policy if exists "family_devices_delete" on family_devices;
create policy "family_devices_select" on family_devices for select using (family_id = current_family_id());
create policy "family_devices_insert" on family_devices for insert with check (family_id = current_family_id());
create policy "family_devices_update" on family_devices for update
  using (family_id = current_family_id()) with check (family_id = current_family_id());
create policy "family_devices_delete" on family_devices for delete using (family_id = current_family_id());

-- =====================================================================
-- KIỂM TRA LẠI SAU KHI CHẠY:
--   1) select id, name, avatar from profiles;   → Mina có avatar 🐵, Cốm có avatar 🦄
--   2) Vào khu Bố mẹ > tab "👶 Hồ sơ các bé" (mới) → thử thêm 1 bé test, đổi tên, xoá thử
--      → phải làm được (đang đăng nhập Google rồi).
--   3) Vào tab "👤 Tài khoản" → mục "Thiết bị đã đăng nhập" → phải thấy đúng thiết bị đang
--      dùng để chạy thử này trong danh sách.
-- =====================================================================
