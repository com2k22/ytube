-- =====================================================================
-- Ytube (Mina & Cốm) — Phần 11: Đăng nhập Google thay cho mã PIN phụ huynh
-- =====================================================================
-- Cách dùng: chạy SAU 001..010. An toàn để chạy lại nhiều lần.
--
-- BƯỚC BẮT BUỘC TRƯỚC KHI CHẠY FILE NÀY: bật đăng nhập Google trong Supabase —
-- Dashboard > Authentication > Providers > Google > bật lên, dán Client ID + Client
-- Secret lấy từ Google Cloud Console. Ở phần "Authorized redirect URIs" bên Google Cloud
-- Console, thêm đúng địa chỉ callback mà trang Providers đó hiện sẵn (dạng
-- https://<project-ref>.supabase.co/auth/v1/callback).
--
-- FILE NÀY LÀM GÌ:
--   1) Tạo bảng "families" — mỗi gia đình là 1 dòng, gắn với 1 địa chỉ Gmail chủ nhà.
--      Hiện tại chỉ có ĐÚNG 1 gia đình (gắn với ngocphongdo@gmail.com) — bảng này là nền
--      tảng để sau này làm được tính năng nhiều gia đình cùng dùng chung app.
--   2) Gắn family_id vào các bảng CẤU HÌNH (whitelist, nhãn, giờ giấc, hồ sơ) — những bảng
--      chỉ được SỬA bởi phụ huynh trong khu Bố mẹ.
--   3) Đổi luật bảo mật (RLS): việc ĐỌC dữ liệu (bé xem whitelist, xem video...) vẫn mở như
--      cũ — bé KHÔNG cần đăng nhập gì cả, xem phim vẫn bình thường 100% như trước. Chỉ có
--      việc GHI (thêm/sửa/xoá whitelist, nhãn, giờ giấc) mới bắt buộc phải đăng nhập ĐÚNG
--      tài khoản Google của gia đình — đây chính là phần thay thế cho mã PIN cũ.
--   4) KHÔNG đụng tới parent_settings (bảng PIN cũ) — cứ để nguyên đó, không dùng nữa
--      nhưng không xoá, phòng khi cần quay lại.
--   5) KHÔNG đụng tới watch_sessions / watch_progress / time_requests / push_subscriptions —
--      những bảng này được chính TV ghi liên tục trong lúc bé xem/xin thêm giờ, không phải
--      hành động của phụ huynh, nên vẫn để mở như cũ.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) FAMILIES — mỗi gia đình 1 dòng, nhận diện bằng địa chỉ Gmail chủ nhà.
-- ---------------------------------------------------------------------
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null unique,
  name text not null default 'Gia đình',
  created_at timestamptz not null default now()
);

insert into families (owner_email, name)
values ('ngocphongdo@gmail.com', 'Gia đình Phong')
on conflict (owner_email) do nothing;

-- ---------------------------------------------------------------------
-- 2) current_family_id() — tra ra gia đình của người ĐANG đăng nhập (theo email trong
--    JWT do Supabase Auth cấp). Trả về NULL nếu chưa đăng nhập, hoặc đăng nhập bằng 1
--    Gmail không thuộc gia đình nào — dùng làm điều kiện trong các luật bảo mật bên dưới,
--    và làm giá trị mặc định khi thêm dòng mới (khỏi cần code frontend tự truyền family_id).
-- ---------------------------------------------------------------------
create or replace function current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from families where owner_email = auth.jwt()->>'email' limit 1;
$$;

grant execute on function current_family_id() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Gắn family_id vào các bảng CẤU HÌNH — điền sẵn cho dữ liệu đang có (gắn hết vào gia
--    đình duy nhất hiện tại), rồi mới bắt buộc NOT NULL.
-- ---------------------------------------------------------------------
alter table profiles add column if not exists family_id uuid references families(id);
alter table allowed_sources add column if not exists family_id uuid references families(id);
alter table content_labels add column if not exists family_id uuid references families(id);
alter table time_rule_groups add column if not exists family_id uuid references families(id);

update profiles set family_id = (select id from families where owner_email = 'ngocphongdo@gmail.com')
  where family_id is null;
update allowed_sources set family_id = (select id from families where owner_email = 'ngocphongdo@gmail.com')
  where family_id is null;
update content_labels set family_id = (select id from families where owner_email = 'ngocphongdo@gmail.com')
  where family_id is null;
