-- Server-verified shipping fee payments ("pay one product" and "Pay All").
--
-- Before: the buyer's browser computed the amount and, on returning from Hubtel with
-- ?status=success, marked its own order lines paid and inserted the payment record itself.
-- Now: the amount is computed here from the buyer's currently unpaid lines, and lines are
-- marked paid only by finalize_shipping_payment, which the Edge Functions call after Hubtel
-- confirms the payment.

-- One row per payment attempt, with a snapshot of exactly which lines it covers.
create table if not exists public.shipping_payment_requests (
  shp_ref      text primary key,
  customer_id  integer not null references public.customers(customer_id) on delete cascade,
  amount       numeric not null check (amount > 0),
  lines        jsonb not null,   -- [{line_id, product_id, size, order_period_id, fee_per_item, quantity, amount}]
  status       text not null default 'pending'
               check (status in ('pending', 'paid', 'superseded', 'amount_mismatch')),
  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  paid_amount  numeric
);
create index if not exists shipping_payment_requests_customer on public.shipping_payment_requests (customer_id, status);

alter table public.shipping_payment_requests enable row level security;
create policy "shipping_requests_read_own" on public.shipping_payment_requests
  for select using (customer_id = (select c.customer_id from public.customers c where c.auth_id = auth.uid()));
create policy "shipping_requests_admin_read" on public.shipping_payment_requests
  for select using (is_admin());

-- Start a payment for the caller's currently unpaid shipping fees: all of them
-- (p_line_ids null = "Pay All") or just the given order lines (one product).
-- The amount is computed from the current rates, so already-paid fees are never included.
create or replace function public.create_shipping_payment(p_line_ids bigint[] default null)
returns table (shp_ref text, amount numeric, line_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer integer;
  v_lines    jsonb;
  v_amount   numeric;
  v_count    integer;
  v_ref      text;
begin
  select c.customer_id into v_customer from customers c where c.auth_id = auth.uid();
  if v_customer is null then
    raise exception 'Please log in to pay shipping fees' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'line_id', o.id, 'product_id', o.product_id, 'size', o.size,
           'order_period_id', o.order_period_id, 'fee_per_item', f.shipping_fee,
           'quantity', o.quantity, 'amount', f.shipping_fee * o.quantity) order by o.id), '[]'::jsonb),
         coalesce(sum(f.shipping_fee * o.quantity), 0),
         count(*)
    into v_lines, v_amount, v_count
    from orders o
    join product_size_shipping_fees f
      on f.order_period_id = o.order_period_id
     and f.product_id = o.product_id
     and f.size = coalesce(o.size, '')
   where o.customer_id = v_customer
     and o.shipping_fee_paid = false
     and o.status <> 'Cancelled'
     and o.product_type = 'Pre-order'
     and f.dismissed_at is null
     and f.shipping_fee > 0
     and (p_line_ids is null or o.id = any(p_line_ids));

  if v_count = 0 then
    raise exception 'There are no outstanding shipping fees to pay' using errcode = 'P0001';
  end if;

  -- An earlier attempt covering any of these lines that never completed is superseded,
  -- so an abandoned payment never blocks a retry. (If it does complete later, finalize
  -- still records it.)
  update shipping_payment_requests r
     set status = 'superseded'
   where r.customer_id = v_customer
     and r.status = 'pending'
     and exists (
       select 1 from jsonb_array_elements(r.lines) old_l, jsonb_array_elements(v_lines) new_l
        where (old_l->>'line_id') = (new_l->>'line_id'));

  v_ref := 'SHP-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
  insert into shipping_payment_requests (shp_ref, customer_id, amount, lines)
  values (v_ref, v_customer, v_amount, v_lines);

  return query select v_ref, v_amount, v_count;
end;
$$;

-- Apply a payment that Hubtel has confirmed. Called only by the Edge Functions (service role)
-- after verifying the transaction with Hubtel. Idempotent.
create or replace function public.finalize_shipping_payment(p_ref text, p_paid_amount numeric)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req shipping_payment_requests;
  l   jsonb;
begin
  select * into req from shipping_payment_requests where shp_ref = p_ref for update;
  if not found then
    return 'not_found';
  end if;
  if req.status = 'paid' then
    return 'already_paid';
  end if;
  -- Hubtel reports the gross amount (requested amount plus its fee), so it is never less
  -- than what we asked for; allow 1 pesewa for rounding.
  if p_paid_amount is null or p_paid_amount < req.amount - 0.01 then
    update shipping_payment_requests set status = 'amount_mismatch', paid_amount = p_paid_amount
     where shp_ref = p_ref;
    return 'amount_mismatch';
  end if;

  -- Mark exactly the lines this payment covered, recording the fee actually charged.
  for l in select * from jsonb_array_elements(req.lines) loop
    update orders
       set shipping_fee_paid = true,
           shipping_fee = (l->>'fee_per_item')::numeric
     where id = (l->>'line_id')::bigint
       and shipping_fee_paid = false
       and status <> 'Cancelled';
  end loop;

  -- One payment record per product/size/period, as the admin dashboard expects.
  insert into shipping_fee_payments (customer_id, amount_paid, product_id, size, order_period_id, paid_at)
  select req.customer_id,
         sum((x->>'amount')::numeric),
         (x->>'product_id')::integer,
         x->>'size',
         (x->>'order_period_id')::bigint,
         now()
    from jsonb_array_elements(req.lines) x
   group by x->>'product_id', x->>'size', x->>'order_period_id';

  update shipping_payment_requests
     set status = 'paid', paid_at = now(), paid_amount = p_paid_amount
   where shp_ref = p_ref;
  return 'paid';
end;
$$;

-- Customers start payments; only the server (service role) can finalize them.
revoke all on function public.create_shipping_payment(bigint[]) from public, anon;
grant execute on function public.create_shipping_payment(bigint[]) to authenticated;
revoke all on function public.finalize_shipping_payment(text, numeric) from public, anon, authenticated;
grant execute on function public.finalize_shipping_payment(text, numeric) to service_role;

-- Customers may still edit delivery details, confirm receipt and hide orders, but can no
-- longer mark their own shipping fees as paid.
create or replace function public.guard_order_shipping_columns()
returns trigger
language plpgsql
as $$
begin
  if (new.shipping_fee_paid is distinct from old.shipping_fee_paid
      or new.shipping_fee is distinct from old.shipping_fee)
     and current_user in ('authenticated', 'anon')
     and not is_admin() then
    raise exception 'Shipping fees can only be marked paid by a confirmed payment' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_order_shipping_columns on public.orders;
create trigger guard_order_shipping_columns
  before update on public.orders
  for each row execute function public.guard_order_shipping_columns();

-- Payment records are now written only by finalize_shipping_payment.
drop policy if exists "users_insert_payment" on public.shipping_fee_payments;
