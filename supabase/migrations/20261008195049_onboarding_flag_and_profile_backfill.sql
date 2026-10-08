-- Remember whether a user has finished (or skipped) onboarding, so it only shows once.
alter table public.profiles
  add column onboarding_completed_at timestamptz;

-- Accounts created before the sign-up trigger existed have no profile row. Give them one.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
