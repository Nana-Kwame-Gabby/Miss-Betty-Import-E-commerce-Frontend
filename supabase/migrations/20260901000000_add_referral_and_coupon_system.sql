-- Referral codes on customers -------------------------------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by_code text;

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I, avoids ambiguity when shared
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM customers WHERE referral_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION set_customer_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_customer_referral_code ON customers;
CREATE TRIGGER trg_set_customer_referral_code
BEFORE INSERT ON customers
FOR EACH ROW EXECUTE FUNCTION set_customer_referral_code();

-- Referrals ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id bigserial PRIMARY KEY,
  referrer_customer_id integer NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  referred_customer_id integer NOT NULL UNIQUE REFERENCES customers(customer_id) ON DELETE CASCADE,
  referral_code_used text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_referral CHECK (referrer_customer_id <> referred_customer_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_own_referrals" ON referrals FOR SELECT TO authenticated
  USING (referrer_customer_id = (SELECT customer_id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "admin_all_referrals" ON referrals FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Coupons -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id bigserial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 100,
  source text NOT NULL DEFAULT 'referral',
  referral_id bigint REFERENCES referrals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used')),
  used_order_id text, -- correlates to orders.order_id (a grouping key, not unique, so no FK)
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_own_coupons" ON coupons FOR SELECT TO authenticated
  USING (customer_id = (SELECT customer_id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "admin_all_coupons" ON coupons FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Award the referrer a coupon once a referred signup completes ------------------
CREATE OR REPLACE FUNCTION process_customer_referral()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_referrer_id integer;
  v_referral_id bigint;
BEGIN
  IF NEW.referred_by_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT customer_id INTO v_referrer_id
  FROM customers
  WHERE referral_code = NEW.referred_by_code;

  IF v_referrer_id IS NULL OR v_referrer_id = NEW.customer_id THEN
    RETURN NEW; -- invalid/unknown code, or (defensively) a self-referral
  END IF;

  INSERT INTO referrals (referrer_customer_id, referred_customer_id, referral_code_used)
  VALUES (v_referrer_id, NEW.customer_id, NEW.referred_by_code)
  ON CONFLICT (referred_customer_id) DO NOTHING
  RETURNING id INTO v_referral_id;

  IF v_referral_id IS NOT NULL THEN
    INSERT INTO coupons (customer_id, amount, source, referral_id)
    VALUES (v_referrer_id, 100, 'referral', v_referral_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_customer_referral ON customers;
CREATE TRIGGER trg_process_customer_referral
AFTER INSERT ON customers
FOR EACH ROW EXECUTE FUNCTION process_customer_referral();

-- Coupon usage tracking on pending_orders ----------------------------------------
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS coupon_id bigint REFERENCES coupons(id);
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;

-- Atomic coupon claim/release ------------------------------------------------------
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

  SELECT id INTO v_coupon_id
  FROM coupons
  WHERE customer_id = p_customer_id AND status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_coupon_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE coupons SET status = 'used', used_order_id = p_order_id, used_at = now()
  WHERE id = v_coupon_id;

  RETURN v_coupon_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_coupon(integer, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION release_coupon(p_coupon_id bigint, p_customer_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coupons
  SET status = 'available', used_order_id = NULL, used_at = NULL
  WHERE id = p_coupon_id AND customer_id = p_customer_id AND status = 'used';
END;
$$;

GRANT EXECUTE ON FUNCTION release_coupon(bigint, integer) TO authenticated;
