CREATE TABLE countdown_timers (
  id bigint generated always as identity primary key,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT countdown_end_after_start CHECK (end_at > start_at)
);

ALTER TABLE countdown_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read countdown_timers" ON countdown_timers
  FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated_select_countdown_timers" ON countdown_timers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_all_countdown_timers" ON countdown_timers
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION enforce_single_active_countdown() RETURNS trigger AS $$
BEGIN
  UPDATE countdown_timers SET is_active = false WHERE id != NEW.id AND is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_enforce_single_active_countdown
AFTER INSERT OR UPDATE OF is_active ON countdown_timers
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION enforce_single_active_countdown();

CREATE OR REPLACE FUNCTION get_server_time() RETURNS timestamptz AS $$
  SELECT now();
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_server_time() TO anon, authenticated;
