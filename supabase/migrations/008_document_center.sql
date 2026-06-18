-- Document center compatibility. Existing permissions and buckets are preserved.

alter table public.documents
  drop constraint if exists documents_type_check;

alter table public.documents
  add constraint documents_type_check check (
    type in (
      'atestado',
      'advertencia',
      'suspensao',
      'contrato',
      'rescisao',
      'documento_pessoal',
      'contrato_condominio',
      'outro'
    )
  );

create index if not exists idx_documents_employee_id on public.documents(employee_id);
create index if not exists idx_documents_client_id on public.documents(client_id);
create index if not exists idx_documents_type on public.documents(type);
create index if not exists idx_documents_status on public.documents(status);

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('client-contracts', 'client-contracts', false)
on conflict (id) do update set public = false;

