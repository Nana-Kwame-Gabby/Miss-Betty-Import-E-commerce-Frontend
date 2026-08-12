-- ── order_periods ────────────────────────────────────────────────────────
CREATE TABLE public.order_periods (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  opened_at  timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_order_periods" ON public.order_periods
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.enforce_single_active_order_period() RETURNS trigger AS $$
BEGIN
  UPDATE public.order_periods
  SET is_active = false, closed_at = COALESCE(closed_at, now())
  WHERE id != NEW.id AND is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_enforce_single_active_order_period
AFTER INSERT OR UPDATE OF is_active ON public.order_periods
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.enforce_single_active_order_period();

-- Seed the Legacy period as active — preserves current behavior exactly:
-- every pre-existing row lands here.
INSERT INTO public.order_periods (name, is_active, opened_at)
VALUES ('Legacy', true, now());

-- ── order_period_id columns ──────────────────────────────────────────────
ALTER TABLE public.orders                     ADD COLUMN order_period_id bigint REFERENCES public.order_periods(id);
ALTER TABLE public.invoices                   ADD COLUMN order_period_id bigint REFERENCES public.order_periods(id);
ALTER TABLE public.product_size_shipping_fees ADD COLUMN order_period_id bigint REFERENCES public.order_periods(id);
ALTER TABLE public.shipping_fee_payments      ADD COLUMN order_period_id bigint REFERENCES public.order_periods(id);

-- ── Backfill: every existing row → Legacy, no other column touched ──────
UPDATE public.orders                     SET order_period_id = (SELECT id FROM public.order_periods WHERE name = 'Legacy') WHERE order_period_id IS NULL;
UPDATE public.invoices                   SET order_period_id = (SELECT id FROM public.order_periods WHERE name = 'Legacy') WHERE order_period_id IS NULL;
UPDATE public.product_size_shipping_fees SET order_period_id = (SELECT id FROM public.order_periods WHERE name = 'Legacy') WHERE order_period_id IS NULL;
UPDATE public.shipping_fee_payments      SET order_period_id = (SELECT id FROM public.order_periods WHERE name = 'Legacy') WHERE order_period_id IS NULL;

-- ── Required going forward ───────────────────────────────────────────────
ALTER TABLE public.orders                     ALTER COLUMN order_period_id SET NOT NULL;
ALTER TABLE public.invoices                   ALTER COLUMN order_period_id SET NOT NULL;
ALTER TABLE public.product_size_shipping_fees ALTER COLUMN order_period_id SET NOT NULL;
-- shipping_fee_payments.order_period_id stays nullable (payment ledger, not an editable business record).

-- ── Restructure product_size_shipping_fees uniqueness ───────────────────
ALTER TABLE public.product_size_shipping_fees
  DROP CONSTRAINT product_size_shipping_fees_product_id_size_key;
ALTER TABLE public.product_size_shipping_fees
  ADD CONSTRAINT product_size_shipping_fees_period_product_size_key
  UNIQUE (order_period_id, product_id, size);

-- ── Indexes for the new per-page period filters ──────────────────────────
CREATE INDEX idx_orders_order_period_id   ON public.orders (order_period_id);
CREATE INDEX idx_invoices_order_period_id ON public.invoices (order_period_id);
CREATE INDEX idx_fees_order_period_id     ON public.product_size_shipping_fees (order_period_id);

-- ── Atomic "close active period / open new one" RPC ─────────────────────
CREATE OR REPLACE FUNCTION public.close_and_open_order_period(new_period_name text)
RETURNS public.order_periods
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_row public.order_periods;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins may close/open order periods';
  END IF;

  UPDATE public.order_periods SET is_active = false, closed_at = now() WHERE is_active = true;

  INSERT INTO public.order_periods (name, is_active, opened_at)
  VALUES (new_period_name, true, now())
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_and_open_order_period(text) TO authenticated;
