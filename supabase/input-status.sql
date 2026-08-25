-- Run once in the Supabase SQL editor (existing projects).

alter table public.purchases
  add column if not exists input_status text not null default 'waiting';

alter table public.purchases
  add column if not exists input_on date;

create index if not exists purchases_input_status_idx
  on public.purchases (user_id, input_status);
