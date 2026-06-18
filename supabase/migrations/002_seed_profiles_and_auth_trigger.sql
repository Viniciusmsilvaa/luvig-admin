-- LUVIG Admin - seed required profiles and keep automatic profile creation.
-- Run this after supabase/migrations/001_initial_schema.sql.

do $$
declare
  missing_columns text[];
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Tabela public.profiles não existe. Execute primeiro 001_initial_schema.sql.';
  end if;

  select array_agg(required.column_name order by required.column_name)
  into missing_columns
  from (
    values
      ('id'),
      ('full_name'),
      ('email'),
      ('role'),
      ('company_position'),
      ('status'),
      ('created_at'),
      ('updated_at')
  ) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'Colunas ausentes em public.profiles: %', array_to_string(missing_columns, ', ');
  end if;
end;
$$;

insert into public.profiles (
  id,
  full_name,
  email,
  role,
  company_position,
  status,
  created_at,
  updated_at
)
values
  (
    '3d1ae22b-5f7a-41a6-8b19-1ed920d8dafc',
    'Amanda',
    'amandamsluvig@gmail.com',
    'lider',
    'Líder',
    'ativo',
    now(),
    now()
  ),
  (
    '296a9adb-30c9-491d-aa58-fa6fbcc50d57',
    'Andréia',
    'andreialider@gmail.com',
    'lider',
    'Líder',
    'ativo',
    now(),
    now()
  ),
  (
    'ce8f51ee-837a-4e4f-9340-fe1835a5c97e',
    'Girlane',
    'giadmiluvig@gmail.com',
    'admin',
    'Administrativo',
    'ativo',
    now(),
    now()
  ),
  (
    'c6074270-649a-4487-b529-2e0ea047f431',
    'Julia',
    'juliarhluvig@gmail.com',
    'rh',
    'RH',
    'ativo',
    now(),
    now()
  ),
  (
    '9a3cacb3-ee0c-48ed-93cd-6adab7e60c0f',
    'Vinícius Miranda',
    'vmirandasilvay@gmail.com',
    'admin',
    'Administrador',
    'ativo',
    now(),
    now()
  )
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  company_position = excluded.company_position,
  status = excluded.status,
  updated_at = now();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    company_position,
    status,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      new.email
    ),
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'lider'),
    coalesce(nullif(new.raw_user_meta_data->>'company_position', ''), 'Colaborador'),
    'ativo',
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user on auth.users;

create trigger create_profile_for_new_user
after insert on auth.users
for each row
execute function public.create_profile_for_new_user();
