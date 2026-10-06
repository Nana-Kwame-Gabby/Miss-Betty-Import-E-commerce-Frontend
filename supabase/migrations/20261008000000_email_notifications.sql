-- Automated email notifications.
--
-- Every email goes through the email_messages outbox:
--  * Triggers queue an email in the same transaction as the real event (order created,
--    shipping fee paid, request sourced). A unique dedupe_key makes queueing idempotent,
--    so repeated callbacks/webhooks or status toggles never send twice.
--  * Sending happens afterwards in the send-emails Edge Function (kicked via pg_net, with a
--    pg_cron sweep for retries), so a mail failure can never undo an order or payment.
--  * Every attempt is logged (status, error, provider id) for the admin Emails page.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ── Outbox / log ─────────────────────────────────────────────────────────────────
create table if not exists public.email_campaigns (
  id              bigint generated always as identity primary key,
  kind            text        not null check (kind in ('period_closed', 'period_opened')),
  order_period_id bigint      references public.order_periods(id) on delete set null,
  subject         text        not null,
  message         text        not null,
  recipient_count integer     not null default 0,
  created_by      uuid,
  created_at      timestamptz not null default now()
);

create table if not exists public.email_messages (
  id                  bigint generated always as identity primary key,
  kind                text        not null check (kind in ('order_confirmation', 'shipping_payment', 'request_sourced', 'period_closed', 'period_opened')),
  dedupe_key          text        not null unique,
  customer_id         integer,
  recipient           text        not null,
  recipient_name      text,
  subject             text,
  data                jsonb       not null default '{}'::jsonb,
  campaign_id         bigint      references public.email_campaigns(id) on delete set null,
  is_test             boolean     not null default false,
  status              text        not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts            integer     not null default 0,
  last_error          text,
  provider_message_id text,
  next_attempt_at     timestamptz default now(),
  claimed_at          timestamptz,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

create index if not exists email_messages_due_idx      on public.email_messages (next_attempt_at) where status in ('pending', 'failed', 'sending');
create index if not exists email_messages_created_idx  on public.email_messages (created_at desc);
create index if not exists email_messages_campaign_idx on public.email_messages (campaign_id);

alter table public.email_messages  enable row level security;
alter table public.email_campaigns enable row level security;
revoke all on public.email_messages, public.email_campaigns from anon, authenticated;
grant select on public.email_messages, public.email_campaigns to authenticated;

drop policy if exists admin_read_email_messages on public.email_messages;
create policy admin_read_email_messages on public.email_messages for select to authenticated using (is_admin());
drop policy if exists admin_read_email_campaigns on public.email_campaigns;
create policy admin_read_email_campaigns on public.email_campaigns for select to authenticated using (is_admin());

-- ── Worker secret (Vault) and the "kick" that wakes the sender ─────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_worker_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'email_worker_secret');
  end if;
end $$;

-- Lets the Edge Function check the secret it was called with, without storing it anywhere else.
create or replace function public.verify_email_worker_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'email_worker_secret' and decrypted_secret = p_secret);
$$;
revoke all on function public.verify_email_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_email_worker_secret(text) to service_role;

-- Asynchronous HTTP call to the sender (pg_net sends it after the transaction commits).
-- Never raises: a problem here must not affect the order/payment that queued the email.
create or replace function public.email_kick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_worker_secret';
  perform net.http_post(
    url     := 'https://bwmlgqclgxuplfjoneyt.supabase.co/functions/v1/send-emails',
    body    := '{"action":"process"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    timeout_milliseconds := 60000
  );
exception when others then
  raise warning 'email_kick failed: %', sqlerrm;
end;
$$;
revoke all on function public.email_kick() from public, anon, authenticated;

-- Cron sweep: only wakes the sender when something is actually due.
create or replace function public.email_kick_if_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from email_messages
     where (status in ('pending', 'failed') and attempts < 5 and next_attempt_at <= now())
        or (status = 'sending' and claimed_at < now() - interval '10 minutes')
  ) then
    perform email_kick();
  end if;
end;
$$;
revoke all on function public.email_kick_if_due() from public, anon, authenticated;

create or replace function public.email_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform email_kick();
  return null;
end;
$$;

drop trigger if exists email_messages_kick on public.email_messages;
create trigger email_messages_kick
  after insert on public.email_messages
  for each statement execute function public.email_messages_after_insert();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'email-retry-sweep') then
    perform cron.unschedule('email-retry-sweep');
  end if;
  perform cron.schedule('email-retry-sweep', '*/5 * * * *', 'select public.email_kick_if_due()');
end $$;

