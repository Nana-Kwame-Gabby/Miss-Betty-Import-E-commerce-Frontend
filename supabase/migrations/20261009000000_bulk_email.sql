-- Bulk Email: admin announcements to every customer, built on the existing email outbox.
-- A new 'announcement' campaign kind (alongside the order-period ones); each customer still
-- gets their own single-recipient email, sent in batches by the send-emails worker.

alter table public.email_campaigns drop constraint if exists email_campaigns_kind_check;
alter table public.email_campaigns add constraint email_campaigns_kind_check
  check (kind in ('period_closed', 'period_opened', 'announcement'));

alter table public.email_messages drop constraint if exists email_messages_kind_check;
alter table public.email_messages add constraint email_messages_kind_check
  check (kind in ('order_confirmation', 'shipping_payment', 'request_sourced', 'period_closed', 'period_opened', 'announcement'));

alter table public.email_campaigns
  add column if not exists created_by_email text,
  add column if not exists button_label     text,
  add column if not exists button_url       text;

-- Same function as before, plus announcements and an optional call-to-action button.
drop function if exists public.queue_email_campaign(text, text, text, boolean);

create or replace function public.queue_email_campaign(
  p_kind text, p_subject text, p_message text, p_test boolean default false,
  p_button_label text default null, p_button_url text default null
)
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
  v_label    text := nullif(trim(coalesce(p_button_label, '')), '');
  v_url      text := nullif(trim(coalesce(p_button_url, '')), '');
begin
  if not is_admin() then
    raise exception 'Only admins can send announcements' using errcode = '42501';
  end if;
  if p_kind not in ('period_closed', 'period_opened', 'announcement') then
    raise exception 'Unknown announcement type' using errcode = '22023';
  end if;
  if length(v_subject) < 3 or length(v_subject) > 150 then
    raise exception 'Subject must be 3–150 characters' using errcode = '22023';
  end if;
  if length(v_message) > 10000 then
    raise exception 'Message is too long (max 10,000 characters)' using errcode = '22023';
  end if;
  if p_kind = 'announcement' and length(v_message) < 1 then
    raise exception 'Please write a message' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~ '^https://[^\s<>"]+$' or length(v_url) > 500) then
    raise exception 'The button link must be a full https:// address' using errcode = '22023';
  end if;
  if v_label is not null and length(v_label) > 60 then
    raise exception 'Button text must be 60 characters or fewer' using errcode = '22023';
  end if;
  if v_url is not null and v_label is null then v_label := 'Learn more'; end if;

  if p_kind = 'period_opened' then
    select id into v_period from order_periods where is_active order by opened_at desc limit 1;
  elsif p_kind = 'period_closed' then
    select id into v_period from order_periods where not is_active and closed_at is not null order by closed_at desc limit 1;
  end if;

  if p_test then
    if v_admin is null then
      raise exception 'Your account has no email address for a test' using errcode = '22023';
    end if;
    insert into email_messages (kind, dedupe_key, recipient, recipient_name, subject, is_test, data)
    values (p_kind, 'test:' || gen_random_uuid(), v_admin, 'Admin (test)', '[TEST] ' || v_subject, true,
            jsonb_build_object('subject', v_subject, 'message', v_message, 'order_period_id', v_period,
                               'button_label', v_label, 'button_url', v_url));
    return jsonb_build_object('test', true, 'recipient', v_admin);
  end if;

  -- Guard against an accidental double send of the same announcement.
  if exists (select 1 from email_campaigns
              where kind = p_kind and order_period_id is not distinct from v_period
                and subject = v_subject and message = v_message
                and created_at > now() - interval '1 hour') then
    raise exception 'This email was already sent in the last hour' using errcode = '23505';
  end if;

  insert into email_campaigns (kind, order_period_id, subject, message, created_by, created_by_email, button_label, button_url)
  values (p_kind, v_period, v_subject, v_message, auth.uid(), v_admin, v_label, v_url)
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
revoke all on function public.queue_email_campaign(text, text, text, boolean, text, text) from public, anon;
grant execute on function public.queue_email_campaign(text, text, text, boolean, text, text) to authenticated;

-- Bulk email history with delivery counts (counted here, not downloaded per recipient).
create or replace function public.get_bulk_email_history(p_limit integer default 50)
returns table (
  id bigint, kind text, subject text, message text, button_label text, button_url text,
  created_at timestamptz, created_by_email text, recipient_count integer,
  sent integer, failed integer, waiting integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can view email history' using errcode = '42501';
  end if;
  return query
  select c.id, c.kind, c.subject, c.message, c.button_label, c.button_url,
         c.created_at, c.created_by_email, c.recipient_count,
         coalesce(s.sent, 0), coalesce(s.failed, 0), coalesce(s.waiting, 0)
    from email_campaigns c
    left join lateral (
      select count(*) filter (where m.status = 'sent')::int                   as sent,
             count(*) filter (where m.status = 'failed')::int                 as failed,
             count(*) filter (where m.status in ('pending', 'sending'))::int  as waiting
        from email_messages m where m.campaign_id = c.id
    ) s on true
   order by c.created_at desc
   limit greatest(1, least(p_limit, 200));
end;
$$;
revoke all on function public.get_bulk_email_history(integer) from public, anon;
grant execute on function public.get_bulk_email_history(integer) to authenticated;
