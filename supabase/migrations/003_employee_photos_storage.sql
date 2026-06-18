-- Ensures the private employee photo bucket exists without changing the
-- access model already established by the initial schema.

insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', false)
on conflict (id) do update
set public = false;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_authenticated_read_employee_photos'
  ) then
    create policy storage_authenticated_read_employee_photos
    on storage.objects for select
    to authenticated
    using (bucket_id = 'employee-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_authenticated_upload_employee_photos'
  ) then
    create policy storage_authenticated_upload_employee_photos
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'employee-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_admin_update_employee_photos'
  ) then
    create policy storage_admin_update_employee_photos
    on storage.objects for update
    to authenticated
    using (bucket_id = 'employee-photos' and public.is_admin())
    with check (bucket_id = 'employee-photos' and public.is_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_admin_delete_employee_photos'
  ) then
    create policy storage_admin_delete_employee_photos
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'employee-photos' and public.is_admin());
  end if;
end;
$$;
