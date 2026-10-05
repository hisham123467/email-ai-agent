-- Email AI Agent schema (prepared for a dedicated Supabase project)
-- Designed for Supabase's 2026 explicit Data API grant behavior.

create extension if not exists pgcrypto;

create table if not exists public.agent_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auto_reply boolean not null default false,
  approval_required boolean not null default true,
  default_tone text not null default 'professional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  refresh_token_encrypted text not null,
  access_token_encrypted text,
  access_token_expires_at timestamptz,
  history_id text,
  watch_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, email)
);

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_thread_id text not null,
  subject text,
  last_message_at timestamptz,
  status text not null default 'inbox' check (status in ('inbox','needs_reply','waiting','done','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, gmail_thread_id)
);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.email_threads(id) on delete cascade,
  gmail_message_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  sender text,
  recipients jsonb not null default '[]'::jsonb,
  subject text,
  snippet text,
  body_text text,
  received_at timestamptz,
  labels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, gmail_message_id)
);

create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.email_threads(id) on delete cascade,
  source_message_id uuid references public.emails(id) on delete set null,
  to_address text not null,
  subject text,
  body text not null,
  ai_instruction text,
  status text not null default 'draft' check (status in ('draft','approved','sent','discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  instruction text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null check (actor in ('dashboard','chatgpt','system')),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_settings enable row level security;
alter table public.gmail_accounts enable row level security;
alter table public.email_threads enable row level security;
alter table public.emails enable row level security;
alter table public.email_drafts enable row level security;
alter table public.ai_rules enable row level security;
alter table public.activity_logs enable row level security;

grant select, insert, update, delete on public.agent_settings to authenticated;
grant select, insert, update, delete on public.email_threads to authenticated;
grant select, insert, update, delete on public.emails to authenticated;
grant select, insert, update, delete on public.email_drafts to authenticated;
grant select, insert, update, delete on public.ai_rules to authenticated;
grant select on public.activity_logs to authenticated;
grant usage, select on sequence public.activity_logs_id_seq to authenticated;

revoke all on public.gmail_accounts from anon, authenticated;

create policy "settings owner read" on public.agent_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings owner insert" on public.agent_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings owner update" on public.agent_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "threads owner read" on public.email_threads for select to authenticated using ((select auth.uid()) = user_id);
create policy "threads owner insert" on public.email_threads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "threads owner update" on public.email_threads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "threads owner delete" on public.email_threads for delete to authenticated using ((select auth.uid()) = user_id);

create policy "emails owner read" on public.emails for select to authenticated using ((select auth.uid()) = user_id);
create policy "emails owner insert" on public.emails for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "emails owner update" on public.emails for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "emails owner delete" on public.emails for delete to authenticated using ((select auth.uid()) = user_id);

create policy "drafts owner read" on public.email_drafts for select to authenticated using ((select auth.uid()) = user_id);
create policy "drafts owner insert" on public.email_drafts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "drafts owner update" on public.email_drafts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "drafts owner delete" on public.email_drafts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "rules owner read" on public.ai_rules for select to authenticated using ((select auth.uid()) = user_id);
create policy "rules owner insert" on public.ai_rules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "rules owner update" on public.ai_rules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rules owner delete" on public.ai_rules for delete to authenticated using ((select auth.uid()) = user_id);

create policy "logs owner read" on public.activity_logs for select to authenticated using ((select auth.uid()) = user_id);

create index if not exists email_threads_user_last_message_idx on public.email_threads(user_id, last_message_at desc);
create index if not exists emails_user_received_idx on public.emails(user_id, received_at desc);
create index if not exists drafts_user_status_idx on public.email_drafts(user_id, status, updated_at desc);
create index if not exists logs_user_created_idx on public.activity_logs(user_id, created_at desc);
