-- One row per AI shopping-assistant request: used for the per-person hourly rate
-- limit and for monitoring AI spend. Written only by the ai-chat Edge Function with
-- the service role; RLS is on with no policies, so customers can't read or write it.
create table if not exists public.ai_chat_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,
  ip_hash       text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.ai_chat_usage enable row level security;

create index if not exists ai_chat_usage_user_time on public.ai_chat_usage (user_id, created_at);
create index if not exists ai_chat_usage_ip_time   on public.ai_chat_usage (ip_hash, created_at);
