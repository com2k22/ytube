-- =====================================================================
-- Ytube (Mina & Cốm) — Supabase Database Schema — Phần 2: quản lý thời gian xem
-- =====================================================================
-- Chạy SAU 001_schema.sql. Supabase Dashboard > SQL Editor > New query > Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TIME_RULE_GROUPS — "nhóm ngày": mỗi nhóm tự chọn các ngày trong tuần,
--    với khung giờ / tổng thời gian mỗi ngày / thời gian mỗi lượt xem riêng.
-- ---------------------------------------------------------------------
create table if not exists time_rule_groups (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  days jsonb not null default '[]'::jsonb,        -- vd: ["T2","T3"]
  daily_minutes int not null default 60,
  session_minutes int not null default 20,
  windows jsonb not null default '[]'::jsonb,     -- vd: [{"start":"09:00","end":"10:00"}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_rule_groups_profile_id on time_rule_groups(profile_id);

-- Cấu hình mẫu ban đầu — bạn chỉnh lại thoải mái ở trang "Bố mẹ" trong app.
insert into time_rule_groups (profile_id, days, daily_minutes, session_minutes, windows)
select '11111111-1111-1111-1111-111111111111', '["T2","T3","T4","T5","T6"]'::jsonb, 45, 15,
       '[{"start":"17:00","end":"18:00"}]'::jsonb
where not exists (select 1 from time_rule_groups where profile_id = '11111111-1111-1111-1111-111111111111');

insert into time_rule_groups (profile_id, days, daily_minutes, session_minutes, windows)
select '22222222-2222-2222-2222-222222222222', '["T2","T3","T4","T5","T6"]'::jsonb, 45, 20,
       '[{"start":"16:00","end":"17:30"}]'::jsonb
where not exists (select 1 from time_rule_groups where profile_id = '22222222-2222-2222-2222-222222222222');

-- ---------------------------------------------------------------------
-- 2) WATCH_SESSIONS — phiên xem hiện tại của từng hồ sơ, đồng bộ thời gian thực
--    (Supabase Realtime) để phụ huynh có thể "kết thúc phiên xem ngay" hoặc
--    "xem xong phiên rồi tắt" từ thiết bị khác (vd: iPad) trong khi TV đang phát.
-- ---------------------------------------------------------------------
create table if not exists watch_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  video_title text,
  source_id uuid references allowed_sources(id) on delete set null,
  is_active boolean not null default true,
  end_after_current boolean not null default false,
  elapsed_seconds int not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_watch_sessions_profile_id on watch_sessions(profile_id);

-- ---------------------------------------------------------------------
-- 3) WATCH_PROGRESS — % đã xem của từng video, dùng cho "Tiếp tục xem"
-- ---------------------------------------------------------------------
create table if not exists watch_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  source_id uuid not null references allowed_sources(id) on delete cascade,
  video_ref text not null,          -- videoId của YouTube, hoặc chính URL với direct_url
  progress_percent int not null default 0,
  updated_at timestamptz not null default now(),
  unique (profile_id, source_id, video_ref)
);

create index if not exists idx_watch_progress_profile_source on watch_progress(profile_id, source_id);

-- =====================================================================
-- BẢO MẬT (Row Level Security) — cùng nguyên tắc với 001: app gia đình,
-- không có nhiều người dùng thật nên cho phép đọc/ghi qua anon key.
-- =====================================================================
alter table time_rule_groups enable row level security;
alter table watch_sessions enable row level security;
alter table watch_progress enable row level security;

create policy "time_rule_groups_all" on time_rule_groups for all using (true) with check (true);
create policy "watch_sessions_all" on watch_sessions for all using (true) with check (true);
create policy "watch_progress_all" on watch_progress for all using (true) with check (true);

-- Bật Realtime cho watch_sessions để trang "Bố mẹ" thấy ngay khi TV đổi trạng thái,
-- và TV thấy ngay khi phụ huynh bấm "kết thúc phiên" từ xa.
alter publication supabase_realtime add table watch_sessions;

-- =====================================================================
-- XONG. Sau khi chạy cả 2 file, app đã có đầy đủ bảng cho toàn bộ tính năng đã demo.
-- =====================================================================
