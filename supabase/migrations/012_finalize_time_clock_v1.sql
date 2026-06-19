-- Final V1 time-clock model: profile permission, configurable schedule,
-- justified days, holidays, monthly periods and immutable audit.

alter table public.profiles
  add column if not exists time_clock_access text not null default 'none';

alter table public.profiles drop constraint if exists profiles_time_clock_access_check;
alter table public.profiles add constraint profiles_time_clock_access_check
  check (time_clock_access in ('write', 'read', 'none'));

update public.profiles
set time_clock_access = case
  when id = '9a3cacb3-ee0c-48ed-93cd-6adab7e60c0f'::uuid
    or lower(email) in ('vmirandasilvav@gmail.com', 'vmirandasilvay@gmail.com') then 'write'
  when id = 'ce8f51ee-837a-4e4f-9340-fe1835a5c97e'::uuid
    or lower(email) = 'giadmiluvig@gmail.com' then 'read'
  else 'none'
end;

create unique index if not exists profiles_single_time_clock_writer
  on public.profiles ((time_clock_access)) where time_clock_access = 'write' and status = 'ativo';

create or replace function public.time_clock_owner_id()
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.profiles
  where status = 'ativo' and (
    time_clock_access = 'write'
    or (not exists (select 1 from public.profiles where status = 'ativo' and time_clock_access = 'write')
      and lower(email) in ('vmirandasilvav@gmail.com', 'vmirandasilvay@gmail.com'))
  )
  order by case when time_clock_access = 'write' then 0 else 1 end, created_at
  limit 1;
$$;

create or replace function public.is_time_clock_owner()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and id = public.time_clock_owner_id()
      and status = 'ativo' and time_clock_access = 'write'
  );
$$;

create or replace function public.can_view_time_clock()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'ativo' and time_clock_access in ('write', 'read')
  );
$$;

alter table public.time_clock_audit alter column time_clock_id drop not null;
alter table public.time_clock_audit add column if not exists profile_id uuid references public.profiles(id) on delete set null;
alter table public.time_clock_audit drop constraint if exists time_clock_audit_action_check;
alter table public.time_clock_audit add constraint time_clock_audit_action_check
  check (action in ('create', 'manual_create', 'edit', 'delete', 'restore', 'day_status', 'schedule'));

alter table public.time_clock add column if not exists is_manual boolean not null default false;
alter table public.time_clock add column if not exists manual_reason text;
alter table public.time_clock add column if not exists created_manually_by uuid references public.profiles(id) on delete set null;

update public.time_clock_audit audit
set profile_id = clock.profile_id
from public.time_clock clock
where audit.time_clock_id = clock.id and audit.profile_id is null;

create or replace function public.fill_time_clock_audit_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is null and new.time_clock_id is not null then
    select profile_id into new.profile_id from public.time_clock where id = new.time_clock_id;
  end if;
  return new;
end; $$;

drop trigger if exists fill_time_clock_audit_profile on public.time_clock_audit;
create trigger fill_time_clock_audit_profile
before insert on public.time_clock_audit
for each row execute function public.fill_time_clock_audit_profile();

create table if not exists public.work_schedule_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  expected_start_time time not null default '10:00',
  expected_end_time time not null default '17:30',
  expected_daily_minutes integer not null default 390 check (expected_daily_minutes between 1 and 1440),
  expected_break_minutes integer not null default 60 check (expected_break_minutes between 0 and 720),
  expected_break_start time,
  expected_break_end time,
  entry_tolerance_minutes integer not null default 5 check (entry_tolerance_minutes between 0 and 180),
  exit_tolerance_minutes integer not null default 5 check (exit_tolerance_minutes between 0 and 180),
  break_tolerance_minutes integer not null default 5 check (break_tolerance_minutes between 0 and 180),
  tracking_start_date date not null default '2026-06-17',
  valid_from date not null default current_date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (profile_id, valid_from)
);

create table if not exists public.time_clock_day_status (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reference_date date not null,
  status text not null check (status in ('folga', 'atestado', 'ferias', 'feriado', 'outro_justificado')),
  reason text,
  attachment_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (profile_id, reference_date)
);

