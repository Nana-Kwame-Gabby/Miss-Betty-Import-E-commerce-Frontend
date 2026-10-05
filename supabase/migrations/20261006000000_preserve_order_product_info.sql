-- Deleting a product must never erase what customers ordered.
--  * orders.product_name_snapshot keeps each line's product name forever.
--  * products.archived_at removes a product from the shop without deleting it, so
--    orders, shipping fee rates/payments, stock and reviews stay linked.

-- 1. Name snapshot on every order line ------------------------------------------
alter table public.orders add column if not exists product_name_snapshot text;

-- Lines still linked to their product.
update public.orders o
   set product_name_snapshot = p.product_name
  from public.products p
 where p.product_id = o.product_id
   and o.product_name_snapshot is null;

-- Lines whose product link was already cleared by the old delete: recover the
-- name from the invoice line written at checkout.
update public.orders o
   set product_name_snapshot = i.product_name
  from public.invoices i
 where i.order_line_id = o.id
   and o.product_id is null
   and o.product_name_snapshot is null
   and i.product_name is not null;

-- New lines take the name from the product. On update, only admins (or the
-- server) may change it, so customers can't rename what they ordered.
create or replace function public.set_order_product_name_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    select product_name into v_name from products where product_id = new.product_id;
    new.product_name_snapshot := coalesce(v_name, new.product_name_snapshot);
  elsif new.product_name_snapshot is distinct from old.product_name_snapshot
        and current_user in ('authenticated', 'anon')
        and not is_admin() then
    new.product_name_snapshot := old.product_name_snapshot;
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_product_name_snapshot on public.orders;
create trigger set_order_product_name_snapshot
  before insert or update of product_name_snapshot on public.orders
  for each row execute function public.set_order_product_name_snapshot();

-- 2. Soft delete for products -----------------------------------------------------
alter table public.products add column if not exists archived_at timestamptz;

create index if not exists products_active_idx on public.products (product_id) where archived_at is null;
