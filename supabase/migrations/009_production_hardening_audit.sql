-- Production hardening: preserve application roles while enforcing them at RLS level.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs for select
using (public.is_admin());

create or replace function public.log_audit_event(
  event_action text,
  event_entity_type text,
  event_entity_id uuid default null,
  event_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), event_action, event_entity_type, event_entity_id, coalesce(event_details, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.log_audit_event(text, text, uuid, jsonb) to authenticated;

-- Documents: RH can read and insert, but cannot update or delete permanently.
drop policy if exists documents_rh_read_create on public.documents;
drop policy if exists documents_rh_select on public.documents;
drop policy if exists documents_rh_insert on public.documents;

create policy documents_rh_select on public.documents for select
using (public.is_rh());

create policy documents_rh_insert on public.documents for insert
with check (public.is_rh() and uploaded_by = auth.uid());

-- Meu Ponto: Vinícius writes his own records; Girlane has read-only access.
drop policy if exists time_clock_own_or_admin_read on public.time_clock;
drop policy if exists time_clock_own_insert on public.time_clock;
drop policy if exists time_clock_admin_all on public.time_clock;
drop policy if exists time_clock_vinicius_girlane_read on public.time_clock;
drop policy if exists time_clock_vinicius_insert on public.time_clock;

create policy time_clock_vinicius_girlane_read on public.time_clock for select
using (
  profile_id = '9a3cacb3-ee0c-48ed-93cd-6adab7e60c0f'::uuid
  and auth.uid() in (
    '9a3cacb3-ee0c-48ed-93cd-6adab7e60c0f'::uuid,
    'ce8f51ee-837a-4e4f-9340-fe1835a5c97e'::uuid
  )
);

create policy time_clock_vinicius_insert on public.time_clock for insert
with check (
  auth.uid() = '9a3cacb3-ee0c-48ed-93cd-6adab7e60c0f'::uuid
  and profile_id = '9a3cacb3-ee0c-48ed-93cd-6adab7e60c0f'::uuid
);

-- Replace broad Storage policies with role- and folder-aware policies.
drop policy if exists storage_authenticated_read_luvig_buckets on storage.objects;
drop policy if exists storage_authenticated_upload_luvig_buckets on storage.objects;
drop policy if exists storage_admin_update_luvig_buckets on storage.objects;
drop policy if exists storage_admin_delete_luvig_buckets on storage.objects;
drop policy if exists storage_authenticated_read_employee_photos on storage.objects;
drop policy if exists storage_authenticated_upload_employee_photos on storage.objects;
drop policy if exists storage_admin_update_employee_photos on storage.objects;
drop policy if exists storage_admin_delete_employee_photos on storage.objects;
drop policy if exists storage_authenticated_read_documents on storage.objects;
drop policy if exists storage_authenticated_upload_documents on storage.objects;
drop policy if exists storage_authenticated_read_client_contracts on storage.objects;
drop policy if exists storage_authenticated_upload_client_contracts on storage.objects;
drop policy if exists storage_admin_update_client_contracts on storage.objects;
drop policy if exists storage_admin_delete_client_contracts on storage.objects;
drop policy if exists storage_luvig_role_read on storage.objects;
drop policy if exists storage_luvig_role_insert on storage.objects;
drop policy if exists storage_luvig_admin_update on storage.objects;
drop policy if exists storage_luvig_admin_delete on storage.objects;

create policy storage_luvig_role_read on storage.objects for select to authenticated
using (
  (bucket_id in ('employee-photos', 'documents', 'client-contracts') and (public.is_admin() or public.is_rh()))
  or (bucket_id = 'documents' and public.is_lider() and (storage.foldername(name))[1] = 'occurrences')
);

create policy storage_luvig_role_insert on storage.objects for insert to authenticated
with check (
  (bucket_id in ('employee-photos', 'documents', 'client-contracts') and (public.is_admin() or public.is_rh()))
  or (bucket_id = 'documents' and public.is_lider() and (storage.foldername(name))[1] = 'occurrences')
);

create policy storage_luvig_admin_update on storage.objects for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy storage_luvig_admin_delete on storage.objects for delete to authenticated
using (public.is_admin());

comment on table public.audit_logs is 'Rastreabilidade mínima de ações críticas do LUVIG Admin.';
