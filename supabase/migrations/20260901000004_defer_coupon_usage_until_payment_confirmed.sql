-- A coupon was being marked 'used' the moment it was claimed at checkout submission —
-- before Hubtel was even contacted. If the customer then cancelled/failed the payment
-- via Hubtel's own UI (not our Cancel button), nothing ever released it: coupon lost
-- for a payment that never happened. This introduces a 'reserved' state so a coupon
-- is only truly spent once the associated order is confirmed to exist.

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_status_check;
ALTER TABLE coupons ADD CONSTRAINT coupons_status_check CHECK (status IN ('available', 'reserved', 'used'));
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

CREATE OR REPLACE FUNCTION claim_coupon(p_customer_id integer, p_order_id text, p_order_total numeric)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon_id bigint;
BEGIN
  IF p_order_total <= 3000 THEN
    RETURN NULL;
  END IF;

  -- Self-heal: release this customer's own abandoned reservations. 30 minutes is
  -- double CheckoutPage.jsx's own PAYMENT_RESUME_TTL_MS (15 min), so this never
  -- races an attempt the client might still legitimately resume.
  UPDATE coupons
  SET status = 'available', used_order_id = NULL, reserved_at = NULL
  WHERE customer_id = p_customer_id
    AND status = 'reserved'
    AND reserved_at < now() - interval '30 minutes';

  SELECT id INTO v_coupon_id
  FROM coupons
  WHERE customer_id = p_customer_id AND status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_coupon_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Reserve, don't spend yet — only confirm_coupon_usage() (called once the order
  -- is actually created, i.e. Hubtel confirmed payment) turns this into 'used'.
  UPDATE coupons
  SET status = 'reserved', used_order_id = p_order_id, reserved_at = now(), used_at = NULL
  WHERE id = v_coupon_id;

  RETURN v_coupon_id;
END;
$$;

CREATE OR REPLACE FUNCTION release_coupon(p_coupon_id bigint, p_customer_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coupons
  SET status = 'available', used_order_id = NULL, reserved_at = NULL
  WHERE id = p_coupon_id AND customer_id = p_customer_id AND status = 'reserved';
END;
$$;

CREATE OR REPLACE FUNCTION confirm_coupon_usage(p_coupon_id bigint, p_order_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coupons
  SET status = 'used', used_at = now()
  WHERE id = p_coupon_id AND used_order_id = p_order_id AND status = 'reserved';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_coupon_usage(bigint, text) TO authenticated;

-- Retroactively repair coupons wrongly burned by the old claim-at-submit-time bug:
-- 'used' with no matching order means the payment never actually completed.
UPDATE coupons
SET status = 'available', used_order_id = NULL, used_at = NULL, reserved_at = NULL
WHERE status = 'used'
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = coupons.used_order_id);
