-- Simple financial module. Safe to apply when the initial schema was only
-- partially provisioned.

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  type text not null check (type in ('mensalidade', 'servico_extra', 'outro')),
  amount numeric not null check (amount > 0),
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
  amount numeric not null check (amount > 0),
  expense_date date,
  status text default 'pago' check (status in ('pago', 'pendente', 'cancelado')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_financial_entries_client_id on public.financial_entries(client_id);
create index if not exists idx_financial_entries_status on public.financial_entries(status);
create index if not exists idx_financial_entries_due_date on public.financial_entries(due_date);
create index if not exists idx_financial_expenses_category on public.financial_expenses(category);
create index if not exists idx_financial_expenses_expense_date on public.financial_expenses(expense_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_financial_entries_updated_at') then
    create trigger set_financial_entries_updated_at
    before update on public.financial_entries
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_financial_expenses_updated_at') then
    create trigger set_financial_expenses_updated_at
    before update on public.financial_expenses
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.financial_entries enable row level security;
alter table public.financial_expenses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_entries'
      and policyname = 'financial_entries_admin_all'
  ) then
    create policy financial_entries_admin_all
    on public.financial_entries for all
    using (public.is_admin())
    with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_expenses'
      and policyname = 'financial_expenses_admin_all'
  ) then
    create policy financial_expenses_admin_all
    on public.financial_expenses for all
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end;
$$;

comment on table public.financial_entries is 'Entradas financeiras simples da LUVIG, acessíveis apenas por Admin.';
comment on table public.financial_expenses is 'Saídas financeiras simples da LUVIG, acessíveis apenas por Admin.';
