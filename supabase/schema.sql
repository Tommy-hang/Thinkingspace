-- ============================================================
-- ThinkingSpace 云端数据库结构（V0.4）
--
-- 使用方法：
--   1. 打开 Supabase 项目 → 左侧 SQL Editor → New query
--   2. 把本文件全部内容粘贴进去
--   3. 点 Run
--
-- 安全说明：
--   下面两张表都开启了 Row Level Security（RLS）。
--   这是数据隔离的唯一边界——没有它，任何人拿到公开的 anon key
--   就能读写所有用户的数据。请勿关闭。
-- ============================================================

-- ---------- 1. 项目表：一个项目一行 ----------
create table if not exists public.projects (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '',
  summary     text not null default '',
  -- 项目的全部内容：nodes / edges / messages / openQuestions / knowledgeMap
  content     jsonb not null default '{}'::jsonb,
  -- 版本号：用于发现「别的设备也改过同一个项目」
  revision    bigint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_user_idx
  on public.projects (user_id, updated_at desc);

-- ---------- 2. 用户设置表：一个用户一行 ----------
-- 只存主题、Provider 配置、上下文参数等；绝不存 API Key
create table if not exists public.user_settings (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------- 3. updated_at 自动维护 ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.user_settings;
create trigger settings_touch
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------- 4. 表级授权 ----------
-- RLS 决定「能看哪些行」，GRANT 决定「能不能碰这张表」，两者缺一不可。
-- 只授权给 authenticated（已登录用户）：匿名请求连表都碰不到，多一层保护。
grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.projects      to authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;

-- ---------- 5. 开启行级安全（生死线） ----------
alter table public.projects      enable row level security;
alter table public.user_settings enable row level security;

-- ---------- 6. 权限策略：每个人只能碰自己的行 ----------
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "settings_insert_own" on public.user_settings;
create policy "settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "settings_delete_own" on public.user_settings;
create policy "settings_delete_own" on public.user_settings
  for delete using (auth.uid() = user_id);
