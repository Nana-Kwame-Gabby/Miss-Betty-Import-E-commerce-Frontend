-- Offline sale invoices + emailing them.
--
-- * Every offline sale has exactly one invoice, identified by invoice_number (set once when the
--   sale is created, never changed by edits). The invoice itself is rendered on demand from the
--   saved sale by the send-emails function, so it always matches the saved prices and totals.
-- * Payment status (Paid / Partially paid / Unpaid) and amount paid are stored on the sale and
--   validated against the server-computed total.
-- * Sending goes through the existing email_messages outbox (kind 'offline_invoice'), so it is
--   logged, retried, and only marked 'sent' once Brevo accepts it. Each send has its own
--   request id: a double-click/retry queues one email, a deliberate resend queues another.
--   Sending never creates a sale, invoice or money record.

alter table public.offline_sales
  add column if not exists invoice_number text,
  add column if not exists payment_status text not null default 'Paid',
  add column if not exists amount_paid    numeric not null default 0;

alter table public.offline_sales drop constraint if exists offline_sales_payment_status_check;
alter table public.offline_sales add constraint offline_sales_payment_status_check
  check (payment_status in ('Paid', 'Partially paid', 'Unpaid'));
alter table public.offline_sales drop constraint if exists offline_sales_amount_paid_check;
alter table public.offline_sales add constraint offline_sales_amount_paid_check check (amount_paid >= 0);

