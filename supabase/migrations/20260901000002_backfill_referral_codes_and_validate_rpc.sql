-- One-time backfill: assign a referral_code to every customer created before the
-- referral system existed. Processes rows one at a time (not a single bulk UPDATE)
-- so each row's uniqueness check inside generate_referral_code() sees every code
-- already assigned earlier in this same run. Safe to re-run — finds nothing once done.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT customer_id FROM customers WHERE referral_code IS NULL LOOP
    UPDATE customers SET referral_code = generate_referral_code() WHERE customer_id = r.customer_id;
  END LOOP;
END $$;

-- Public "does this referral code exist" check, callable by a signed-out visitor on
-- the sign-up page. Returns only a boolean — no customer data is exposed.
CREATE OR REPLACE FUNCTION validate_referral_code(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM customers WHERE referral_code = p_code);
$$;

GRANT EXECUTE ON FUNCTION validate_referral_code(text) TO anon, authenticated;
