-- Before User Created Auth Hook: prevent brand-new Google sign-ins from ever
-- creating an auth.users row unless the email already has a customers row
-- (i.e. the person previously signed up through the normal email/password form).
--
-- This function is invoked by Supabase Auth (role supabase_auth_admin) via the
-- "Before User Created" hook. Wiring the hook itself requires a manual step in
-- the Supabase Dashboard (Authentication > Hooks (Beta) > Before User Created)
-- that cannot be done via SQL/migrations.
--
-- SECURITY DEFINER is required: public.customers has RLS enabled and
-- supabase_auth_admin does NOT have BYPASSRLS, so an invoker-rights function
-- would see zero rows for every email and reject ALL Google sign-ins. Running
-- as the function owner (postgres, which owns public.customers and has
-- BYPASSRLS) is what makes the customers lookup actually work.
create or replace function public.restrict_google_signup_to_existing_customers(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_provider text;
  claimed_email text;
  match_count int;
begin
  claimed_provider := event -> 'user' -> 'app_metadata' ->> 'provider';
  claimed_email := lower(trim(event -> 'user' ->> 'email'));

  -- Only restrict Google sign-ins. Email/password signups and any other
  -- provider are untouched.
  if claimed_provider = 'google' and claimed_email is not null then
    select count(*) into match_count
    from public.customers
    where lower(trim(email)) = claimed_email;

    if match_count = 0 then
      return jsonb_build_object(
        'error', jsonb_build_object(
          'message', 'MBI_NO_CUSTOMER_ACCOUNT: No existing account found for this Google email. Please sign up first.',
          'http_code', 403
        )
      );
    end if;
  end if;

  return '{}'::jsonb;
end;
$$;

comment on function public.restrict_google_signup_to_existing_customers(jsonb) is
  'Before User Created Auth Hook. Rejects new Google OAuth sign-ins whose email has no matching public.customers row, preventing an auth.users row from ever being created for them. Wired via Dashboard > Authentication > Hooks (Beta) > Before User Created.';

revoke execute on function public.restrict_google_signup_to_existing_customers(jsonb) from public, anon, authenticated;
grant execute on function public.restrict_google_signup_to_existing_customers(jsonb) to supabase_auth_admin;
