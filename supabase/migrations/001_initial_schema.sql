-- LUVIG Admin initial Supabase schema
-- Apply this file in the Supabase SQL editor or through the Supabase CLI.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'rh', 'lider')),
  company_position text,
  avatar_url text,
  status text default 'ativo' check (status in ('ativo', 'inativo')),
  main_device text,
  last_access_at timestamp with time zone,
  linked_employee_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  photo_url text,
  full_name text not null,
  role text,
  phone text,
  admission_date date,
  salary numeric,
  status text default 'ativo' check (status in ('ativo', 'ferias', 'atestado', 'aviso_previo', 'inativo', 'desligado')),
  score numeric default 10.0 check (score >= 0 and score <= 10),
  next_vacation_date date,
  vacation_return_date date,
  medical_leave_return_date date,
  notice_start_date date,
  notice_end_date date,
  dismissal_date date,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles
  add constraint profiles_linked_employee_id_fkey
  foreign key (linked_employee_id) references public.employees(id) on delete set null;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  responsible_name text,
  phone text,
  address text,
  neighborhood text,
  monthly_value numeric,
  due_day integer check (due_day between 1 and 31),
  contracted_services text[],
  status text default 'ativo' check (status in ('ativo', 'inativo', 'suspenso', 'encerrado')),
  notes text,
  contract_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.occurrences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  type text not null check (
    type in (
      'falta',
      'atraso',
      'atestado',
      'advertencia',
      'suspensao',
      'elogio',
      'deslize',
      'hora_extra',
      'hora_faltante',
      'ferias',
      'aviso_previo',
      'demissao',
      'observacao',
      'predio_sujo',
      'servico_nao_realizado',
      'reclamacao_sindico',
      'solicitacao_sindico',
      'problema_condominio',
      'pedido_material',
      'ocorrencia_geral'
    )
  ),
  title text,
  description text,
  occurrence_date date not null,
  status text default 'aguardando_conferencia' check (status in ('aguardando_conferencia', 'recomendado_pelo_rh', 'confirmado', 'recusado')),
  score_impact numeric default 0,
  attachment_url text,
  source text check (source in ('admin', 'rh', 'lider')),
  admin_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.employee_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  occurrence_id uuid references public.occurrences(id) on delete set null,
  type text not null,
  title text,
  description text,
  history_date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  request_type text not null check (
    request_type in (
      'editar_funcionario',
      'inativar_funcionario',
      'alterar_status_funcionario',
      'editar_documento',
      'confirmar_ocorrencia',
      'excluir_registro',
      'outro'
    )
  ),
  target_table text,
  target_id uuid,
  payload jsonb,
  reason text,
  status text default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  admin_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  type text not null check (type in ('uniforme', 'produto_limpeza', 'produto_piscina', 'equipamento', 'ferramenta', 'folga', 'ferias', 'documento', 'ajuda', 'outro')),
  title text not null,
  description text,
  urgency text default 'normal' check (urgency in ('baixa', 'normal', 'alta', 'urgente')),
  status text default 'pendente' check (status in ('pendente', 'em_analise', 'aprovado', 'recusado', 'resolvido')),
  admin_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  type text not null check (type in ('mensalidade', 'servico_extra', 'outro')),
  amount numeric not null,
  sent_date date,
  due_date date,
  paid_date date,
  status text default 'pendente' check (status in ('pendente', 'pago', 'atrasado', 'cancelado')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.financial_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('folha', 'rescisao', 'combustivel', 'equipamentos', 'uniformes', 'produtos', 'manutencao', 'impostos', 'outros')),
  amount numeric not null,
  expense_date date,
  status text default 'pago' check (status in ('pago', 'pendente', 'cancelado')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('atestado', 'advertencia', 'suspensao', 'contrato', 'rescisao', 'documento_pessoal', 'outro')),
  title text,
  file_url text not null,
  status text default 'ativo' check (status in ('ativo', 'arquivado')),
  created_at timestamp with time zone default now()
);

create table if not exists public.time_clock (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  clock_type text not null check (clock_type in ('entrada', 'saida_almoco', 'retorno_almoco', 'saida')),
  clock_time timestamp with time zone default now(),
  notes text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_employees_status on public.employees(status);
create index if not exists idx_clients_status on public.clients(status);
create index if not exists idx_occurrences_employee_id on public.occurrences(employee_id);
create index if not exists idx_occurrences_client_id on public.occurrences(client_id);
create index if not exists idx_occurrences_status on public.occurrences(status);
create index if not exists idx_employee_history_employee_id on public.employee_history(employee_id);
create index if not exists idx_approval_requests_status on public.approval_requests(status);
create index if not exists idx_requests_requested_by on public.requests(requested_by);
create index if not exists idx_financial_entries_client_id on public.financial_entries(client_id);
create index if not exists idx_time_clock_profile_id on public.time_clock(profile_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_occurrences_updated_at
before update on public.occurrences
for each row execute function public.set_updated_at();

create trigger set_approval_requests_updated_at
before update on public.approval_requests
for each row execute function public.set_updated_at();

create trigger set_requests_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

create trigger set_financial_entries_updated_at
before update on public.financial_entries
for each row execute function public.set_updated_at();

create trigger set_financial_expenses_updated_at
before update on public.financial_expenses
for each row execute function public.set_updated_at();

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and status = 'ativo';
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'admin';
$$;

create or replace function public.is_rh()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'rh';
$$;

create or replace function public.is_lider()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'lider';
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, company_position)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'lider'),
    new.raw_user_meta_data->>'company_position'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user on auth.users;
