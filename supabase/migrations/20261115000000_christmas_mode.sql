-- Christmas Animations: one central switch (plus the banner wording) that the admin controls
-- and every customer page follows live through the app_settings realtime feed.
insert into public.app_settings (setting_key, setting_value_bool, setting_value_text, updated_at)
select 'christmas_mode', false,
       '{"headline":"Merry Christmas from Miss Betty Import","message":"Gifts for everyone you love, delivered across Ghana."}',
       now()
where not exists (select 1 from public.app_settings where setting_key = 'christmas_mode');

-- Only admins may change shop-wide settings (pre-orders closed, promo alert, Christmas mode).
-- Previously any signed-in customer could update these rows.
drop policy if exists "authenticated users can update app_settings" on public.app_settings;
drop policy if exists "admins can update app_settings" on public.app_settings;
create policy "admins can update app_settings" on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
