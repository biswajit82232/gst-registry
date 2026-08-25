-- Current live schema (fresh installs). Existing projects should mark this
-- migration applied, then push tax_lines_and_checks.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  business_name text,
  gstin text,
  state_code text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  invoice_date date not null,
  invoice_number text not null,
  supplier_name text not null,
  supplier_gstin text,
  purchased_by text,
  category text not null default 'goods' check (category in ('goods', 'services', 'capital')),
  hsn_sac text,
  taxable_value numeric(14, 2) not null default 0,
  gst_rate numeric(5, 2) not null default 18,
  tax_type text not null default 'intra' check (tax_type in ('intra', 'inter')),
  cgst numeric(14, 2) not null default 0,
  sgst numeric(14, 2) not null default 0,
  igst numeric(14, 2) not null default 0,
  cess numeric(14, 2) not null default 0,
  invoice_total numeric(14, 2) not null default 0,
  itc_eligible boolean not null default true,
  reverse_charge boolean not null default false,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'unpaid')),
  payment_date date,
  place_of_supply text,
  notes text,
  input_status text not null default 'waiting',
  input_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  gstin text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_user_gstin_uidx
  on public.suppliers (user_id, gstin)
  where gstin is not null and length(trim(gstin)) > 0;

create unique index if not exists suppliers_user_name_uidx
  on public.suppliers (user_id, lower(trim(name)))
  where gstin is null or length(trim(gstin)) = 0;

create index if not exists purchases_user_date_idx
  on public.purchases (user_id, invoice_date desc);

create index if not exists purchases_user_updated_idx
  on public.purchases (user_id, updated_at);

create index if not exists suppliers_user_updated_idx
  on public.suppliers (user_id, updated_at);

create index if not exists purchases_user_supplier_idx
  on public.purchases (user_id, supplier_name);

alter table public.purchases
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists purchases_supplier_id_idx
  on public.purchases (supplier_id);

create index if not exists purchases_input_status_idx
  on public.purchases (user_id, input_status);

alter table public.profiles enable row level security;
alter table public.purchases enable row level security;
alter table public.suppliers enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "purchases_own" on public.purchases;
create policy "purchases_own" on public.purchases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "suppliers_own" on public.suppliers;
create policy "suppliers_own" on public.suppliers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists purchases_touch on public.purchases;
create trigger purchases_touch
  before update on public.purchases
  for each row execute procedure public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists suppliers_touch on public.suppliers;
create trigger suppliers_touch
  before update on public.suppliers
  for each row execute procedure public.touch_updated_at();
