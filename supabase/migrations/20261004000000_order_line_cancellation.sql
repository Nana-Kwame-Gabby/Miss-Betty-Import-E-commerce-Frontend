-- Product-level (order line) cancellation.
--
-- orders has one row per product line; invoices mirrors those lines for display but only
-- kept a product-name snapshot. This links each invoice line to its order line and adds
-- admin-only functions that cancel a single line (or a whole order) in one transaction.
-- Cancelled lines are kept (status 'Cancelled', cancelled_at) for history; every screen
-- excludes them from quantities, totals, shipping fees and customer views.

alter table public.orders add column if not exists cancelled_at timestamptz;

alter table public.invoices
  add column if not exists order_line_id bigint references public.orders(id) on delete set null;
create index if not exists invoices_order_line_id on public.invoices (order_line_id);

-- Backfill: invoice and order lines for an order are created together from the same item
-- list, so their creation order matches. Link only when the line details agree too.
with o as (
  select id, order_id, size, colour, quantity, unit_price,
         row_number() over (partition by order_id order by id) as rn
    from public.orders
), i as (
  select id, invoice_id, size, colour, quantity, unit_price,
         row_number() over (partition by invoice_id order by id) as rn
    from public.invoices
   where order_line_id is null
)
update public.invoices inv
   set order_line_id = o.id
  from i join o on o.order_id = i.invoice_id and o.rn = i.rn
 where inv.id = i.id
   and o.size is not distinct from i.size
   and o.colour is not distinct from i.colour
   and o.quantity = i.quantity
   and o.unit_price = i.unit_price;

-- New invoice lines link themselves to the matching, not-yet-linked order line (covers the
-- Hubtel callback and the confirmation-page fallback without touching payment code).
create or replace function public.link_invoice_to_order_line()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_line_id is null then
    select o.id into new.order_line_id
      from orders o
     where o.order_id = new.invoice_id
       and o.size is not distinct from new.size
       and o.colour is not distinct from new.colour
       and o.quantity = new.quantity
       and o.unit_price = new.unit_price
       and not exists (select 1 from invoices i where i.order_line_id = o.id)
     order by o.id
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists link_invoice_to_order_line on public.invoices;
create trigger link_invoice_to_order_line
  before insert on public.invoices
  for each row execute function public.link_invoice_to_order_line();

-- Cancel one order line. Admin only; all-or-nothing (a plpgsql function runs in one
-- transaction). For Available goods the quantity goes back into stock, reversing
-- decrement_variant_stock exactly: oversold units are released first.
create or replace function public.admin_cancel_order_line(p_line_id bigint)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  line orders;
  stock product_variant_stock;
  release_oversold integer;
begin
  if not is_admin() then
    raise exception 'Only admins can cancel orders' using errcode = '42501';
  end if;

  select * into line from orders where id = p_line_id for update;
  if not found then
    raise exception 'Order line % not found', p_line_id using errcode = 'P0002';
  end if;
  if line.status = 'Cancelled' then
    raise exception 'This product has already been cancelled' using errcode = 'P0001';
  end if;

  update orders
     set status = 'Cancelled', cancelled_at = now(), can_edit_delivery = false
   where id = p_line_id
   returning * into line;

  if line.product_type = 'Available' then
    select * into stock from product_variant_stock
     where product_id = line.product_id
       and size = coalesce(line.size, '')
       and colour = coalesce(line.colour, '')
     for update;
    if found then
      release_oversold := least(coalesce(stock.oversold_count, 0), line.quantity);
      update product_variant_stock
         set oversold_count = coalesce(oversold_count, 0) - release_oversold,
             stock_quantity = stock_quantity + (line.quantity - release_oversold)
       where id = stock.id;
    end if;
  end if;

  return line;
end;
$$;

-- Cancel every active line of an order in one transaction (whole-order "Cancelled").
create or replace function public.admin_cancel_order(p_order_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  line_id bigint;
  cancelled integer := 0;
begin
  if not is_admin() then
    raise exception 'Only admins can cancel orders' using errcode = '42501';
  end if;
  for line_id in
    select id from orders where order_id = p_order_id and status is distinct from 'Cancelled' order by id
  loop
    perform admin_cancel_order_line(line_id);
    cancelled := cancelled + 1;
  end loop;
  return cancelled;
end;
$$;

revoke all on function public.admin_cancel_order_line(bigint) from public;
revoke all on function public.admin_cancel_order(text) from public;
grant execute on function public.admin_cancel_order_line(bigint) to authenticated;
grant execute on function public.admin_cancel_order(text) to authenticated;
