-- Run this once in the Supabase SQL editor (existing projects).
-- New installs can use schema.sql instead.

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

create index if not exists suppliers_user_name_idx
  on public.suppliers (user_id, name);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_own" on public.suppliers;
create policy "suppliers_own" on public.suppliers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists suppliers_touch on public.suppliers;
create trigger suppliers_touch
  before update on public.suppliers
  for each row execute procedure public.touch_updated_at();

alter table public.purchases
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists purchases_supplier_id_idx
  on public.purchases (supplier_id);

insert into public.suppliers (user_id, name, gstin)
select
  user_id,
  min(trim(supplier_name)),
  upper(trim(supplier_gstin))
from public.purchases
where supplier_gstin is not null and length(trim(supplier_gstin)) > 0
group by user_id, upper(trim(supplier_gstin))
on conflict do nothing;

insert into public.suppliers (user_id, name, gstin)
select
  user_id,
  min(trim(supplier_name)),
  null
from public.purchases
where (supplier_gstin is null or length(trim(supplier_gstin)) = 0)
  and trim(supplier_name) <> ''
group by user_id, lower(trim(supplier_name))
on conflict do nothing;

update public.purchases p
set supplier_id = s.id
from public.suppliers s
where p.supplier_id is null
  and p.user_id = s.user_id
  and s.gstin is not null
  and upper(trim(coalesce(p.supplier_gstin, ''))) = s.gstin;

update public.purchases p
set supplier_id = s.id
from public.suppliers s
where p.supplier_id is null
  and p.user_id = s.user_id
  and s.gstin is null
  and lower(trim(p.supplier_name)) = lower(s.name);
