-- Database tests: security rules and constraints, run against the linked Supabase project.
--
-- Everything runs inside one block that ends by raising 'ALL_CHECKS_PASSED', which rolls the whole
-- thing back, so no test data is ever left behind. A failed check raises 'FAIL <what failed>' instead.
-- Run with: npm run test:db
--
-- Add new checks above the final RAISE, and keep each one small: set up, try the thing, assert.

do $$
declare
  alice uuid := gen_random_uuid();
  bob   uuid := gen_random_uuid();
  n int;
  after_ts  timestamptz;

  -- Pretend to be a signed-in user (or nobody) for the checks that follow.
  -- Done with a helper so each test reads as "as alice, do X".
begin
  -- ---------------------------------------------------------------------------------------------
  -- Setup (as the admin): two users. The sign-up trigger should give each a profile.
  -- ---------------------------------------------------------------------------------------------
  insert into auth.users (id, aud, role, email) values
    (alice, 'authenticated', 'authenticated', 'alice@example.test'),
    (bob,   'authenticated', 'authenticated', 'bob@example.test');

  select count(*) into n from public.profiles where id in (alice, bob);
  if n <> 2 then raise exception 'FAIL sign-up trigger should create a profile for each new user, got %', n; end if;

  select count(*) into n from public.categories;
  if n <> 9 then raise exception 'FAIL expected the nine umbrellas, got %', n; end if;

  -- ---------------------------------------------------------------------------------------------
  -- As Alice
  -- ---------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Her own data works, and user_id fills itself in from her session.
  insert into public.expenses (amount_cents, merchant, spent_on, category_id, category_source)
    values (1250, 'Test Cafe', '2026-10-08', 2, 'rule');
  insert into public.expenses (amount_cents, merchant) values (500, 'Unsorted Shop');  -- no category is fine
  insert into public.merchant_rules (merchant, category_id) values ('Trader Joe''s', 2);
  insert into public.type_rules (spending_type, category_id) values ('Coffee', 2);
  insert into public.bills (name, amount_cents, due_on) values ('Rent', 120000, '2026-11-01');
  update public.profiles set monthly_amount_cents = 200000 where id = alice;

  select count(*) into n from public.expenses;
  if n <> 2 then raise exception 'FAIL alice should see her 2 expenses, got %', n; end if;

  -- Bad data is refused.
  begin insert into public.expenses (amount_cents, merchant) values (0, 'x');
    raise exception 'FAIL a zero amount was accepted';
  exception when check_violation then null; end;

  begin insert into public.expenses (amount_cents, merchant) values (-5, 'x');
    raise exception 'FAIL a negative amount was accepted';
  exception when check_violation then null; end;

  begin insert into public.expenses (amount_cents, merchant) values (100, '   ');
    raise exception 'FAIL a blank merchant was accepted';
  exception when check_violation then null; end;

  begin insert into public.expenses (amount_cents, merchant, category_id) values (5, 'x', 2);
    raise exception 'FAIL a category with no source was accepted';
  exception when check_violation then null; end;

  begin insert into public.expenses (amount_cents, merchant, category_source) values (5, 'x', 'user');
    raise exception 'FAIL a source with no category was accepted';
  exception when check_violation then null; end;

  begin insert into public.expenses (amount_cents, merchant, category_id, category_source) values (5, 'x', 99, 'user');
    raise exception 'FAIL an unknown category was accepted';
  exception when foreign_key_violation then null; end;

  begin insert into public.expenses (amount_cents, merchant, category_id, category_source) values (5, 'x', 2, 'robot');
    raise exception 'FAIL an unknown category source was accepted';
  exception when check_violation then null; end;

  begin update public.profiles set monthly_amount_cents = -1 where id = alice;
    raise exception 'FAIL a negative monthly amount was accepted';
  exception when check_violation then null; end;

  -- Merchants and spending types are remembered once each, ignoring case and stray spaces.
  begin insert into public.merchant_rules (merchant, category_id) values ('  trader joe''s ', 4);
    raise exception 'FAIL a duplicate merchant rule was accepted';
  exception when unique_violation then null; end;

  begin insert into public.type_rules (spending_type, category_id) values ('COFFEE', 4);
    raise exception 'FAIL a duplicate type rule was accepted';
  exception when unique_violation then null; end;

  -- Bills.
  begin insert into public.bills (name, amount_cents, due_on, repeats) values ('x', 100, '2026-11-01', 'daily');
    raise exception 'FAIL an unknown repeat option was accepted';
  exception when check_violation then null; end;

  begin insert into public.bills (name, amount_cents, due_on) values ('x', 0, '2026-11-01');
    raise exception 'FAIL a zero bill amount was accepted';
  exception when check_violation then null; end;

  begin insert into public.bills (name, amount_cents, due_on, remind_days_before) values ('x', 100, '2026-11-01', 31);
    raise exception 'FAIL a 31-day reminder was accepted';
  exception when check_violation then null; end;

  -- The umbrellas are shared and read-only.
  select count(*) into n from public.categories;
  if n <> 9 then raise exception 'FAIL alice should be able to read the 9 umbrellas, got %', n; end if;

  update public.categories set name = 'Hacked' where id = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL an umbrella was renamed by a user'; end if;

  delete from public.categories where id = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL an umbrella was deleted by a user'; end if;

  begin insert into public.categories (id, name, sort_order) values (10, 'Extra', 10);
    raise exception 'FAIL a user added an umbrella';
  exception when insufficient_privilege then null; end;

  -- She cannot write rows that belong to someone else.
  begin insert into public.expenses (user_id, amount_cents, merchant) values (bob, 5, 'x');
    raise exception 'FAIL alice wrote an expense as bob';
  exception when insufficient_privilege then null; end;

  -- Profiles are created by the sign-up trigger, never by the app.
  begin insert into public.profiles (id) values (gen_random_uuid());
    raise exception 'FAIL a user inserted a profile';
  exception when insufficient_privilege then null; end;

  -- Editing a row refreshes updated_at. (Inside one transaction now() is frozen, so the row starts
  -- with an old timestamp and the edit must move it forward.)
  insert into public.expenses (amount_cents, merchant, updated_at) values (100, 'Old Row', '2000-01-01');
  update public.expenses set detail = 'edited' where merchant = 'Old Row';
  select updated_at into after_ts from public.expenses where merchant = 'Old Row';
  if after_ts <= '2000-01-02'::timestamptz then raise exception 'FAIL updated_at did not change on edit'; end if;

  -- ---------------------------------------------------------------------------------------------
  -- As Bob: he sees none of Alice's data, and cannot touch it.
  -- ---------------------------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', bob, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.expenses;       if n <> 0 then raise exception 'FAIL bob can see % of alice''s expenses', n; end if;
  select count(*) into n from public.merchant_rules; if n <> 0 then raise exception 'FAIL bob can see alice''s merchant rules'; end if;
  select count(*) into n from public.type_rules;     if n <> 0 then raise exception 'FAIL bob can see alice''s type rules'; end if;
  select count(*) into n from public.bills;          if n <> 0 then raise exception 'FAIL bob can see alice''s bills'; end if;
  select count(*) into n from public.profiles;       if n <> 1 then raise exception 'FAIL bob should see only his own profile, got %', n; end if;

  update public.expenses set amount_cents = 1 where merchant = 'Test Cafe';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL bob edited alice''s expense'; end if;

  delete from public.expenses;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL bob deleted alice''s expenses'; end if;

  update public.profiles set monthly_amount_cents = 1 where id = alice;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL bob changed alice''s monthly amount'; end if;

  -- ---------------------------------------------------------------------------------------------
  -- Signed out: nothing is visible at all.
  -- ---------------------------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  select count(*) into n from public.expenses;   if n <> 0 then raise exception 'FAIL signed-out visitors can see expenses'; end if;
  select count(*) into n from public.profiles;   if n <> 0 then raise exception 'FAIL signed-out visitors can see profiles'; end if;
  select count(*) into n from public.categories; if n <> 0 then raise exception 'FAIL signed-out visitors can see umbrellas'; end if;

  begin insert into public.expenses (user_id, amount_cents, merchant) values (alice, 5, 'x');
    raise exception 'FAIL a signed-out visitor wrote an expense';
  exception when insufficient_privilege then null; end;

  -- ---------------------------------------------------------------------------------------------
  -- Deleting a user removes all of their data.
  -- ---------------------------------------------------------------------------------------------
  reset role;
  delete from auth.users where id = alice;
  select count(*) into n from (
    select 1 from public.expenses where user_id = alice
    union all select 1 from public.merchant_rules where user_id = alice
    union all select 1 from public.type_rules where user_id = alice
    union all select 1 from public.bills where user_id = alice
    union all select 1 from public.profiles where id = alice
  ) leftovers;
  if n <> 0 then raise exception 'FAIL deleting a user left % rows behind', n; end if;

  raise exception 'ALL_CHECKS_PASSED (rolled back, nothing was saved)';
end $$;
