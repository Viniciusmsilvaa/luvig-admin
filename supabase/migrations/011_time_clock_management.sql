-- Functional and auditable time clock for Vinícius, with Girlane read-only.

alter table public.time_clock
  add column if not exists edited_at timestamp with time zone,
  add column if not exists edited_by uuid references public.profiles(id) on delete set null,
  add column if not exists edit_reason text,
  add column if not exists is_edited boolean not null default false,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists idx_time_clock_profile_time_active
  on public.time_clock(profile_id, clock_time desc)
  where deleted_at is null;

create table if not exists public.time_clock_audit (
  id uuid primary key default gen_random_uuid(),
  time_clock_id uuid not null references public.time_clock(id) on delete cascade,
  action text not null check (action in ('edit', 'delete', 'restore')),
  old_value jsonb,
  new_value jsonb,
  reason text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_time_clock_audit_record_created
  on public.time_clock_audit(time_clock_id, created_at desc);

alter table public.time_clock_audit enable row level security;

create or replace function public.time_clock_owner_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
  from public.profiles
  where lower(email) in ('vmirandasilvav@gmail.com', 'vmirandasilvay@gmail.com')
  order by case lower(email) when 'vmirandasilvav@gmail.com' then 0 else 1 end
  limit 1;
$$;

create or replace function public.is_time_clock_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null and auth.uid() = public.time_clock_owner_id();
$$;

create or replace function public.can_view_time_clock()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_time_clock_owner()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and lower(email) = 'giadmiluvig@gmail.com'
        and role = 'admin'
        and status = 'ativo'
    );
$$;

drop policy if exists time_clock_vinicius_girlane_read on public.time_clock;
drop policy if exists time_clock_vinicius_insert on public.time_clock;

create policy time_clock_authorized_read on public.time_clock for select
using (profile_id = public.time_clock_owner_id() and public.can_view_time_clock());

drop policy if exists time_clock_audit_authorized_read on public.time_clock_audit;
create policy time_clock_audit_authorized_read on public.time_clock_audit for select
using (public.can_view_time_clock());

revoke insert, update, delete on public.time_clock from authenticated;
revoke insert, update, delete on public.time_clock_audit from authenticated;

create or replace function public.create_time_clock_record(
  target_clock_type text,
  target_notes text default null
)
returns public.time_clock
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.time_clock_owner_id();
  expected_type text;
  today_types text[];
  created_record public.time_clock%rowtype;
begin
  if not public.is_time_clock_owner() then
    raise exception 'Você não tem permissão para registrar este ponto.';
  end if;

  select coalesce(array_agg(clock_type order by clock_time), array[]::text[])
  into today_types
  from public.time_clock
  where profile_id = owner_id
    and deleted_at is null
    and (clock_time at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;

  expected_type := case
    when today_types = array[]::text[] then 'entrada'
    when today_types = array['entrada'] then 'saida_almoco'
    when today_types = array['entrada', 'saida_almoco'] then 'retorno_almoco'
    when today_types = array['entrada', 'saida_almoco', 'retorno_almoco'] then 'saida'
    else null
  end;

  if expected_type is null then
    if today_types = array['entrada', 'saida_almoco', 'retorno_almoco', 'saida'] then
      raise exception 'A jornada de hoje já foi concluída.';
    end if;
    raise exception 'Ponto incompleto. Corrija os registros antes de continuar.';
  end if;

  if target_clock_type <> expected_type then
    raise exception 'Próximo registro esperado: %.', expected_type;
  end if;

  insert into public.time_clock (profile_id, clock_type, clock_time, notes)
  values (owner_id, target_clock_type, now(), nullif(trim(target_notes), ''))
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.update_time_clock_record(
  target_record_id uuid,
  target_clock_type text,
  target_clock_time timestamp with time zone,
  target_notes text,
  change_reason text
)
returns public.time_clock
language plpgsql
security definer
set search_path = public
as $$
declare
  old_record public.time_clock%rowtype;
  updated_record public.time_clock%rowtype;
begin
  if not public.is_time_clock_owner() then
    raise exception 'Você não tem permissão para alterar este ponto.';
  end if;
  if nullif(trim(change_reason), '') is null then
    raise exception 'Informe o motivo da alteração.';
  end if;
  if target_clock_type not in ('entrada', 'saida_almoco', 'retorno_almoco', 'saida') then
    raise exception 'Tipo de ponto inválido.';
  end if;

  select * into old_record from public.time_clock
  where id = target_record_id
    and profile_id = public.time_clock_owner_id()
    and deleted_at is null
  for update;

  if old_record.id is null then
    raise exception 'Registro de ponto não encontrado.';
  end if;

  update public.time_clock
  set clock_type = target_clock_type,
      clock_time = target_clock_time,
      notes = nullif(trim(target_notes), ''),
      edited_at = now(),
      edited_by = auth.uid(),
      edit_reason = trim(change_reason),
      is_edited = true
  where id = target_record_id
  returning * into updated_record;

  insert into public.time_clock_audit (time_clock_id, action, old_value, new_value, reason, changed_by)
  values (target_record_id, 'edit', to_jsonb(old_record), to_jsonb(updated_record), trim(change_reason), auth.uid());

  return updated_record;
end;
$$;

create or replace function public.soft_delete_time_clock_record(
  target_record_id uuid,
  change_reason text
)
returns public.time_clock
language plpgsql
security definer
set search_path = public
as $$
declare
  old_record public.time_clock%rowtype;
  deleted_record public.time_clock%rowtype;
begin
  if not public.is_time_clock_owner() then
    raise exception 'Você não tem permissão para alterar este ponto.';
  end if;
  if nullif(trim(change_reason), '') is null then
    raise exception 'Informe o motivo da remoção.';
  end if;

  select * into old_record from public.time_clock
  where id = target_record_id
    and profile_id = public.time_clock_owner_id()
    and deleted_at is null
  for update;

  if old_record.id is null then
    raise exception 'Registro de ponto não encontrado.';
  end if;

  update public.time_clock
  set deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = trim(change_reason)
  where id = target_record_id
  returning * into deleted_record;

  insert into public.time_clock_audit (time_clock_id, action, old_value, new_value, reason, changed_by)
  values (target_record_id, 'delete', to_jsonb(old_record), to_jsonb(deleted_record), trim(change_reason), auth.uid());

  return deleted_record;
end;
$$;

revoke all on function public.create_time_clock_record(text, text) from public;
revoke all on function public.update_time_clock_record(uuid, text, timestamp with time zone, text, text) from public;
revoke all on function public.soft_delete_time_clock_record(uuid, text) from public;
grant execute on function public.create_time_clock_record(text, text) to authenticated;
grant execute on function public.update_time_clock_record(uuid, text, timestamp with time zone, text, text) to authenticated;
grant execute on function public.soft_delete_time_clock_record(uuid, text) to authenticated;

revoke all on function public.time_clock_owner_id() from public;
revoke all on function public.is_time_clock_owner() from public;
revoke all on function public.can_view_time_clock() from public;
grant execute on function public.time_clock_owner_id() to authenticated;
grant execute on function public.is_time_clock_owner() to authenticated;
grant execute on function public.can_view_time_clock() to authenticated;

comment on table public.time_clock_audit is 'Trilha imutável de edição e remoção dos registros de ponto.';
