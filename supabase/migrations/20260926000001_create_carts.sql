-- Server-side shopping cart so a customer's cart follows their account across
-- devices and browsers (previously it lived only in each browser's localStorage).
-- One row per user; items holds the same cart item objects the storefront uses.
create table if not exists public.carts (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.carts enable row level security;

create policy "carts_select_own" on public.carts
  for select using (user_id = auth.uid());
create policy "carts_insert_own" on public.carts
  for insert with check (user_id = auth.uid());
create policy "carts_update_own" on public.carts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Push changes to the customer's other open devices.
alter publication supabase_realtime add table public.carts;