update time_rule_groups set family_id = (select id from families where owner_email = 'ngocphongdo@gmail.com')
  where family_id is null;

alter table profiles alter column family_id set not null;
alter table allowed_sources alter column family_id set not null;
alter table content_labels alter column family_id set not null;
alter table time_rule_groups alter column family_id set not null;

alter table profiles alter column family_id set default current_family_id();
alter table allowed_sources alter column family_id set default current_family_id();
alter table content_labels alter column family_id set default current_family_id();
alter table time_rule_groups alter column family_id set default current_family_id();

-- =====================================================================
-- BẢO MẬT (Row Level Security)
-- =====================================================================
alter table families enable row level security;

-- Chỉ đọc được đúng gia đình của mình (không có policy insert/update/delete nào cho
-- families ở đây — việc tạo gia đình mới để dành cho tính năng "liên kết nhiều gia đình"
-- ở giai đoạn sau, làm thủ công qua SQL Editor như bước 1 ở trên là đủ cho lúc này).
create policy "families_select_own" on families for select
  using (owner_email = auth.jwt()->>'email');

-- profiles / allowed_sources / content_labels / time_rule_groups:
-- ĐỌC vẫn mở như cũ (using (true)) — bé xem app KHÔNG cần đăng nhập, y hệt trước giờ.
-- GHI (thêm/sửa/xoá) thì bắt buộc phải đăng nhập đúng gia đình — thay cho PIN cũ.
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "profiles_delete" on profiles;
create policy "profiles_insert" on profiles for insert with check (family_id = current_family_id());
create policy "profiles_update" on profiles for update
  using (family_id = current_family_id()) with check (family_id = current_family_id());
create policy "profiles_delete" on profiles for delete using (family_id = current_family_id());

drop policy if exists "sources_insert" on allowed_sources;
drop policy if exists "sources_update" on allowed_sources;
drop policy if exists "sources_delete" on allowed_sources;
create policy "sources_insert" on allowed_sources for insert with check (family_id = current_family_id());
create policy "sources_update" on allowed_sources for update
  using (family_id = current_family_id()) with check (family_id = current_family_id());
create policy "sources_delete" on allowed_sources for delete using (family_id = current_family_id());

drop policy if exists "content_labels_insert" on content_labels;
drop policy if exists "content_labels_update" on content_labels;
drop policy if exists "content_labels_delete" on content_labels;
create policy "content_labels_insert" on content_labels for insert with check (family_id = current_family_id());
create policy "content_labels_update" on content_labels for update
  using (family_id = current_family_id()) with check (family_id = current_family_id());
create policy "content_labels_delete" on content_labels for delete using (family_id = current_family_id());

-- time_rule_groups trước đây có policy "for all" gộp chung — tách riêng select/insert/
-- update/delete để chỉ ghi mới cần đăng nhập, đọc vẫn mở.
drop policy if exists "time_rule_groups_all" on time_rule_groups;
create policy "time_rule_groups_select" on time_rule_groups for select using (true);
create policy "time_rule_groups_insert" on time_rule_groups for insert with check (family_id = current_family_id());
create policy "time_rule_groups_update" on time_rule_groups for update
  using (family_id = current_family_id()) with check (family_id = current_family_id());
create policy "time_rule_groups_delete" on time_rule_groups for delete using (family_id = current_family_id());

-- =====================================================================
-- KIỂM TRA LẠI SAU KHI CHẠY:
--   1) select * from families;                     → phải thấy đúng 1 dòng ngocphongdo@gmail.com
--   2) select name, family_id from profiles;        → cả Mina/Cốm đều có family_id (không NULL)
--   3) Mở app KHI CHƯA đăng nhập Google gì cả (vd trên TV hiện tại) → Trang chủ, xem video,
--      xin thêm giờ... vẫn phải chạy bình thường y hệt trước (đây là phần ĐỌC, không đổi).
--   4) Thử thêm 1 nội dung mới trong khu Bố mẹ khi CHƯA đăng nhập Google → phải bị TỪ CHỐI
--      (lỗi từ Supabase) — đúng ý, vì phần GHI giờ cần đăng nhập. Sau khi làm xong bước
--      đăng nhập Google ở phía frontend (Claude sẽ làm tiếp), thử lại thì phải ghi được.
-- =====================================================================