create table if not exists public.time_clock_holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null unique,
  holiday_type text not null check (holiday_type in ('nacional', 'estadual', 'municipal', 'interno')),
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.time_clock_periods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  total_worked_minutes integer not null default 0,
  total_expected_minutes integer not null default 0,
  balance_minutes integer not null default 0,
  closed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (profile_id, start_date),
  check (end_date >= start_date)
);

create index if not exists idx_work_schedule_profile_valid on public.work_schedule_settings(profile_id, valid_from desc);
create index if not exists idx_time_clock_day_status_date on public.time_clock_day_status(profile_id, reference_date desc);
create index if not exists idx_time_clock_holidays_date on public.time_clock_holidays(holiday_date);
create index if not exists idx_time_clock_periods_profile_start on public.time_clock_periods(profile_id, start_date desc);

alter table public.work_schedule_settings enable row level security;
alter table public.time_clock_day_status enable row level security;
alter table public.time_clock_holidays enable row level security;
alter table public.time_clock_periods enable row level security;

drop policy if exists work_schedule_authorized_read on public.work_schedule_settings;
create policy work_schedule_authorized_read on public.work_schedule_settings for select
  using (profile_id = public.time_clock_owner_id() and public.can_view_time_clock());
drop policy if exists time_clock_day_status_authorized_read on public.time_clock_day_status;
create policy time_clock_day_status_authorized_read on public.time_clock_day_status for select
  using (profile_id = public.time_clock_owner_id() and public.can_view_time_clock());
drop policy if exists time_clock_holidays_authorized_read on public.time_clock_holidays;
create policy time_clock_holidays_authorized_read on public.time_clock_holidays for select
  using (public.can_view_time_clock());
drop policy if exists time_clock_periods_authorized_read on public.time_clock_periods;
create policy time_clock_periods_authorized_read on public.time_clock_periods for select
  using (profile_id = public.time_clock_owner_id() and public.can_view_time_clock());

revoke insert, update, delete on public.work_schedule_settings from authenticated;
revoke insert, update, delete on public.time_clock_day_status from authenticated;
revoke insert, update, delete on public.time_clock_holidays from authenticated;
revoke insert, update, delete on public.time_clock_periods from authenticated;

drop function if exists public.save_work_schedule_settings(smallint[], time, time, integer, integer, time, time, integer, integer, integer, date, text);
create or replace function public.save_work_schedule_settings(
  target_weekdays smallint[], target_expected_start_time time, target_expected_end_time time,
  target_expected_daily_minutes integer, target_expected_break_minutes integer,
  target_expected_break_start time, target_expected_break_end time,
  target_entry_tolerance_minutes integer, target_exit_tolerance_minutes integer,
  target_break_tolerance_minutes integer, target_valid_from date, target_tracking_start_date date,
  change_reason text default 'Configuração atualizada'
)
returns public.work_schedule_settings language plpgsql security definer set search_path = public as $$
declare saved public.work_schedule_settings%rowtype; owner_id uuid := public.time_clock_owner_id();
begin
  if not public.is_time_clock_owner() then raise exception 'Somente Vinícius pode alterar a jornada.'; end if;
  if coalesce(array_length(target_weekdays, 1), 0) = 0 then raise exception 'Selecione ao menos um dia de trabalho.'; end if;
  insert into public.work_schedule_settings (
    profile_id, weekdays, expected_start_time, expected_end_time, expected_daily_minutes,
    expected_break_minutes, expected_break_start, expected_break_end, entry_tolerance_minutes,
    exit_tolerance_minutes, break_tolerance_minutes, valid_from, tracking_start_date
  ) values (
    owner_id, target_weekdays, target_expected_start_time, target_expected_end_time, target_expected_daily_minutes,
    target_expected_break_minutes, target_expected_break_start, target_expected_break_end,
    target_entry_tolerance_minutes, target_exit_tolerance_minutes, target_break_tolerance_minutes, target_valid_from,
    target_tracking_start_date
  ) on conflict (profile_id, valid_from) do update set
    weekdays = excluded.weekdays, expected_start_time = excluded.expected_start_time,
    expected_end_time = excluded.expected_end_time, expected_daily_minutes = excluded.expected_daily_minutes,
    expected_break_minutes = excluded.expected_break_minutes, expected_break_start = excluded.expected_break_start,
    expected_break_end = excluded.expected_break_end, entry_tolerance_minutes = excluded.entry_tolerance_minutes,
    exit_tolerance_minutes = excluded.exit_tolerance_minutes, break_tolerance_minutes = excluded.break_tolerance_minutes,
    tracking_start_date = excluded.tracking_start_date,
    updated_at = now()
  returning * into saved;
  insert into public.time_clock_audit(profile_id, action, new_value, reason, changed_by)
  values (owner_id, 'schedule', to_jsonb(saved), coalesce(nullif(trim(change_reason), ''), 'Configuração atualizada'), auth.uid());
  return saved;
