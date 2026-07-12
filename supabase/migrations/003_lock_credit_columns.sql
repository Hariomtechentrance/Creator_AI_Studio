-- The original "Users can update own profile" RLS policy (auth.uid() = id)
-- has no column restriction, so any signed-in user could update their own
-- credits/plan/stripe ids directly via the anon key (e.g. from the browser
-- console). Restrict self-service updates to genuinely self-editable fields;
-- credits/plan/stripe ids must only change via the service-role client.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