create trigger create_profile_for_new_user
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.confirm_occurrence(target_occurrence_id uuid, reviewer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_occurrence public.occurrences%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Somente Admin pode confirmar ocorrências.';
  end if;

  select * into target_occurrence
  from public.occurrences
  where id = target_occurrence_id;

  if target_occurrence.id is null then
    raise exception 'Ocorrência não encontrada.';
  end if;

  update public.occurrences
  set status = 'confirmado', reviewed_by = reviewer_id
  where id = target_occurrence_id;

  if target_occurrence.employee_id is not null then
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
      target_occurrence.employee_id,
      target_occurrence.id,
      target_occurrence.type,
      target_occurrence.title,
      target_occurrence.description,
      target_occurrence.occurrence_date,
      reviewer_id
    );

    update public.employees
    set score = greatest(0, least(10, coalesce(score, 10) + coalesce(target_occurrence.score_impact, 0)))
    where id = target_occurrence.employee_id;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.clients enable row level security;
alter table public.occurrences enable row level security;
alter table public.employee_history enable row level security;
alter table public.approval_requests enable row level security;
alter table public.requests enable row level security;
alter table public.financial_entries enable row level security;
alter table public.financial_expenses enable row level security;
alter table public.documents enable row level security;
alter table public.time_clock enable row level security;

create policy profiles_select_own_or_admin
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy profiles_update_own_basic_or_admin
on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy profiles_admin_all
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy employees_admin_all
on public.employees for all
using (public.is_admin())
with check (public.is_admin());

create policy employees_rh_read
on public.employees for select
using (public.is_rh());

create policy employees_rh_insert_request_ready
on public.employees for insert
with check (public.is_rh());

create policy clients_admin_all
on public.clients for all
using (public.is_admin())
with check (public.is_admin());

create policy clients_rh_read
on public.clients for select
using (public.is_rh());

create policy occurrences_admin_all
on public.occurrences for all
using (public.is_admin())
with check (public.is_admin());

create policy occurrences_rh_read_create_recommend
on public.occurrences for select
using (public.is_rh());

create policy occurrences_rh_insert
on public.occurrences for insert
with check (public.is_rh() and created_by = auth.uid() and source = 'rh');

create policy occurrences_lider_insert
on public.occurrences for insert
with check (public.is_lider() and created_by = auth.uid() and source = 'lider' and status = 'aguardando_conferencia');

create policy occurrences_lider_read_own
on public.occurrences for select
using (public.is_lider() and created_by = auth.uid());

create policy employee_history_admin_rh_read
on public.employee_history for select
using (public.is_admin() or public.is_rh());

create policy employee_history_admin_insert
on public.employee_history for insert
with check (public.is_admin());

create policy approval_requests_admin_all
on public.approval_requests for all
using (public.is_admin())
with check (public.is_admin());

create policy approval_requests_rh_create_read_own
on public.approval_requests for all
using (public.is_rh() and requested_by = auth.uid())
with check (public.is_rh() and requested_by = auth.uid() and status = 'pendente');

create policy requests_admin_all
on public.requests for all
using (public.is_admin())
with check (public.is_admin());

create policy requests_rh_create_read
on public.requests for all
using (public.is_rh())
with check (public.is_rh() and requested_by = auth.uid());

create policy requests_lider_create_read_own
on public.requests for all
using (public.is_lider() and requested_by = auth.uid())
with check (public.is_lider() and requested_by = auth.uid());

create policy financial_entries_admin_all
on public.financial_entries for all
using (public.is_admin())
with check (public.is_admin());

create policy financial_expenses_admin_all
on public.financial_expenses for all
using (public.is_admin())
with check (public.is_admin());

create policy documents_admin_all
on public.documents for all
using (public.is_admin())
with check (public.is_admin());

create policy documents_rh_read_create
on public.documents for all
using (public.is_rh())
with check (public.is_rh() and uploaded_by = auth.uid());

create policy time_clock_own_or_admin_read
on public.time_clock for select
using (profile_id = auth.uid() or public.is_admin());

create policy time_clock_own_insert
on public.time_clock for insert
with check (profile_id = auth.uid());

create policy time_clock_admin_all
on public.time_clock for all
using (public.is_admin())
with check (public.is_admin());

-- Initial Storage buckets. They are private by default.
insert into storage.buckets (id, name, public)
values
  ('employee-photos', 'employee-photos', false),
  ('documents', 'documents', false),
  ('client-contracts', 'client-contracts', false)
on conflict (id) do nothing;

create policy storage_authenticated_read_luvig_buckets
on storage.objects for select
to authenticated
using (bucket_id in ('employee-photos', 'documents', 'client-contracts'));

create policy storage_authenticated_upload_luvig_buckets
on storage.objects for insert
to authenticated
with check (bucket_id in ('employee-photos', 'documents', 'client-contracts'));

create policy storage_admin_update_luvig_buckets
on storage.objects for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy storage_admin_delete_luvig_buckets
on storage.objects for delete
to authenticated
using (public.is_admin());

comment on table public.profiles is 'Perfis internos usados para Admin, RH e Lider.';
comment on table public.employees is 'Funcionários da LUVIG. O frontend oculta salário para RH; em produção, avalie view sem salário para defesa adicional em profundidade.';
comment on table public.occurrences is 'Ocorrências criadas por Admin, RH ou Liderança. Apenas Admin confirma e afeta nota/histórico.';
comment on function public.confirm_occurrence(uuid, uuid) is 'Confirma ocorrência, cria histórico e atualiza nota quando houver funcionário vinculado.';
