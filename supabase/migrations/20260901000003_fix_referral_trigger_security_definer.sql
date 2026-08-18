-- Root cause of "referral not recorded / coupon not awarded": these two trigger
-- functions ran with the privileges of the INVOKER (the newly-signing-up customer's
-- own RLS-restricted session), not elevated privileges. Since customers has RLS that
-- restricts a customer to seeing only their own row, process_customer_referral()'s
-- lookup of the REFERRER's row (a different customer entirely) was silently filtered
-- to zero rows by RLS — no error, just a quiet no-op. Same class of issue already
-- documented in 20260710120000_restrict_google_signup_to_existing_customers.sql; this
-- applies the identical fix (SECURITY DEFINER) to both functions here.

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION process_customer_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Retroactively process every referral that should already have been recorded —
-- any customer whose referred_by_code never turned into a referrals row because of
-- the bug above. Safe to re-run: only touches rows not already reflected in referrals.
DO $$
DECLARE
  r RECORD;
  v_referrer_id integer;
  v_referral_id bigint;
BEGIN
  FOR r IN
    SELECT customer_id, referred_by_code FROM customers
    WHERE referred_by_code IS NOT NULL
      AND customer_id NOT IN (SELECT referred_customer_id FROM referrals)
  LOOP
    SELECT customer_id INTO v_referrer_id FROM customers WHERE referral_code = r.referred_by_code;
    IF v_referrer_id IS NOT NULL AND v_referrer_id <> r.customer_id THEN
      INSERT INTO referrals (referrer_customer_id, referred_customer_id, referral_code_used)
      VALUES (v_referrer_id, r.customer_id, r.referred_by_code)
      ON CONFLICT (referred_customer_id) DO NOTHING
      RETURNING id INTO v_referral_id;

      IF v_referral_id IS NOT NULL THEN
        INSERT INTO coupons (customer_id, amount, source, referral_id)
        VALUES (v_referrer_id, 100, 'referral', v_referral_id);
      END IF;
    END IF;
  END LOOP;
END $$;
