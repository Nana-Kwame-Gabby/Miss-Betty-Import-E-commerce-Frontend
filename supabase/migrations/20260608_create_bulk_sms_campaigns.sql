CREATE TABLE IF NOT EXISTS bulk_sms_campaigns (
  id              BIGSERIAL PRIMARY KEY,
  message         TEXT        NOT NULL,
  recipient_count INTEGER     NOT NULL DEFAULT 0,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT        NOT NULL DEFAULT 'sent'
);
