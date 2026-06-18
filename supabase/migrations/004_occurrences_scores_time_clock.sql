-- Real occurrence workflow, idempotent history and full score recalculation.

create unique index if not exists idx_employee_history_occurrence_unique
on public.employee_history(occurrence_id)
where occurrence_id is not null;

create or replace function public.employee_tenure_bonus(target_employee_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select case
    when admission_date is null then 0
    when age(current_date, admission_date) <= interval '1 year' then 0.05
    when age(current_date, admission_date) <= interval '3 years' then 0.15
    when age(current_date, admission_date) <= interval '5 years' then 0.25
    else 0.40
  end
  from public.employees
  where id = target_employee_id;
$$;

create or replace function public.recalculate_employee_score(target_employee_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  impact_total numeric := 0;
  tenure_bonus numeric := 0;
  has_dismissal boolean := false;
  calculated_score numeric := 10;
begin
  if target_employee_id is null then
    return null;
  end if;

  select
    coalesce(sum(score_impact), 0),
    bool_or(type = 'demissao')
  into impact_total, has_dismissal
  from public.occurrences
  where employee_id = target_employee_id
    and status = 'confirmado';

  tenure_bonus := coalesce(public.employee_tenure_bonus(target_employee_id), 0);

  if coalesce(has_dismissal, false) then
    calculated_score := 0;
  else
    calculated_score := greatest(0, least(10, 10 + tenure_bonus + impact_total));
  end if;

  update public.employees
  set score = calculated_score,
      updated_at = now()
  where id = target_employee_id;

  return calculated_score;
end;
$$;

create or replace function public.sync_occurrence_history_and_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_employee_id uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.employee_history
    where occurrence_id = old.id;

    if old.status = 'confirmado' then
      perform public.recalculate_employee_score(old.employee_id);
    end if;
    return old;
  end if;

  target_employee_id := new.employee_id;

  if tg_op <> 'DELETE' and new.status = 'confirmado' and new.employee_id is not null then
    insert into public.employee_history (
      employee_id,
      occurrence_id,
      type,
      title,
      description,
      history_date,
      created_by
    )
    values (
      new.employee_id,
      new.id,
      new.type,
      new.title,
      new.description,
      new.occurrence_date,
      coalesce(new.reviewed_by, new.created_by)
    )
    on conflict (occurrence_id) where occurrence_id is not null
    do update set
      employee_id = excluded.employee_id,
      type = excluded.type,
      title = excluded.title,
      description = excluded.description,
      history_date = excluded.history_date,
      created_by = excluded.created_by;
  elsif tg_op = 'UPDATE' and old.status = 'confirmado' and new.status <> 'confirmado' then
    delete from public.employee_history
    where occurrence_id = old.id;
  end if;

  if new.status = 'confirmado' or (tg_op = 'UPDATE' and old.status = 'confirmado') then
    perform public.recalculate_employee_score(target_employee_id);
  end if;

  if tg_op = 'UPDATE' and old.employee_id is distinct from new.employee_id and old.status = 'confirmado' then
    perform public.recalculate_employee_score(old.employee_id);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_occurrence_history_and_score on public.occurrences;
create trigger sync_occurrence_history_and_score
after insert or update of status, score_impact, employee_id, type, title, description, occurrence_date
or delete on public.occurrences
for each row execute function public.sync_occurrence_history_and_score();

create or replace function public.review_occurrence(
  target_occurrence_id uuid,
  decision text,
  reviewer_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  target_employee_id uuid;
  next_status text;
begin
  if not public.is_admin() then
    raise exception 'Somente Admin pode finalizar ocorrências.';
  end if;

  if decision not in ('confirmado', 'recusado') then
    raise exception 'Decisão inválida.';
  end if;

  next_status := decision;

  update public.occurrences
  set status = next_status,
      reviewed_by = reviewer_id,
      updated_at = now()
  where id = target_occurrence_id
  returning employee_id into target_employee_id;

  if not found then
    raise exception 'Ocorrência não encontrada.';
  end if;

  return public.recalculate_employee_score(target_employee_id);
end;
$$;

create or replace function public.confirm_occurrence(target_occurrence_id uuid, reviewer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.review_occurrence(target_occurrence_id, 'confirmado', reviewer_id);
end;
$$;

create or replace function public.recommend_occurrence(target_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_rh() then
    raise exception 'Somente RH pode recomendar ocorrências.';
  end if;

  update public.occurrences
  set status = 'recomendado_pelo_rh',
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = target_occurrence_id
    and status in ('aguardando_conferencia', 'recomendado_pelo_rh');

  if not found then
    raise exception 'Ocorrência não encontrada ou já finalizada.';
  end if;
end;
$$;

drop policy if exists occurrences_rh_update_recommend on public.occurrences;
create policy occurrences_rh_update_recommend
on public.occurrences for update
using (public.is_rh() and status in ('aguardando_conferencia', 'recomendado_pelo_rh'))
with check (public.is_rh() and status in ('aguardando_conferencia', 'recomendado_pelo_rh'));

grant execute on function public.recalculate_employee_score(uuid) to authenticated;
grant execute on function public.review_occurrence(uuid, text, uuid) to authenticated;
grant execute on function public.recommend_occurrence(uuid) to authenticated;

create or replace function public.list_employee_options()
returns table (id uuid, full_name text, role text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (public.is_admin() or public.is_rh() or public.is_lider()) then
    raise exception 'Sem permissão para listar funcionários.';
  end if;

  return query
  select employees.id, employees.full_name, employees.role
  from public.employees
  where employees.status not in ('inativo', 'desligado')
  order by employees.full_name;
end;
$$;

grant execute on function public.list_employee_options() to authenticated;

create or replace function public.list_client_options()
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (public.is_admin() or public.is_rh() or public.is_lider()) then
    raise exception 'Sem permissão para listar condomínios.';
  end if;

  return query
  select clients.id, clients.name
  from public.clients
  where clients.status = 'ativo'
  order by clients.name;
end;
$$;

grant execute on function public.list_client_options() to authenticated;

-- The attachment bucket remains private; authenticated users receive signed URLs.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_authenticated_read_documents'
  ) then
    create policy storage_authenticated_read_documents
    on storage.objects for select to authenticated
    using (bucket_id = 'documents');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_authenticated_upload_documents'
  ) then
    create policy storage_authenticated_upload_documents
    on storage.objects for insert to authenticated
    with check (bucket_id = 'documents');
  end if;
end;
$$;
