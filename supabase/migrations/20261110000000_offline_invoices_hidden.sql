-- Invoices page "Delete All" for offline sales.
--
-- The Invoices page lists online invoices (the invoices table) and offline invoices (read
-- straight from offline_sales, one invoice per sale). Delete All deletes the online invoice
-- rows; offline invoices are the sales themselves, so they are only hidden from that page.
-- The sale, its PDF invoice and the Offline Buyers totals are untouched.

alter table public.offline_sales add column if not exists invoices_hidden_at timestamptz;

create or replace function public.offline_sales_hide_invoices(p_sale_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not is_admin() then
    raise exception 'Only admins can clear invoices' using errcode = '42501';
  end if;
  update offline_sales
     set invoices_hidden_at = now()
   where id = any(coalesce(p_sale_ids, '{}'))
     and invoices_hidden_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.offline_sales_hide_invoices(bigint[]) from public, anon;
grant execute on function public.offline_sales_hide_invoices(bigint[]) to authenticated;
