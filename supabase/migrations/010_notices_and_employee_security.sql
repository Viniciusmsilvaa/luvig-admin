-- Replace the remaining static notices with authenticated production data and
-- prevent RH from reading or changing salary values through the API.

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text,
  audience text not null default 'Todos',
  publish_date date not null default current_date,
  expires_at date,
  status text not null default 'ativo' check (status in ('ativo', 'programado', 'encerrado')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_notices_status_publish_date
  on public.notices(status, publish_date desc);

drop trigger if exists set_notices_updated_at on public.notices;
create trigger set_notices_updated_at
before update on public.notices
for each row execute function public.set_updated_at();

alter table public.notices enable row level security;

drop policy if exists notices_admin_rh_all on public.notices;
create policy notices_admin_rh_all on public.notices for all
using (public.is_admin() or public.is_rh())
with check (public.is_admin() or public.is_rh());

drop policy if exists notices_leader_read_active on public.notices;
create policy notices_leader_read_active on public.notices for select
using (
  public.is_lider()
  and status in ('ativo', 'programado')
  and (expires_at is null or expires_at >= current_date)
);

-- RLS protects rows, not individual columns. Direct reads expose only the
-- operational fields; the checked function below includes salary for Admin.
revoke select on public.employees from authenticated;
grant select (
  id, photo_url, full_name, role, phone, admission_date, status, score,
  next_vacation_date, vacation_return_date, medical_leave_return_date,
  notice_start_date, notice_end_date, dismissal_date, notes, created_at, updated_at
) on public.employees to authenticated;

create or replace function public.list_employees_secure(target_employee_id uuid default null)
returns table (
  id uuid,
  photo_url text,
  full_name text,
  role text,
  phone text,
  admission_date date,
  salary numeric,
  status text,
  score numeric,
  next_vacation_date date,
  vacation_return_date date,
  medical_leave_return_date date,
  notice_start_date date,
  notice_end_date date,
  dismissal_date date,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (public.is_admin() or public.is_rh()) then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    employee.id,
    employee.photo_url,
    employee.full_name,
    employee.role,
    employee.phone,
    employee.admission_date,
    case when public.is_admin() then employee.salary else null end,
    employee.status,
    employee.score,
    employee.next_vacation_date,
    employee.vacation_return_date,
    employee.medical_leave_return_date,
    employee.notice_start_date,
    employee.notice_end_date,
    employee.dismissal_date,
    employee.notes,
    employee.created_at,
    employee.updated_at
  from public.employees as employee
  where target_employee_id is null or employee.id = target_employee_id
  order by employee.full_name;
end;
$$;

grant execute on function public.list_employees_secure(uuid) to authenticated;

-- Contract values are financial data and are masked for RH.
revoke select on public.clients from authenticated;
grant select (
  id, name, responsible_name, phone, address, neighborhood, due_day,
  contracted_services, status, notes, contract_url, created_at, updated_at
) on public.clients to authenticated;

create or replace function public.list_clients_secure(target_client_id uuid default null)
returns table (
  id uuid,
  name text,
  responsible_name text,
  phone text,
  address text,
  neighborhood text,
  monthly_value numeric,
  due_day integer,
  contracted_services text[],
  status text,
  notes text,
  contract_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (public.is_admin() or public.is_rh()) then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    client.id,
    client.name,
    client.responsible_name,
    client.phone,
    client.address,
    client.neighborhood,
    case when public.is_admin() then client.monthly_value else null end,
    client.due_day,
    client.contracted_services,
    client.status,
    client.notes,
    client.contract_url,
    client.created_at,
    client.updated_at
  from public.clients as client
  where target_client_id is null or client.id = target_client_id
  order by client.name;
end;
$$;

grant execute on function public.list_clients_secure(uuid) to authenticated;

create or replace function public.protect_client_financial_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_rh() then
    if tg_op = 'INSERT' then
      new.monthly_value := null;
    else
      new.monthly_value := old.monthly_value;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_client_financial_fields on public.clients;
create trigger protect_client_financial_fields
before insert or update on public.clients
for each row execute function public.protect_client_financial_fields();

-- Leaders and RH may create requests, but only Admin decides their status.
drop policy if exists requests_rh_create_read on public.requests;
drop policy if exists requests_lider_create_read_own on public.requests;

create policy requests_rh_select on public.requests for select
using (public.is_rh());

create policy requests_rh_insert on public.requests for insert
with check (public.is_rh() and requested_by = auth.uid() and status = 'pendente');

create policy requests_lider_select_own on public.requests for select
using (public.is_lider() and requested_by = auth.uid());

create policy requests_lider_insert_own on public.requests for insert
with check (public.is_lider() and requested_by = auth.uid() and status = 'pendente');

-- RH can maintain a pending request it created, but cannot delete it or decide it.
drop policy if exists approval_requests_rh_create_read_own on public.approval_requests;

create policy approval_requests_rh_select_own on public.approval_requests for select
using (public.is_rh() and requested_by = auth.uid());

create policy approval_requests_rh_insert_own on public.approval_requests for insert
with check (public.is_rh() and requested_by = auth.uid() and status = 'pendente');

create policy approval_requests_rh_update_pending_own on public.approval_requests for update
using (public.is_rh() and requested_by = auth.uid() and status = 'pendente')
with check (public.is_rh() and requested_by = auth.uid() and status = 'pendente');

-- Salary is always retained by the database for RH-originated mutations.
create or replace function public.protect_employee_salary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_rh() then
    if tg_op = 'INSERT' then
      new.salary := null;
    else
      new.salary := old.salary;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_employee_salary on public.employees;
create trigger protect_employee_salary
before insert or update on public.employees
for each row execute function public.protect_employee_salary();

comment on table public.notices is 'Avisos internos visíveis conforme o perfil de acesso.';
