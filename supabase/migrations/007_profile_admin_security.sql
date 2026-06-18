-- Prevent privilege escalation through direct profile updates. Administrative
-- role and status changes go through a checked security-definer function.

create or replace function public.admin_update_profile(
  target_profile_id uuid,
  target_full_name text,
  target_company_position text,
  target_role text,
  target_status text,
  target_main_device text,
  target_linked_employee_id uuid,
  target_avatar_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Somente Admin pode alterar usuários e permissões.';
  end if;

  if target_role not in ('admin', 'rh', 'lider') then
    raise exception 'Perfil de acesso inválido.';
  end if;

  if target_status not in ('ativo', 'inativo') then
    raise exception 'Status inválido.';
  end if;

  if target_profile_id = auth.uid() and (target_role <> 'admin' or target_status <> 'ativo') then
    raise exception 'Você não pode remover o próprio acesso de Admin.';
  end if;

  if exists (
    select 1 from public.profiles
    where id = target_profile_id and role = 'admin' and status = 'ativo'
  ) and (target_role <> 'admin' or target_status <> 'ativo') and not exists (
    select 1 from public.profiles
    where id <> target_profile_id and role = 'admin' and status = 'ativo'
  ) then
    raise exception 'O sistema precisa manter pelo menos um Admin ativo.';
  end if;

  update public.profiles
  set full_name = target_full_name,
      company_position = nullif(target_company_position, ''),
      role = target_role,
      status = target_status,
      main_device = nullif(target_main_device, ''),
      linked_employee_id = target_linked_employee_id,
      avatar_url = nullif(target_avatar_url, ''),
      updated_at = now()
  where id = target_profile_id;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  return target_profile_id;
end;
$$;

revoke update on public.profiles from authenticated;
grant update (full_name, company_position, avatar_url, main_device, last_access_at) on public.profiles to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, text, uuid, text) to authenticated;

comment on function public.admin_update_profile(uuid, text, text, text, text, text, uuid, text)
is 'Atualiza perfil, role, status e vínculo de funcionário após validar que o chamador é Admin.';
