-- Focus Up: core tables for version 1.
--
-- Conventions
--   * Money is stored as whole cents (integer). $12.50 is saved as 1250.
--   * Every per-user table has a user_id that defaults to the signed-in user,
--     so the app never has to send it, and row-level security (RLS) limits
--     every read and write to the owner's own rows.
--   * The nine category "umbrellas" are shared, read-only rows.

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at current on every edit
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per user, created automatically at sign-up
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- The monthly amount the user sets for "left to spend". Null until they set it.
  monthly_amount_cents integer check (monthly_amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile row the moment a new auth user appears.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- categories: the nine fixed umbrellas, shared by every user, read-only
-- ---------------------------------------------------------------------------
create table public.categories (
  id smallint primary key,
  name text not null unique,
  sort_order smallint not null unique
);

insert into public.categories (id, name, sort_order) values
  (1, 'Home & Bills',     1),
  (2, 'Food',             2),
  (3, 'Transportation',   3),
  (4, 'Shopping',         4),
  (5, 'Health',           5),
  (6, 'Entertainment',    6),
  (7, 'Education',        7),
  (8, 'Savings & Debt',   8),
  (9, 'Other',            9);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  merchant text not null check (length(btrim(merchant)) > 0),
  spent_on date not null default current_date,
  -- Null means "not sorted yet": the user can skip sorting and come back later.
  category_id smallint references public.categories (id),
  -- Optional free-text detail, in place of fixed subcategories.
  detail text,
  is_recurring boolean not null default false,
  -- Did the user pick this category, or did a saved merchant rule apply it?
  category_source text check (category_source in ('user', 'rule')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A category and its source always go together.
  check ((category_id is null) = (category_source is null))
);

create index expenses_user_spent_on_idx on public.expenses (user_id, spent_on desc);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- merchant_rules: "sort once, remember after"
-- ---------------------------------------------------------------------------
create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merchant text not null check (length(btrim(merchant)) > 0),
  category_id smallint not null references public.categories (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One rule per merchant per user, ignoring case and stray spaces.
create unique index merchant_rules_user_merchant_idx
  on public.merchant_rules (user_id, lower(btrim(merchant)));

create trigger merchant_rules_set_updated_at
  before update on public.merchant_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- type_rules: onboarding shortcuts ("coffee" -> Food), offered when sorting
-- ---------------------------------------------------------------------------
create table public.type_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spending_type text not null check (length(btrim(spending_type)) > 0),
  category_id smallint not null references public.categories (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index type_rules_user_type_idx
  on public.type_rules (user_id, lower(btrim(spending_type)));

create trigger type_rules_set_updated_at
  before update on public.type_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  amount_cents integer not null check (amount_cents > 0),
  -- The next date this bill is due. For repeating bills the app moves this
  -- forward when the bill is marked paid.
  due_on date not null,
  repeats text not null default 'none'
    check (repeats in ('none', 'weekly', 'monthly', 'yearly')),
  -- When the current due date was paid. Null means not paid yet.
  paid_on date,
  -- How many days before the due date to send a reminder.
  remind_days_before smallint not null default 1 check (remind_days_before between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bills_user_due_on_idx on public.bills (user_id, due_on);

create trigger bills_set_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: each user can only touch their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.expenses       enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.type_rules     enable row level security;
alter table public.bills          enable row level security;

-- Profiles are created by the sign-up trigger, so the app only reads and edits.
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Categories: signed-in users can read them; there is no write policy, so no one can change them.
create policy "Signed-in users can read categories"
  on public.categories for select to authenticated
  using (true);

-- Per-user tables: full access to your own rows, nothing else.
create policy "Users manage their own expenses"
  on public.expenses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own merchant rules"
  on public.merchant_rules for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own type rules"
  on public.type_rules for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own bills"
  on public.bills for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