end; $$;

create or replace function public.save_time_clock_day_status(
  target_date date, target_status text, target_reason text default null, target_attachment_url text default null
)
returns public.time_clock_day_status language plpgsql security definer set search_path = public as $$
declare saved public.time_clock_day_status%rowtype; previous public.time_clock_day_status%rowtype; owner_id uuid := public.time_clock_owner_id();
begin
  if not public.is_time_clock_owner() then raise exception 'Somente Vinícius pode justificar o próprio dia.'; end if;
  if target_status not in ('folga', 'atestado', 'ferias', 'feriado', 'outro_justificado') then raise exception 'Situação inválida.'; end if;
  if target_date < (now() at time zone 'America/Sao_Paulo')::date and nullif(trim(target_reason), '') is null then
    raise exception 'Informe o motivo da alteração retroativa.';
  end if;
  select * into previous from public.time_clock_day_status where profile_id = owner_id and reference_date = target_date;
  insert into public.time_clock_day_status(profile_id, reference_date, status, reason, attachment_url, created_by)
  values (owner_id, target_date, target_status, nullif(trim(target_reason), ''), nullif(trim(target_attachment_url), ''), auth.uid())
  on conflict (profile_id, reference_date) do update set status = excluded.status, reason = excluded.reason,
    attachment_url = excluded.attachment_url, updated_at = now()
  returning * into saved;
  insert into public.time_clock_audit(profile_id, action, old_value, new_value, reason, changed_by)
  values (owner_id, 'day_status', to_jsonb(previous), to_jsonb(saved), coalesce(nullif(trim(target_reason), ''), 'Situação do dia atualizada'), auth.uid());
  return saved;
end; $$;

