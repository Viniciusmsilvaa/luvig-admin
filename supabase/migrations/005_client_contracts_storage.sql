-- Private contract storage for clients/condominiums.

insert into storage.buckets (id, name, public)
values ('client-contracts', 'client-contracts', false)
on conflict (id) do update set public = false;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_authenticated_read_client_contracts'
  ) then
    create policy storage_authenticated_read_client_contracts
    on storage.objects for select to authenticated
    using (bucket_id = 'client-contracts');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_authenticated_upload_client_contracts'
  ) then
    create policy storage_authenticated_upload_client_contracts
    on storage.objects for insert to authenticated
    with check (bucket_id = 'client-contracts');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_admin_update_client_contracts'
  ) then
    create policy storage_admin_update_client_contracts
    on storage.objects for update to authenticated
    using (bucket_id = 'client-contracts' and public.is_admin())
    with check (bucket_id = 'client-contracts' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_admin_delete_client_contracts'
  ) then
    create policy storage_admin_delete_client_contracts
    on storage.objects for delete to authenticated
    using (bucket_id = 'client-contracts' and public.is_admin());
  end if;
end;
$$;
