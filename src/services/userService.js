import { dbRoleToAppRole } from './authService.js';
import { runQuery } from './serviceHelpers.js';

export const profileRoleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'rh', label: 'RH' },
  { value: 'lider', label: 'Líder' },
];

export const profileStatusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'LU';
}

export function mapProfileFromDb(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.company_position || 'Sem função definida',
    companyPosition: row.company_position || '',
    access: dbRoleToAppRole(row.role),
    roleValue: row.role,
    status: row.status === 'ativo' ? 'Ativo' : 'Inativo',
    statusValue: row.status,
    lastAccess: row.last_access_at ? new Date(row.last_access_at).toLocaleString('pt-BR') : 'Sem acesso registrado',
    lastAccessAt: row.last_access_at,
    device: row.main_device || 'Não informado',
    mainDevice: row.main_device || '',
    avatar: initials(row.full_name),
    avatarUrl: row.avatar_url || '',
    linkedEmployeeId: row.linked_employee_id || '',
    linkedEmployee: row.employees?.full_name || 'Não vinculado',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProfileInput(data, current = {}) {
  const hasLinkedEmployee = Object.prototype.hasOwnProperty.call(data, 'linked_employee_id')
    || Object.prototype.hasOwnProperty.call(data, 'linkedEmployeeId');
  return {
    full_name: data.full_name ?? data.name ?? current.name ?? '',
    company_position: data.company_position ?? data.companyPosition ?? current.companyPosition ?? '',
    role: data.access_role ?? data.roleValue ?? current.roleValue ?? 'lider',
    status: data.status ?? data.statusValue ?? current.statusValue ?? 'ativo',
    main_device: data.main_device ?? data.mainDevice ?? current.mainDevice ?? '',
    linked_employee_id: hasLinkedEmployee
      ? (data.linked_employee_id || data.linkedEmployeeId || null)
      : (current.linkedEmployeeId || null),
    avatar_url: data.avatar_url ?? data.avatarUrl ?? current.avatarUrl ?? '',
  };
}

export async function getUsers() {
  return runQuery(
    (client) =>
      client
        .from('profiles')
        .select('*, employees!profiles_linked_employee_id_fkey(full_name)')
        .order('full_name', { ascending: true }),
    [],
    'Erro ao carregar usuários.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map(mapProfileFromDb),
  }));
}

export const listUsers = getUsers;

export async function getUserProfile(id) {
  return runQuery(
    (client) =>
      client
        .from('profiles')
        .select('*, employees!profiles_linked_employee_id_fkey(full_name)')
        .eq('id', id)
        .maybeSingle(),
    null,
    'Erro ao carregar usuário.',
  ).then((result) => ({
    ...result,
    data: result.data ? mapProfileFromDb(result.data) : null,
  }));
}

export async function getUserProfileByEmail(email) {
  return runQuery(
    (client) =>
      client
        .from('profiles')
        .select('*, employees!profiles_linked_employee_id_fkey(full_name)')
        .ilike('email', email.trim())
        .maybeSingle(),
    null,
    'Erro ao localizar perfil pelo e-mail.',
  ).then((result) => ({
    ...result,
    data: result.data ? mapProfileFromDb(result.data) : null,
  }));
}

export async function updateUserProfile(id, data, currentProfile = null) {
  const currentResult = currentProfile ? { data: currentProfile, error: null } : await getUserProfile(id);
  if (currentResult.error || !currentResult.data) {
    return { data: null, error: currentResult.error || 'Usuário não encontrado.', usingFallback: false };
  }
  const payload = normalizeProfileInput(data, currentResult.data);
  const rpcResult = await runQuery(
    (client) => client.rpc('admin_update_profile', {
      target_profile_id: id,
      target_full_name: payload.full_name,
      target_company_position: payload.company_position,
      target_role: payload.role,
      target_status: payload.status,
      target_main_device: payload.main_device,
      target_linked_employee_id: payload.linked_employee_id,
      target_avatar_url: payload.avatar_url,
    }),
    null,
    'Erro ao atualizar usuário.',
  );
  if (rpcResult.error) return rpcResult;
  return getUserProfile(id);
}

export async function configureExistingUserProfile(email, data) {
  const existing = await getUserProfileByEmail(email);
  if (existing.error) return existing;
  if (!existing.data) {
    return {
      data: null,
      error: 'Perfil não encontrado. Crie primeiro o usuário no Supabase Auth e confirme que o trigger de profiles está ativo.',
      usingFallback: false,
    };
  }
  return updateUserProfile(existing.data.id, data, existing.data);
}

export function activateUser(user) {
  return updateUserProfile(user.id, { status: 'ativo' }, user);
}

export function deactivateUser(user) {
  return updateUserProfile(user.id, { status: 'inativo' }, user);
}

export function unlinkUserEmployee(user) {
  return updateUserProfile(user.id, { linked_employee_id: null }, { ...user, linkedEmployeeId: null });
}
