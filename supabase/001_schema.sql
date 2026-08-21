-- =====================================================================
-- Ytube (Mina & Cốm) — Supabase Database Schema — Phần 1: cốt lõi
-- =====================================================================
-- Cách dùng: Supabase Dashboard > SQL Editor > New query > dán toàn bộ > Run.
-- Chạy file này trước, sau đó chạy tiếp 002_time_management.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) PROFILES — hồ sơ Mina & Cốm (ID cố định để code frontend tham chiếu trực tiếp)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text,
  theme_preference text not null default 'dark_tv'
    check (theme_preference in ('dark_tv', 'chibi_cute')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into profiles (id, name, theme_preference) values
  ('11111111-1111-1111-1111-111111111111', 'Mina', 'chibi_cute'),
  ('22222222-2222-2222-2222-222222222222', 'Cốm', 'dark_tv')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) ALLOWED_SOURCES — whitelist nội dung được phép xem
-- ---------------------------------------------------------------------
create table if not exists allowed_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null
    check (type in ('youtube_playlist', 'youtube_video', 'youtube_channel', 'direct_url')),
  title text not null,
  url text not null,
  thumbnail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_allowed_sources_profile_id on allowed_sources(profile_id);

-- ---------------------------------------------------------------------
-- 3) PARENT_SETTINGS — mã PIN của phụ huynh (chỉ lưu bản băm, không lưu PIN thô)
-- ---------------------------------------------------------------------
create table if not exists parent_settings (
  id int primary key default 1,
  pin_hash text not null,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into parent_settings (id, pin_hash)
values (1, crypt('1234', gen_salt('bf')))
on conflict (id) do nothing;

-- =====================================================================
-- BẢO MẬT (Row Level Security)
-- =====================================================================
alter table profiles enable row level security;
alter table allowed_sources enable row level security;
alter table parent_settings enable row level security;

-- Lưu ý: script này chỉ nên chạy 1 lần trên 1 project Supabase mới.
-- Nếu chạy lại lần 2, lệnh create policy bên dưới sẽ báo lỗi "already exists" —
-- điều đó vô hại, nghĩa là phần bảo mật đã được thiết lập từ trước rồi.
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (true);
create policy "profiles_update" on profiles for update using (true);
create policy "profiles_delete" on profiles for delete using (true);

create policy "sources_select" on allowed_sources for select using (true);
create policy "sources_insert" on allowed_sources for insert with check (true);
create policy "sources_update" on allowed_sources for update using (true);
create policy "sources_delete" on allowed_sources for delete using (true);

-- Không tạo policy nào cho parent_settings => mặc định chặn hết (kể cả SELECT) với anon key.
-- Chỉ 2 hàm bên dưới được phép chạm vào bảng này.

-- Lưu ý: trên Supabase, extension pgcrypto cài hàm crypt()/gen_salt() vào schema
-- "extensions" chứ không phải "public" — nên search_path phải có cả 2 schema này,
-- nếu không sẽ gặp lỗi "function crypt(text, text) does not exist".
create or replace function verify_parent_pin(input_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from parent_settings
    where id = 1 and pin_hash = crypt(input_pin, pin_hash)
  );
$$;

create or replace function set_parent_pin(old_pin text, new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_parent_pin(old_pin) then
    return false;
  end if;
  update parent_settings
    set pin_hash = crypt(new_pin, gen_salt('bf')), updated_at = now()
    where id = 1;
  return true;
end;
$$;

grant execute on function verify_parent_pin(text) to anon, authenticated;
grant execute on function set_parent_pin(text, text) to anon, authenticated;
