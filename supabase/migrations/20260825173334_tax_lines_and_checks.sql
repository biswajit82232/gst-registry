-- Line items, tax-head repair, constraints, and private handle_new_user.

alter table public.purchases
  add column if not exists lines jsonb not null default '[]'::jsonb;

do $$
declare
  rec record;
  raw text;
  parsed jsonb;
  items jsonb;
  extra text;
  mapped jsonb;
begin
  for rec in
    select id, notes, taxable_value, gst_rate
    from public.purchases
    where lines = '[]'::jsonb
  loop
    extra := null;
    mapped := null;
    raw := coalesce(rec.notes, '');
    if raw like 'GSTLINES:%' then
      begin
        parsed := substring(raw from 10)::jsonb;
        if jsonb_typeof(parsed) = 'array' then
          items := parsed;
        else
          items := parsed -> 'items';
          if parsed ? 'n' then
            extra := parsed ->> 'n';
          end if;
        end if;
        if items is not null
          and jsonb_typeof(items) = 'array'
          and jsonb_array_length(items) > 0 then
          select jsonb_agg(
            jsonb_build_object(
              'taxable', coalesce((elem ->> 'a')::numeric, 0),
              'rate', coalesce((elem ->> 'r')::numeric, 18),
              'gst', round(
                coalesce((elem ->> 'a')::numeric, 0)
                * coalesce((elem ->> 'r')::numeric, 18)
                / 100,
                2
              )
            )
          )
          into mapped
          from jsonb_array_elements(items) as elem;
        end if;
      exception
        when others then
          mapped := null;
      end;
      update public.purchases
      set
        lines = coalesce(mapped, '[]'::jsonb),
        notes = nullif(trim(coalesce(extra, '')), '')
      where id = rec.id;
    elsif rec.taxable_value > 0 then
      update public.purchases
      set lines = jsonb_build_array(
        jsonb_build_object(
          'taxable', rec.taxable_value,
          'rate', rec.gst_rate,
          'gst', round(rec.taxable_value * rec.gst_rate / 100, 2)
        )
      )
      where id = rec.id;
    end if;
  end loop;
end;
$$;

update public.purchases
set
  cgst = round((igst / 2)::numeric, 2),
  sgst = round((igst - round((igst / 2)::numeric, 2))::numeric, 2),
  igst = 0
where tax_type = 'intra'
  and igst > 0
  and cgst = 0
  and sgst = 0;

update public.purchases
set input_status = 'waiting'
where input_status is null
   or input_status not in ('waiting', 'got', 'missing');

alter table public.purchases drop constraint if exists purchases_input_status_check;
alter table public.purchases
  add constraint purchases_input_status_check
  check (input_status in ('waiting', 'got', 'missing'));

drop index if exists public.suppliers_user_gstin_uidx;
create unique index suppliers_user_gstin_uidx
  on public.suppliers (user_id, upper(trim(gstin)))
  where gstin is not null and length(trim(gstin)) > 0;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create or replace function private.handle_new_user()
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

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

drop function if exists public.handle_new_user();