create or replace function public.offline_sales_set_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'MBI-OFF-' || to_char(coalesce(new.created_at, now()) at time zone 'Africa/Accra', 'YYYY')
                          || '-' || lpad(new.id::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists offline_sales_set_invoice_number on public.offline_sales;
create trigger offline_sales_set_invoice_number
  before insert on public.offline_sales
  for each row execute function public.offline_sales_set_invoice_number();

-- Existing sales: their invoice number, and "paid in full" (the only state before this change).
update public.offline_sales s
   set invoice_number = 'MBI-OFF-' || to_char(s.created_at at time zone 'Africa/Accra', 'YYYY') || '-' || lpad(s.id::text, 5, '0')
 where s.invoice_number is null;
update public.offline_sales s
   set amount_paid = coalesce((select round(sum(i.unit_price * i.quantity), 2) from public.offline_sale_items i where i.sale_id = s.id), 0)
 where s.payment_status = 'Paid';

alter table public.offline_sales alter column invoice_number set not null;
create unique index if not exists offline_sales_invoice_number on public.offline_sales (invoice_number);

-- ── Save: same pricing and stock rules as before, plus payment ───────────────────
drop function if exists public.offline_sale_save(bigint, text, bigint, text, jsonb);

create or replace function public.offline_sale_save(
  p_sale_id bigint, p_buyer_name text, p_order_period_id bigint, p_note text, p_items jsonb,
  p_payment_status text default 'Paid', p_amount_paid numeric default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id bigint;
  period_id bigint;
  old_items jsonb := '[]'::jsonb;
  old_line  offline_sale_items;
  it        jsonb;
  kept      jsonb;
  p         products;
  status_nm text;
  pr        record;
  v_product bigint;
  v_size    text;
  v_colour  text;
  v_qty     numeric;
  sizes     text[];
  colours   text[];
  ptype     text;
  v_total   numeric;
  v_paid    numeric;
begin
  if not is_admin() then
    raise exception 'Only admins can record offline sales' using errcode = '42501';
  end if;
  if coalesce(btrim(p_buyer_name), '') = '' then
    raise exception 'Enter the buyer''s name.' using errcode = '22023';
  end if;
  if coalesce(p_payment_status, 'Paid') not in ('Paid', 'Partially paid', 'Unpaid') then
    raise exception 'Payment status must be Paid, Partially paid or Unpaid.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Too many products in one sale (max 100).' using errcode = '22023';
  end if;

  period_id := coalesce(p_order_period_id, (select id from order_periods where is_active limit 1));
  if period_id is null or not exists (select 1 from order_periods where id = period_id) then
    raise exception 'Order period not found.' using errcode = '22023';
  end if;

  if p_sale_id is not null then
    perform 1 from offline_sales s where s.id = p_sale_id for update;
    if not found then
      raise exception 'This sale no longer exists.' using errcode = 'P0002';
    end if;
    if (select status from offline_sales where id = p_sale_id) = 'Cancelled' then
      raise exception 'A cancelled sale can''t be edited.' using errcode = 'P0001';
    end if;
    -- Put the old lines' stock back, remember their prices, then remove them.
    for old_line in select * from offline_sale_items where offline_sale_items.sale_id = p_sale_id loop
      if old_line.product_type = 'Available' and old_line.product_id is not null then
        perform offline_stock_release(old_line.product_id, old_line.size, old_line.colour, old_line.quantity);
      end if;
      old_items := old_items || to_jsonb(old_line);
    end loop;
    delete from offline_sale_items where offline_sale_items.sale_id = p_sale_id;
    update offline_sales
       set buyer_name = btrim(p_buyer_name), note = nullif(btrim(coalesce(p_note, '')), ''),
           order_period_id = period_id, updated_at = now()
     where id = p_sale_id;
    v_sale_id := p_sale_id;
  else
    insert into offline_sales (buyer_name, note, order_period_id)
    values (btrim(p_buyer_name), nullif(btrim(coalesce(p_note, '')), ''), period_id)
    returning id into v_sale_id;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_product := nullif(it->>'product_id', '')::bigint;
    v_size    := nullif(btrim(coalesce(it->>'size', '')), '');
    v_colour  := nullif(btrim(coalesce(it->>'colour', '')), '');
    v_qty     := nullif(it->>'quantity', '')::numeric;
    if v_qty is null or v_qty <> trunc(v_qty) or v_qty < 1 or v_qty > 10000 then
      raise exception 'Quantity must be a whole number from 1 to 10,000.' using errcode = '22023';
    end if;

    kept := null;
    if it ? 'item_id' and nullif(it->>'item_id', '') is not null then
      select o into kept from jsonb_array_elements(old_items) o
       where (o->>'id')::bigint = (it->>'item_id')::bigint
         and (o->>'product_id')::bigint is not distinct from v_product
         and coalesce(o->>'size', '') = coalesce(v_size, '')
         and coalesce(o->>'colour', '') = coalesce(v_colour, '')
       limit 1;
    end if;

    if kept is not null then
      -- Unchanged line: keep its recorded prices and product type.
      insert into offline_sale_items (sale_id, product_id, product_name_snapshot, product_type, size, colour,
        quantity, original_price, discount_amount, unit_price, cost_price, misc_amount, profit, rmb_price)
      values (v_sale_id, v_product, kept->>'product_name_snapshot', kept->>'product_type', v_size, v_colour,
        v_qty::integer, (kept->>'original_price')::numeric, (kept->>'discount_amount')::numeric,
        (kept->>'unit_price')::numeric, (kept->>'cost_price')::numeric, (kept->>'misc_amount')::numeric,
        (kept->>'profit')::numeric, (kept->>'rmb_price')::numeric);
      ptype := kept->>'product_type';
    else
      if v_product is null then
        raise exception 'Choose a product for every line.' using errcode = '22023';
      end if;
      select * into p from products where product_id = v_product;
      if not found or p.archived_at is not null then
        raise exception 'A selected product is no longer in the shop. Please choose another.' using errcode = '22023';
      end if;

      if jsonb_typeof(p.size_pricing::jsonb) = 'array' and jsonb_array_length(p.size_pricing::jsonb) > 0 then
        select array_agg(e->>'size') into sizes from jsonb_array_elements(p.size_pricing::jsonb) e;
      else
        select array_agg(s) into sizes
          from (select btrim(x) as s from unnest(string_to_array(coalesce(p.size, ''), ',')) x) t where s <> '';
      end if;
      select array_agg(c) into colours
        from (select btrim(x) as c from unnest(string_to_array(coalesce(p.colour, ''), ',')) x) t where c <> '';

      if coalesce(array_length(sizes, 1), 0) > 0 then
        if v_size is null then
          raise exception 'Choose a size for "%".', p.product_name using errcode = '22023';
        elsif not v_size = any(sizes) then
          raise exception '"%" is not a size of "%".', v_size, p.product_name using errcode = '22023';
        end if;
      else
        v_size := null;
      end if;
      if coalesce(array_length(colours, 1), 0) > 0 then
        if v_colour is null then
          raise exception 'Choose a colour for "%".', p.product_name using errcode = '22023';
        elsif not v_colour = any(colours) then
          raise exception '"%" is not a colour of "%".', v_colour, p.product_name using errcode = '22023';
        end if;
      else
        v_colour := null;
      end if;

      select ps.status_name into status_nm from product_status ps where ps.product_status_id = p.product_status_id;
      ptype := case when status_nm = 'Available' then 'Available' else 'Pre-order' end;

      select * into pr from offline_sale_price(v_product, v_size);
      insert into offline_sale_items (sale_id, product_id, product_name_snapshot, product_type, size, colour,
        quantity, original_price, discount_amount, unit_price, cost_price, misc_amount, profit, rmb_price)
      values (v_sale_id, v_product, p.product_name, ptype, v_size, v_colour, v_qty::integer,
        pr.original_price, pr.discount_amount, pr.unit_price, pr.cost_price, pr.misc_amount, pr.profit, pr.rmb_price);
    end if;

    if ptype = 'Available' and v_product is not null then
      perform offline_stock_take(v_product, v_size, v_colour, v_qty::integer);
    end if;
  end loop;

  -- Payment, checked against the total of the lines just saved (server prices).
  select coalesce(sum(i.unit_price * i.quantity), 0) into v_total from offline_sale_items i where i.sale_id = v_sale_id;
  v_total := round(v_total, 2);
  if coalesce(p_payment_status, 'Paid') = 'Paid' then
    v_paid := v_total;
  elsif p_payment_status = 'Unpaid' then
    v_paid := 0;
  else
    v_paid := round(coalesce(p_amount_paid, 0), 2);
    if v_paid <= 0 or v_paid >= v_total then
      raise exception 'For a partial payment, the amount paid must be more than GHS 0 and less than the total (GHS %).',
        to_char(v_total, 'FM999,999,990.00') using errcode = '22023';
    end if;
  end if;
  update offline_sales
     set payment_status = coalesce(p_payment_status, 'Paid'), amount_paid = v_paid
   where id = v_sale_id;

  return v_sale_id;
end;
$$;


revoke all on function public.offline_sale_save(bigint, text, bigint, text, jsonb, text, numeric) from public, anon;
grant execute on function public.offline_sale_save(bigint, text, bigint, text, jsonb, text, numeric) to authenticated;

-- ── Emailing an invoice ───────────────────────────────────────────────────────────
alter table public.email_messages drop constraint if exists email_messages_kind_check;
alter table public.email_messages add constraint email_messages_kind_check
  check (kind in ('order_confirmation', 'shipping_payment', 'request_sourced', 'period_closed', 'period_opened', 'announcement', 'offline_invoice'));

create index if not exists email_messages_offline_sale_idx
  on public.email_messages (((data->>'sale_id')::bigint)) where kind = 'offline_invoice';

create or replace function public.offline_sale_send_invoice(p_sale_id bigint, p_email text, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  s offline_sales;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_key text;
  v_id bigint;
begin
  if not is_admin() then
    raise exception 'Only admins can send invoices' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Missing request id.' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  select * into s from offline_sales where id = p_sale_id;
  if not found then
    raise exception 'This sale no longer exists.' using errcode = 'P0002';
  end if;
  if s.status = 'Cancelled' then
    raise exception 'This sale was cancelled, so its invoice can''t be sent.' using errcode = 'P0001';
  end if;

  v_key := 'offline_invoice:' || p_request_id::text;
  insert into email_messages (kind, dedupe_key, recipient, recipient_name, data)
  values ('offline_invoice', v_key, v_email, s.buyer_name,
          jsonb_build_object('sale_id', s.id, 'invoice_number', s.invoice_number))
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then  -- same request repeated: return the email it already queued
    select id into v_id from email_messages where dedupe_key = v_key;
  end if;
  return v_id;
end;
$$;

revoke all on function public.offline_sale_send_invoice(bigint, text, uuid) from public, anon;
grant execute on function public.offline_sale_send_invoice(bigint, text, uuid) to authenticated;
