-- First-party, privacy-friendly website analytics.
-- One row per page view. No IP addresses, cookies, raw user agents or account links are
-- stored: the visitor id is a random id kept in the visitor's browser.
-- Writes go only through record_page_view (called by /api/track); reads only through
-- get_site_analytics (admins).

create table if not exists public.site_page_views (
  id            bigint generated always as identity primary key,
  visitor_id    uuid        not null,
  session_id    uuid        not null,
  path          text        not null,
  source        text,        -- set on the first page of a session only: direct/search/social/referral
  referrer_host text,
  country       text,        -- ISO 3166 alpha-2, from Vercel's geo header
  device        text        not null default 'desktop',
  browser       text,
  os            text,
  created_at    timestamptz not null default now()
);

create index if not exists site_page_views_created_at_idx on public.site_page_views (created_at);
create index if not exists site_page_views_visitor_idx    on public.site_page_views (visitor_id, created_at);
create index if not exists site_page_views_session_idx    on public.site_page_views (session_id);

alter table public.site_page_views enable row level security;
revoke all on public.site_page_views from anon, authenticated;

-- Record one page view. Every value is validated so the table only ever holds clean data.
create or replace function public.record_page_view(
  p_visitor uuid, p_session uuid, p_path text,
  p_source text default null, p_referrer_host text default null, p_country text default null,
  p_device text default null, p_browser text default null, p_os text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text := left(split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1), 300);
  v_ref  text := lower(left(coalesce(p_referrer_host, ''), 100));
  v_cc   text := upper(coalesce(p_country, ''));
  v_lbl  text := '^[A-Za-z0-9 .()-]{1,30}$';
begin
  if p_visitor is null or p_session is null then return; end if;
  if v_path !~ '^/' or v_path ~ '^/admin' then return; end if;

  -- A runaway client can't flood the table: at most 300 views per session.
  if (select count(*) from site_page_views where session_id = p_session) >= 300 then return; end if;

  insert into site_page_views (visitor_id, session_id, path, source, referrer_host, country, device, browser, os)
  values (
    p_visitor, p_session, v_path,
    case when p_source in ('direct', 'search', 'social', 'referral') then p_source end,
    case when v_ref ~ '^[a-z0-9.-]+$' then v_ref end,
    case when v_cc ~ '^[A-Z]{2}$' and v_cc <> 'XX' then v_cc end,
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
    case when p_browser ~ v_lbl then p_browser end,
    case when p_os ~ v_lbl then p_os end
  );
end;
$$;

revoke all on function public.record_page_view(uuid, uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.record_page_view(uuid, uuid, text, text, text, text, text, text, text) to anon, authenticated;

-- Everything the admin "Website Visitors" page shows, for [p_from, p_to).
-- Days and hours are in Ghana time.
create or replace function public.get_site_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set timezone = 'Africa/Accra'
as $$
declare
  v_len    interval := p_to - p_from;
  v_bucket text     := case when p_to - p_from <= interval '2 days' then 'hour' else 'day' end;
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can view website analytics' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or v_len > interval '400 days' then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;

  with r as (
    select * from site_page_views where created_at >= p_from and created_at < p_to
  ),
  prev as (
    select * from site_page_views where created_at >= p_from - v_len and created_at < p_from
  ),
  first_seen as (
    select visitor_id, min(created_at) as first_at
      from site_page_views
     where visitor_id in (select distinct visitor_id from r)
     group by visitor_id
  ),
  buckets as (
    select generate_series(date_trunc(v_bucket, p_from), p_to - interval '1 second', ('1 ' || v_bucket)::interval) as b
  ),
  series as (
    select bk.b,
           count(r.id)                  as views,
           count(distinct r.visitor_id) as visitors,
           count(distinct r.session_id) as sessions
      from buckets bk
      left join r on date_trunc(v_bucket, r.created_at) = bk.b
     group by bk.b
  ),
  pages as (
    select r.path, count(*) as views, count(distinct r.visitor_id) as visitors,
           max(p.product_name) as product_name
      from r
      left join products p
        on r.path ~ '^/shop/[0-9]{1,9}$' and p.product_id = substring(r.path from '^/shop/([0-9]+)$')::int
     group by r.path
     order by views desc, r.path
     limit 15
  )
  select jsonb_build_object(
    'bucket', v_bucket,
    'totals', (select jsonb_build_object(
        'views',    count(*),
        'visitors', count(distinct visitor_id),
        'sessions', count(distinct session_id)) from r),
    'previous', (select jsonb_build_object(
        'views',    count(*),
        'visitors', count(distinct visitor_id),
        'sessions', count(distinct session_id)) from prev),
    'new_visitors',       (select count(*) from first_seen where first_at >= p_from),
    'returning_visitors', (select count(*) from first_seen where first_at <  p_from),
    'all_time_visitors',  (select count(distinct visitor_id) from site_page_views),
    'series', coalesce((select jsonb_agg(jsonb_build_object(
        't', to_char(b, 'YYYY-MM-DD"T"HH24:MI'), 'views', views, 'visitors', visitors, 'sessions', sessions)
        order by b) from series), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'path', path, 'views', views, 'visitors', visitors, 'product_name', product_name)
        order by views desc, path) from pages), '[]'::jsonb),
    -- Sources and referrers count visits (sessions); the rest count unique visitors.
    'sources', coalesce((select jsonb_agg(x order by (x->>'count')::int desc) from (
        select jsonb_build_object('label', source, 'count', count(distinct session_id)) x
          from r where source is not null group by source) s), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(x order by (x->>'count')::int desc) from (
        select jsonb_build_object('label', referrer_host, 'count', count(distinct session_id)) x
          from r where referrer_host is not null group by referrer_host
         order by count(distinct session_id) desc limit 10) s), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(x order by (x->>'count')::int desc) from (
        select jsonb_build_object('label', coalesce(country, '??'), 'count', count(distinct visitor_id)) x
          from r group by coalesce(country, '??')
         order by count(distinct visitor_id) desc limit 12) s), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(x order by (x->>'count')::int desc) from (
        select jsonb_build_object('label', device, 'count', count(distinct visitor_id)) x
          from r group by device) s), '[]'::jsonb),
    'browsers', coalesce((select jsonb_agg(x order by (x->>'count')::int desc) from (
        select jsonb_build_object('label', coalesce(browser, 'Other'), 'count', count(distinct visitor_id)) x
          from r group by coalesce(browser, 'Other')
         order by count(distinct visitor_id) desc limit 8) s), '[]'::jsonb),
    'os', coalesce((select jsonb_agg(x order by (x->>'count')::int desc) from (
        select jsonb_build_object('label', coalesce(os, 'Other'), 'count', count(distinct visitor_id)) x
          from r group by coalesce(os, 'Other')
         order by count(distinct visitor_id) desc limit 8) s), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_site_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_site_analytics(timestamptz, timestamptz) to authenticated;
