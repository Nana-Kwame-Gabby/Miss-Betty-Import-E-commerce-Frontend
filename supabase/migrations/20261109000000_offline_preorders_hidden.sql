-- Pre-Orders page "Delete All" for offline sales.
--
-- The Pre-Orders page lists online and offline pre-orders together. Its Delete All hides the
-- period's online orders (orders.deleted_by_admin); this flag does the same for offline sales.
-- It only affects the Pre-Orders page: the sale, its invoice and the Offline Buyers totals are
-- untouched. Sale-level (like the online order-level flag), so it survives edits to the sale.

alter table public.offline_sales add column if not exists preorders_hidden_at timestamptz;

create or replace function public.offline_sales_hide_preorders(p_sale_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not is_admin() then
    raise exception 'Only admins can clear pre-orders' using errcode = '42501';
  end if;
  update offline_sales
     set preorders_hidden_at = now()
   where id = any(coalesce(p_sale_ids, '{}'))
     and preorders_hidden_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.offline_sales_hide_preorders(bigint[]) from public, anon;
grant execute on function public.offline_sales_hide_preorders(bigint[]) to authenticated;
