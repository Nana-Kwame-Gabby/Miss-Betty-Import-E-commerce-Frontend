CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  link_url    TEXT,
  type        TEXT        NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'new_product')),
  product_id  INTEGER     REFERENCES products(product_id) ON DELETE SET NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_notifications"
  ON notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_all_notifications"
  ON notifications FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE TABLE IF NOT EXISTS notification_reads (
  id               BIGSERIAL PRIMARY KEY,
  notification_id  BIGINT      NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  customer_id      INTEGER     NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  read_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_reads_customer     ON notification_reads (customer_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON notification_reads (notification_id);
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_own_reads"
  ON notification_reads FOR SELECT TO authenticated
  USING (customer_id = (SELECT customer_id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "customers_insert_own_reads"
  ON notification_reads FOR INSERT TO authenticated
  WITH CHECK (customer_id = (SELECT customer_id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "customers_delete_own_reads"
  ON notification_reads FOR DELETE TO authenticated
  USING (customer_id = (SELECT customer_id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "admin_select_all_reads"
  ON notification_reads FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
