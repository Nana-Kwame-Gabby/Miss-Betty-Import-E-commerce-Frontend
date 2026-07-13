-- One-time backfill: auto-confirm legacy accounts that signed up before
-- mandatory email confirmation was disabled, so they can log in immediately.
-- Safe/idempotent: only touches rows that are still unconfirmed.
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