create or replace function public.remove_time_clock_day_status(target_date date, change_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare previous public.time_clock_day_status%rowtype; owner_id uuid := public.time_clock_owner_id();
begin
  if not public.is_time_clock_owner() then raise exception 'Somente Vinícius pode alterar a situação do dia.'; end if;
  if nullif(trim(change_reason), '') is null then raise exception 'Informe o motivo da remoção.'; end if;
  delete from public.time_clock_day_status where profile_id = owner_id and reference_date = target_date returning * into previous;
  if previous.id is not null then
    insert into public.time_clock_audit(profile_id, action, old_value, reason, changed_by)
    values (owner_id, 'day_status', to_jsonb(previous), trim(change_reason), auth.uid());
  end if;
end; $$;

create or replace function public.save_time_clock_holiday(
  target_id uuid, target_name text, target_date date, target_type text, target_notes text default null
)
returns public.time_clock_holidays language plpgsql security definer set search_path = public as $$
declare saved public.time_clock_holidays%rowtype;
begin
  if not public.is_time_clock_owner() then raise exception 'Somente Vinícius pode cadastrar feriados.'; end if;
  if target_id is null then
    insert into public.time_clock_holidays(name, holiday_date, holiday_type, notes, created_by)
    values (trim(target_name), target_date, target_type, nullif(trim(target_notes), ''), auth.uid()) returning * into saved;
  else
    update public.time_clock_holidays set name = trim(target_name), holiday_date = target_date,
      holiday_type = target_type, notes = nullif(trim(target_notes), ''), updated_at = now()
    where id = target_id returning * into saved;
  end if;
  return saved;
end; $$;

create or replace function public.delete_time_clock_holiday(target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_time_clock_owner() then raise exception 'Somente Vinícius pode remover feriados.'; end if;
  delete from public.time_clock_holidays where id = target_id;
end; $$;

create or replace function public.ensure_time_clock_period(target_date date default (now() at time zone 'America/Sao_Paulo')::date)
returns public.time_clock_periods language plpgsql security definer set search_path = public as $$
declare owner_id uuid := public.time_clock_owner_id(); period_start date; period_end date; current_period public.time_clock_periods%rowtype;
begin
  if not public.can_view_time_clock() then raise exception 'Sem permissão para visualizar o período.'; end if;
  if extract(day from target_date) >= 2 then period_start := date_trunc('month', target_date)::date + 1;
  else period_start := (date_trunc('month', target_date) - interval '1 month')::date + 1; end if;
  period_end := (date_trunc('month', period_start) + interval '1 month')::date;
  update public.time_clock_periods set status = 'fechado', closed_at = coalesce(closed_at, now())
  where profile_id = owner_id and status = 'aberto' and start_date < period_start;
  insert into public.time_clock_periods(profile_id, start_date, end_date)
  values (owner_id, period_start, period_end) on conflict (profile_id, start_date) do nothing;
  select * into current_period from public.time_clock_periods where profile_id = owner_id and start_date = period_start;
  return current_period;
end; $$;

create or replace function public.update_time_clock_period_totals(
  target_period_id uuid, target_worked integer, target_expected integer, target_balance integer
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_time_clock_owner() then raise exception 'Somente Vinícius pode atualizar o fechamento.'; end if;
  update public.time_clock_periods set total_worked_minutes = target_worked,
    total_expected_minutes = target_expected, balance_minutes = target_balance
  where id = target_period_id and profile_id = public.time_clock_owner_id();
end; $$;

insert into public.work_schedule_settings(
  profile_id, weekdays, expected_start_time, expected_end_time, expected_daily_minutes,
  expected_break_minutes, entry_tolerance_minutes, exit_tolerance_minutes, break_tolerance_minutes, valid_from
)
select public.time_clock_owner_id(), array[1,2,3,4,5]::smallint[], '10:00', '17:30', 390, 60, 5, 5, 5, '2026-06-17'
where public.time_clock_owner_id() is not null
on conflict (profile_id, valid_from) do nothing;

-- Creation is also audited; audit rows remain immutable to frontend clients.
create or replace function public.create_time_clock_record(target_clock_type text, target_notes text default null)
returns public.time_clock language plpgsql security definer set search_path = public as $$
declare owner_id uuid := public.time_clock_owner_id(); expected_type text; today_types text[]; created_record public.time_clock%rowtype;
begin
  if not public.is_time_clock_owner() then raise exception 'Você não tem permissão para registrar este ponto.'; end if;
  select coalesce(array_agg(clock_type order by clock_time), array[]::text[]) into today_types
  from public.time_clock where profile_id = owner_id and deleted_at is null
    and (clock_time at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;
  expected_type := case when today_types = array[]::text[] then 'entrada'
    when today_types = array['entrada'] then 'saida_almoco'
    when today_types = array['entrada','saida_almoco'] then 'retorno_almoco'
    when today_types = array['entrada','saida_almoco','retorno_almoco'] then 'saida' else null end;
  if expected_type is null then raise exception 'A jornada de hoje já foi concluída ou precisa de correção.'; end if;
  if target_clock_type <> expected_type then raise exception 'Próximo registro esperado: %.', expected_type; end if;
  insert into public.time_clock(profile_id, clock_type, clock_time, notes)
  values (owner_id, target_clock_type, now(), nullif(trim(target_notes), '')) returning * into created_record;
  insert into public.time_clock_audit(time_clock_id, profile_id, action, new_value, reason, changed_by)
  values (created_record.id, owner_id, 'create', to_jsonb(created_record), 'Registro de ponto criado', auth.uid());
  return created_record;
end; $$;

create or replace function public.create_manual_time_clock_records(
  target_date date, target_entries jsonb, manual_reason text, manual_notes text default null
)
returns setof public.time_clock language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := public.time_clock_owner_id();
  item jsonb;
  entry_type text;
  entry_time time;
  created_record public.time_clock%rowtype;
begin
  if not public.is_time_clock_owner() then
    raise exception 'Somente Vinícius pode adicionar registros retroativos.';
  end if;
  if target_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Não é permitido registrar pontos em data futura.';
  end if;
  if nullif(trim(manual_reason), '') is null then
    raise exception 'Informe o motivo do registro retroativo.';
  end if;
  if jsonb_typeof(target_entries) <> 'array' or jsonb_array_length(target_entries) = 0 then
    raise exception 'Informe ao menos uma batida.';
  end if;

  for item in select value from jsonb_array_elements(target_entries)
  loop
    entry_type := item->>'clock_type';
    entry_time := (item->>'clock_time')::time;
    if entry_type not in ('entrada', 'saida_almoco', 'retorno_almoco', 'saida') then
      raise exception 'Tipo de batida inválido.';
    end if;
    if exists (
      select 1 from public.time_clock
      where profile_id = owner_id and deleted_at is null and clock_type = entry_type
        and (clock_time at time zone 'America/Sao_Paulo')::date = target_date
    ) then
      raise exception 'Já existe uma batida do tipo % nesta data.', entry_type;
    end if;

    insert into public.time_clock(
      profile_id, clock_type, clock_time, notes, is_manual, manual_reason, created_manually_by
    ) values (
      owner_id, entry_type,
      (target_date + entry_time) at time zone 'America/Sao_Paulo',
      nullif(trim(manual_notes), ''), true, trim(manual_reason), auth.uid()
    ) returning * into created_record;

    insert into public.time_clock_audit(time_clock_id, profile_id, action, new_value, reason, changed_by)
    values (created_record.id, owner_id, 'manual_create', to_jsonb(created_record), trim(manual_reason), auth.uid());
    return next created_record;
  end loop;
end; $$;

insert into storage.buckets(id, name, public) values ('time-clock-attachments', 'time-clock-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists time_clock_attachments_read on storage.objects;
create policy time_clock_attachments_read on storage.objects for select to authenticated
using (bucket_id = 'time-clock-attachments' and public.can_view_time_clock());
drop policy if exists time_clock_attachments_owner_insert on storage.objects;
create policy time_clock_attachments_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'time-clock-attachments' and public.is_time_clock_owner()
  and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on function public.save_work_schedule_settings(smallint[], time, time, integer, integer, time, time, integer, integer, integer, date, date, text) from public;
revoke all on function public.create_manual_time_clock_records(date, jsonb, text, text) from public;
revoke all on function public.save_time_clock_day_status(date, text, text, text) from public;
revoke all on function public.remove_time_clock_day_status(date, text) from public;
revoke all on function public.save_time_clock_holiday(uuid, text, date, text, text) from public;
revoke all on function public.delete_time_clock_holiday(uuid) from public;
revoke all on function public.ensure_time_clock_period(date) from public;
revoke all on function public.update_time_clock_period_totals(uuid, integer, integer, integer) from public;
grant execute on function public.save_work_schedule_settings(smallint[], time, time, integer, integer, time, time, integer, integer, integer, date, date, text) to authenticated;
grant execute on function public.create_manual_time_clock_records(date, jsonb, text, text) to authenticated;
grant execute on function public.save_time_clock_day_status(date, text, text, text) to authenticated;
grant execute on function public.remove_time_clock_day_status(date, text) to authenticated;
grant execute on function public.save_time_clock_holiday(uuid, text, date, text, text) to authenticated;
grant execute on function public.delete_time_clock_holiday(uuid) to authenticated;
grant execute on function public.ensure_time_clock_period(date) to authenticated;
grant execute on function public.update_time_clock_period_totals(uuid, integer, integer, integer) to authenticated;

comment on column public.profiles.time_clock_access is 'Permissão específica do Meu Ponto: write, read ou none.';
comment on table public.work_schedule_settings is 'Histórico versionado da jornada de Vinícius.';
comment on table public.time_clock_periods is 'Períodos mensais de 2 a 1, fechados sem excluir batidas.';
