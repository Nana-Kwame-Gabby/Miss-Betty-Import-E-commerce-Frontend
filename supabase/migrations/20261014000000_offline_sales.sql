-- Offline sales: purchases paid to the admin directly (MoMo, cash) rather than through the app.
--
-- Kept apart from orders/invoices so app-only screens (dashboards, shipping fees, customer
-- pages) are unaffected. Prices are always computed here from the product's settings, using
-- the same rule as the shop (ProductDetailPage / priceUtils):
--   regular  = size entry selling_price ?? price ?? product.unit_price
--   discount = size entry discount_price ?? product.discount_price, used only if 0 < d < regular
--   cost/misc/rmb = size entry value ?? product value
--   profit   = price paid - cost - misc   (discount comes off profit once; misc is never profit)
-- Available-goods stock moves exactly like app orders (decrement_variant_stock /
-- admin_cancel_order_line): units beyond what is in stock are counted as oversold, and are
-- released first when stock is put back.

create table if not exists public.offline_sales (
  id              bigint generated always as identity primary key,
  buyer_name      text not null check (length(btrim(buyer_name)) between 1 and 120),
  note            text check (note is null or length(note) <= 1000),
  order_period_id bigint references public.order_periods(id),
  status          text not null default 'Active' check (status in ('Active', 'Cancelled')),
  cancelled_at    timestamptz,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists offline_sales_period on public.offline_sales (order_period_id, created_at desc);

create table if not exists public.offline_sale_items (
  id                    bigint generated always as identity primary key,
  sale_id               bigint not null references public.offline_sales(id) on delete cascade,
  product_id            bigint references public.products(product_id) on delete set null,
  product_name_snapshot text not null,
  product_type          text not null check (product_type in ('Pre-order', 'Available')),
  size                  text,
  colour                text,
  quantity              integer not null check (quantity between 1 and 10000),
  -- all amounts are per unit (GHS), like orders
  original_price        numeric not null default 0,  -- regular selling price before discount
  discount_amount       numeric not null default 0,  -- original_price - unit_price
  unit_price            numeric not null default 0,  -- selling price actually charged
  cost_price            numeric not null default 0,
  misc_amount           numeric not null default 0,
  profit                numeric not null default 0,
  rmb_price             numeric not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists offline_sale_items_sale on public.offline_sale_items (sale_id);

alter table public.offline_sales      enable row level security;
alter table public.offline_sale_items enable row level security;

-- Admins read directly; every write goes through the functions below.
drop policy if exists "admin_select_offline_sales" on public.offline_sales;
create policy "admin_select_offline_sales" on public.offline_sales
  for select to authenticated using (is_admin());
drop policy if exists "admin_select_offline_sale_items" on public.offline_sale_items;
create policy "admin_select_offline_sale_items" on public.offline_sale_items
  for select to authenticated using (is_admin());

-- ── Pricing ──────────────────────────────────────────────────────────────────
create or replace function public.offline_sale_price(p_product_id bigint, p_size text)
returns table (original_price numeric, discount_amount numeric, unit_price numeric,
               cost_price numeric, misc_amount numeric, profit numeric, rmb_price numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p products;
  entry jsonb;
  regular numeric;
  disc numeric;
  paid numeric;
  cost numeric;
  misc numeric;
begin
  select * into p from products where product_id = p_product_id;
  if not found then
    raise exception 'Product % not found', p_product_id using errcode = 'P0002';
  end if;

  if jsonb_typeof(p.size_pricing::jsonb) = 'array' and jsonb_array_length(p.size_pricing::jsonb) > 0
     and coalesce(p_size, '') <> '' then
    select e into entry
      from jsonb_array_elements(p.size_pricing::jsonb) e
     where e->>'size' = p_size
     limit 1;
  end if;

  regular := coalesce((entry->>'selling_price')::numeric, (entry->>'price')::numeric, p.unit_price, 0);
  disc    := coalesce((entry->>'discount_price')::numeric, p.discount_price);
  paid    := case when disc is not null and disc > 0 and disc < regular then disc else regular end;
  cost    := coalesce((entry->>'cost_price')::numeric, p.cost_price, 0);
  misc    := coalesce((entry->>'misc_amount')::numeric, p.misc_amount, 0);

  original_price  := regular;
  discount_amount := round(regular - paid, 2);
  unit_price      := paid;
  cost_price      := cost;
  misc_amount     := misc;
  profit          := round(paid - cost - misc, 2);
  rmb_price       := coalesce((entry->>'rmb_price')::numeric, p.rmb_price, 0);
  return next;
end;
$$;

-- ── Stock (Available goods with a tracked variant row only) ─────────────────
create or replace function public.offline_stock_take(p_product_id bigint, p_size text, p_colour text, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stock product_variant_stock;
  taken integer;
begin
  select * into stock from product_variant_stock
   where product_id = p_product_id and size = coalesce(p_size, '') and colour = coalesce(p_colour, '')
   for update;
  if not found then return; end if;  -- untracked = unlimited
  taken := least(greatest(stock.stock_quantity, 0), p_qty);
  update product_variant_stock
     set stock_quantity = stock_quantity - taken,
         oversold_count = coalesce(oversold_count, 0) + (p_qty - taken)
   where id = stock.id;
end;
$$;

create or replace function public.offline_stock_release(p_product_id bigint, p_size text, p_colour text, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stock product_variant_stock;
  release_oversold integer;
begin
  select * into stock from product_variant_stock
   where product_id = p_product_id and size = coalesce(p_size, '') and colour = coalesce(p_colour, '')
   for update;
  if not found then return; end if;
  release_oversold := least(coalesce(stock.oversold_count, 0), p_qty);
  update product_variant_stock
     set oversold_count = coalesce(oversold_count, 0) - release_oversold,
         stock_quantity = stock_quantity + (p_qty - release_oversold)
   where id = stock.id;
end;
$$;

-- ── Save (create or edit) ────────────────────────────────────────────────────
-- p_items: [{ "product_id": 12, "size": "M" | null, "colour": "Red" | null, "quantity": 2,
--             "item_id": 34 (optional: the line being kept when editing) }]
-- A kept line (same item_id, product, size and colour) keeps the price it was sold at;
-- any other line is priced from the product now. Old stock is put back and new stock taken
-- in the same transaction, so an edit only moves stock by the difference.
create or replace function public.offline_sale_save(
  p_sale_id bigint, p_buyer_name text, p_order_period_id bigint, p_note text, p_items jsonb)
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
begin
  if not is_admin() then
    raise exception 'Only admins can record offline sales' using errcode = '42501';
  end if;
  if coalesce(btrim(p_buyer_name), '') = '' then
    raise exception 'Enter the buyer''s name.' using errcode = '22023';
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

  return v_sale_id;
end;
$$;

-- ── Cancel / delete ──────────────────────────────────────────────────────────
create or replace function public.offline_sale_cancel(p_sale_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s offline_sales;
  line offline_sale_items;
begin
  if not is_admin() then
    raise exception 'Only admins can cancel offline sales' using errcode = '42501';
  end if;
  select * into s from offline_sales where id = p_sale_id for update;
  if not found then
    raise exception 'This sale no longer exists.' using errcode = 'P0002';
  end if;
  if s.status = 'Cancelled' then
    raise exception 'This sale has already been cancelled.' using errcode = 'P0001';
  end if;
  for line in select * from offline_sale_items where sale_id = p_sale_id loop
    if line.product_type = 'Available' and line.product_id is not null then
      perform offline_stock_release(line.product_id, line.size, line.colour, line.quantity);
    end if;
  end loop;
  update offline_sales set status = 'Cancelled', cancelled_at = now(), updated_at = now() where id = p_sale_id;
end;
$$;

create or replace function public.offline_sale_delete(p_sale_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s offline_sales;
  line offline_sale_items;
begin
  if not is_admin() then
    raise exception 'Only admins can delete offline sales' using errcode = '42501';
  end if;
  select * into s from offline_sales where id = p_sale_id for update;
  if not found then
    raise exception 'This sale no longer exists.' using errcode = 'P0002';
  end if;
  if s.status = 'Active' then  -- a cancelled sale's stock was already put back
    for line in select * from offline_sale_items where sale_id = p_sale_id loop
      if line.product_type = 'Available' and line.product_id is not null then
        perform offline_stock_release(line.product_id, line.size, line.colour, line.quantity);
      end if;
    end loop;
  end if;
  delete from offline_sales where id = p_sale_id;
end;
$$;

revoke all on function public.offline_sale_price(bigint, text) from public, anon, authenticated;
revoke all on function public.offline_stock_take(bigint, text, text, integer) from public, anon, authenticated;
revoke all on function public.offline_stock_release(bigint, text, text, integer) from public, anon, authenticated;
revoke all on function public.offline_sale_save(bigint, text, bigint, text, jsonb) from public, anon;
revoke all on function public.offline_sale_cancel(bigint) from public, anon;
revoke all on function public.offline_sale_delete(bigint) from public, anon;
grant execute on function public.offline_sale_save(bigint, text, bigint, text, jsonb) to authenticated;
grant execute on function public.offline_sale_cancel(bigint) to authenticated;
grant execute on function public.offline_sale_delete(bigint) to authenticated;
