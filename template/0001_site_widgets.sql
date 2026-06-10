-- =====================================================================
-- site-widgets :: feedback + onboarding schema
-- Replace ${SCHEMA} with your target schema (e.g. public, uerc, lotfinder).
-- Assumes a ${SCHEMA}.profiles table with an is_admin boolean column. If your
-- admin model differs, edit is_admin() and the feedback SELECT/UPDATE policies.
-- =====================================================================

-- 1. Admin helper (skip this block if you already have ${SCHEMA}.is_admin()) --
create or replace function ${SCHEMA}.is_admin() returns boolean
  language sql security definer stable set search_path = ${SCHEMA}, public as $$
  select exists (
    select 1 from ${SCHEMA}.profiles p where p.id = auth.uid() and p.is_admin
  );
$$;
revoke execute on function ${SCHEMA}.is_admin() from anon, public;
grant execute on function ${SCHEMA}.is_admin() to authenticated;

-- 2. Feedback table ----------------------------------------------------------
create table ${SCHEMA}.site_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  kind text not null default 'bug',          -- matches your config categories
  severity text not null default 'normal',   -- matches your config severities
  message text not null,
  page_url text,
  user_agent text,
  screenshot text,                           -- downscaled JPEG data URL (nullable)
  context jsonb,                             -- viewport/screen/role/appVersion/consoleErrors
  status text not null default 'new',        -- new | triaged | done
  created_at timestamptz not null default now()
);
create index site_feedback_status_idx on ${SCHEMA}.site_feedback(status, created_at);

alter table ${SCHEMA}.site_feedback enable row level security;
-- Anyone signed in may submit; only admins read / triage.
create policy feedback_insert_auth on ${SCHEMA}.site_feedback
  for insert to authenticated with check (true);
create policy feedback_select_admin on ${SCHEMA}.site_feedback
  for select to authenticated using (${SCHEMA}.is_admin());
create policy feedback_update_admin on ${SCHEMA}.site_feedback
  for update to authenticated using (${SCHEMA}.is_admin()) with check (${SCHEMA}.is_admin());
grant insert on ${SCHEMA}.site_feedback to authenticated;
grant select, update on ${SCHEMA}.site_feedback to authenticated;

-- 3. Onboarding progress (manual checks) ------------------------------------
create table ${SCHEMA}.onboarding_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, task_key)
);
alter table ${SCHEMA}.onboarding_progress enable row level security;
create policy onb_own on ${SCHEMA}.onboarding_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on ${SCHEMA}.onboarding_progress to authenticated;

-- 4. gave_feedback auto-detect. Feedback rows are admin-only readable, so a
--    security-definer fn lets a user learn whether THEY have submitted. -------
create or replace function ${SCHEMA}.user_gave_feedback() returns boolean
  language sql security definer stable set search_path = ${SCHEMA}, public as $$
  select exists (
    select 1 from ${SCHEMA}.site_feedback f where f.user_id = auth.uid()
  );
$$;
revoke execute on function ${SCHEMA}.user_gave_feedback() from anon, public;
grant execute on function ${SCHEMA}.user_gave_feedback() to authenticated;
