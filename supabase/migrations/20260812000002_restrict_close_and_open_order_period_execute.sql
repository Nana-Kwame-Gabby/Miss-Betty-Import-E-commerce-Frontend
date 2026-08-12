-- close_and_open_order_period is SECURITY DEFINER and mutates real order-period
-- state; the security advisor flagged it as reachable by unauthenticated (anon)
-- requests via the public RPC endpoint. The function already rejects non-admins
-- internally via is_admin(), but revoke at the grant level too so anon can't
-- reach it at all.
REVOKE EXECUTE ON FUNCTION public.close_and_open_order_period(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_and_open_order_period(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.close_and_open_order_period(text) TO authenticated;
