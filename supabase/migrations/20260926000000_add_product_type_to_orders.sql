-- Record whether each order line was a Pre-order or Available Goods sale at the
-- moment it was placed, so the two admin dashboards stay separate even if a
-- product's status changes later.
alter table public.orders
  add column if not exists product_type text
  check (product_type in ('Pre-order', 'Available'));

create or replace function public.set_order_product_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_type is null then
    select ps.status_name into new.product_type
      from products p
      join product_status ps on ps.product_status_id = p.product_status_id
     where p.product_id = new.product_id;
    new.product_type := coalesce(new.product_type, 'Pre-order');
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_product_type on public.orders;
create trigger set_order_product_type
  before insert on public.orders
  for each row execute function public.set_order_product_type();

-- Backfill: current product status is the best information available for past
-- orders; orders whose product was deleted count as Pre-order.
update public.orders o
   set product_type = coalesce(
         (select ps.status_name
            from products p
            join product_status ps on ps.product_status_id = p.product_status_id
           where p.product_id = o.product_id),
         'Pre-order')
 where o.product_type is null;
