CREATE TABLE IF NOT EXISTS individual_sms_logs (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name TEXT        NOT NULL,
  phone         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'sent',
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE individual_sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_individual_sms_logs"
  ON individual_sms_logs FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_individual_sms_logs"
  ON individual_sms_logs FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
