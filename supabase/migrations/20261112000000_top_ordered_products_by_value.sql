-- "Most ordered" shelves now favour the products that bring in the most money: rank by total
-- sales value (quantity x the price actually paid), from website orders and recorded offline
-- sales, leaving out anything cancelled and any archived product. Ties go to the product sold
-- in greater quantity, then the most recently sold. Still returns product ids only.

create or replace function public.top_ordered_products(p_limit int default 40)
returns table (product_id int)
language sql
stable
security definer
set search_path = public
as $$
  with sold as (
    select o.product_id::bigint as pid, o.quantity::bigint as qty,
           o.quantity * coalesce(o.unit_price, 0) as value, o.created_at as at
    from orders o
    where o.cancelled_at is null
      and coalesce(o.status, '') <> 'Cancelled'
      and o.product_id is not null
    union all
    select i.product_id, i.quantity, i.quantity * coalesce(i.unit_price, 0), i.created_at
    from offline_sale_items i
    join offline_sales s on s.id = i.sale_id
    where coalesce(s.status, '') <> 'Cancelled'
      and i.product_id is not null
  ),
  ranked as (
    select pid, sum(value) as total_value, sum(qty) as total_qty, max(at) as last_at
    from sold
    group by pid
  )
  select p.product_id
  from ranked r
  join products p on p.product_id = r.pid
  where p.archived_at is null
    and r.total_qty > 0
  order by r.total_value desc, r.total_qty desc, r.last_at desc nulls last, p.product_id desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.top_ordered_products(int) from public;
grant execute on function public.top_ordered_products(int) to anon, authenticated;
