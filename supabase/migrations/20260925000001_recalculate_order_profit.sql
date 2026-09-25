-- Store actual per-unit profit on every order: price paid minus cost minus misc.
-- Buy Now orders had saved the pre-discount profit, and cart orders counted misc as profit.
update public.orders
   set profit = round(unit_price - cost_price - coalesce(misc_amount, 0), 2)
 where profit is distinct from round(unit_price - cost_price - coalesce(misc_amount, 0), 2);
