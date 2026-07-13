-- Insert the promo_alert row into app_settings if it doesn't already exist.
-- This row is managed via UPDATE in the application; we seed it here so that
-- the admin client (which only has UPDATE permission) can always persist changes.
INSERT INTO app_settings (setting_key, setting_value_bool, setting_value_text, updated_at)
SELECT 'promo_alert', false, null, now()
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'promo_alert'
);