-- ── Queueing ────────────────────────────────────────────────────────────────────
-- Queue one email for a customer's registered address. Idempotent on p_key.
create or replace function public.enqueue_customer_email(p_kind text, p_key text, p_customer_id integer, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name  text;
begin
  select nullif(trim(email), ''), customer_name into v_email, v_name from customers where customer_id = p_customer_id;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    -- Logged (not sent) so the admin can see why this customer got no email.
    insert into email_messages (kind, dedupe_key, customer_id, recipient, recipient_name, data, status, attempts, last_error, next_attempt_at)
    values (p_kind, p_key, p_customer_id, coalesce(v_email, '(none)'), v_name, p_data, 'failed', 5, 'Customer has no valid email address', null)
    on conflict (dedupe_key) do nothing;
    return;
  end if;
  insert into email_messages (kind, dedupe_key, customer_id, recipient, recipient_name, data)
  values (p_kind, p_key, p_customer_id, lower(v_email), v_name, p_data)
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke all on function public.enqueue_customer_email(text, text, integer, jsonb) from public, anon, authenticated;

-- 1. Order confirmation: once per order, however many lines or retries.
create or replace function public.queue_order_confirmation_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_id is not null and new.customer_id is not null then
    perform enqueue_customer_email('order_confirmation', 'order:' || new.order_id, new.customer_id,
                                   jsonb_build_object('order_id', new.order_id));
  end if;
  return null;
end;
$$;

drop trigger if exists queue_order_confirmation_email on public.orders;
create trigger queue_order_confirmation_email
  after insert on public.orders
  for each row execute function public.queue_order_confirmation_email();

-- 2. Shipping fee payment: only when Hubtel-verified finalize marks the request paid.
create or replace function public.queue_shipping_payment_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform enqueue_customer_email('shipping_payment', 'shipping:' || new.shp_ref, new.customer_id,
                                   jsonb_build_object('shp_ref', new.shp_ref));
  end if;
  return null;
end;
$$;

drop trigger if exists queue_shipping_payment_email on public.shipping_payment_requests;
create trigger queue_shipping_payment_email
  after update of status on public.shipping_payment_requests
  for each row execute function public.queue_shipping_payment_email();

-- 3. Product request sourced: only on the change to 'Sourced', once per request ever.
alter table public.product_requests
  add column if not exists sourced_product_id integer references public.products(product_id) on delete set null;

create or replace function public.queue_request_sourced_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Sourced' and old.status is distinct from 'Sourced' and new.customer_id is not null then
    perform enqueue_customer_email('request_sourced', 'request_sourced:' || new.id, new.customer_id,
                                   jsonb_build_object('request_id', new.id));
  end if;
  return null;
end;
$$;

drop trigger if exists queue_request_sourced_email on public.product_requests;
create trigger queue_request_sourced_email
  after update of status on public.product_requests
  for each row execute function public.queue_request_sourced_email();

-- 4/5. Order period announcements. One separate email per address (nobody sees other
-- recipients). p_test sends a single copy to the calling admin's own email.
create or replace function public.queue_email_campaign(p_kind text, p_subject text, p_message text, p_test boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period   bigint;
  v_campaign bigint;
  v_count    integer;
  v_admin    text := lower(nullif(auth.jwt()->>'email', ''));
  v_subject  text := trim(coalesce(p_subject, ''));
  v_message  text := trim(coalesce(p_message, ''));
begin
  if not is_admin() then
    raise exception 'Only admins can send announcements' using errcode = '42501';
  end if;
  if p_kind not in ('period_closed', 'period_opened') then
    raise exception 'Unknown announcement type' using errcode = '22023';
  end if;
  if length(v_subject) < 3 or length(v_subject) > 150 then
    raise exception 'Subject must be 3–150 characters' using errcode = '22023';
  end if;
  if length(v_message) > 5000 then
    raise exception 'Message is too long (max 5000 characters)' using errcode = '22023';
  end if;

  if p_kind = 'period_opened' then
    select id into v_period from order_periods where is_active order by opened_at desc limit 1;
  else
    select id into v_period from order_periods where not is_active and closed_at is not null order by closed_at desc limit 1;
  end if;

  if p_test then
    if v_admin is null then
      raise exception 'Your account has no email address for a test' using errcode = '22023';
    end if;
    insert into email_messages (kind, dedupe_key, recipient, recipient_name, subject, is_test, data)
    values (p_kind, 'test:' || gen_random_uuid(), v_admin, 'Admin (test)', '[TEST] ' || v_subject, true,
            jsonb_build_object('subject', v_subject, 'message', v_message, 'order_period_id', v_period));
    return jsonb_build_object('test', true, 'recipient', v_admin);
  end if;

  -- Guard against an accidental double send of the same announcement.
  if exists (select 1 from email_campaigns
              where kind = p_kind and order_period_id is not distinct from v_period
                and message = v_message and created_at > now() - interval '1 hour') then
    raise exception 'This announcement was already sent in the last hour' using errcode = '23505';
  end if;

  insert into email_campaigns (kind, order_period_id, subject, message, created_by)
  values (p_kind, v_period, v_subject, v_message, auth.uid())
  returning id into v_campaign;

  insert into email_messages (kind, dedupe_key, customer_id, recipient, recipient_name, subject, campaign_id, data)
  select distinct on (lower(trim(c.email)))
         p_kind, 'campaign:' || v_campaign || ':' || lower(trim(c.email)), c.customer_id,
         lower(trim(c.email)), c.customer_name, v_subject, v_campaign, jsonb_build_object('campaign_id', v_campaign)
    from customers c
   where c.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
   order by lower(trim(c.email)), c.customer_id
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;

  update email_campaigns set recipient_count = v_count where id = v_campaign;
  return jsonb_build_object('campaign_id', v_campaign, 'recipients', v_count);
end;
$$;
revoke all on function public.queue_email_campaign(text, text, text, boolean) from public, anon;
grant execute on function public.queue_email_campaign(text, text, text, boolean) to authenticated;

create or replace function public.email_campaign_recipient_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when is_admin()
    then (select count(distinct lower(trim(email)))::int from customers where email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  end;
$$;
revoke all on function public.email_campaign_recipient_count() from public, anon;
grant execute on function public.email_campaign_recipient_count() to authenticated;

-- Admin "Retry" on a failed email.
create or replace function public.retry_email(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can retry emails' using errcode = '42501';
  end if;
  update email_messages
     set status = 'pending', attempts = 0, next_attempt_at = now(), claimed_at = null
   where id = p_id and status = 'failed' and recipient ~ '@';
  if found then perform email_kick(); end if;
end;
$$;
revoke all on function public.retry_email(bigint) from public, anon;
grant execute on function public.retry_email(bigint) to authenticated;

-- ── Worker (service role only) ──────────────────────────────────────────────────
-- Claim due emails; SKIP LOCKED means two workers never take the same email.
create or replace function public.claim_email_batch(p_limit integer default 25)
returns setof public.email_messages
language sql
security definer
set search_path = public
as $$
  update email_messages m
     set status = 'sending', attempts = m.attempts + 1, claimed_at = now()
   where m.id in (
     select id from email_messages
      where (status in ('pending', 'failed') and attempts < 5 and next_attempt_at <= now())
         or (status = 'sending' and claimed_at < now() - interval '10 minutes')
      order by id
      limit greatest(1, least(p_limit, 100))
      for update skip locked)
  returning m.*;
$$;
revoke all on function public.claim_email_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_email_batch(integer) to service_role;

-- Record the outcome. Failures retry after 5 min, 30 min, 2 h, 12 h; then stop.
-- p_final: a failure that can't succeed on retry (e.g. the order no longer exists).
create or replace function public.complete_email(p_id bigint, p_ok boolean, p_subject text, p_provider_id text, p_error text, p_final boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update email_messages
     set status              = case when p_ok then 'sent' else 'failed' end,
         subject             = coalesce(p_subject, subject),
         provider_message_id = case when p_ok then p_provider_id else provider_message_id end,
         sent_at             = case when p_ok then now() else sent_at end,
         last_error          = case when p_ok then null else left(p_error, 1000) end,
         attempts            = case when not p_ok and p_final then 5 else attempts end,
         next_attempt_at     = case when p_ok or p_final or attempts >= 5 then null
                                    else now() + (array[interval '5 minutes', interval '30 minutes', interval '2 hours', interval '12 hours'])[least(attempts, 4)] end,
         claimed_at          = null
   where id = p_id;
end;
$$;
revoke all on function public.complete_email(bigint, boolean, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.complete_email(bigint, boolean, text, text, text, boolean) to service_role;

-- Put a claimed email back untouched (used when the mail service isn't configured yet).
create or replace function public.release_email(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update email_messages
     set status = 'pending', attempts = greatest(attempts - 1, 0), claimed_at = null,
         next_attempt_at = now() + interval '15 minutes'
   where id = p_id;
$$;
revoke all on function public.release_email(bigint) from public, anon, authenticated;
grant execute on function public.release_email(bigint) to service_role;

-- ── Product requests: only admins may read/change/delete; customers create their own ──
drop policy if exists "authenticated users can read product requests"   on public.product_requests;
drop policy if exists "authenticated users can update product requests" on public.product_requests;
drop policy if exists "authenticated users can delete product requests" on public.product_requests;

drop policy if exists admin_read_product_requests on public.product_requests;
create policy admin_read_product_requests on public.product_requests for select to authenticated
  using (is_admin() or customer_id = (select customer_id from customers where auth_id = auth.uid()));
drop policy if exists admin_update_product_requests on public.product_requests;
create policy admin_update_product_requests on public.product_requests for update to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists admin_delete_product_requests on public.product_requests;
create policy admin_delete_product_requests on public.product_requests for delete to authenticated
  using (is_admin());
