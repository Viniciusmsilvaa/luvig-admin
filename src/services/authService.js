import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { getFriendlyError, runQuery } from './serviceHelpers.js';

export function dbRoleToAppRole(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'rh') return 'RH';
  if (role === 'lider') return 'Líder';
  return null;
}

export function appRoleToDbRole(role) {
  if (role === 'Admin') return 'admin';
  if (role === 'RH') return 'rh';
  if (role === 'Líder') return 'lider';
  return null;
}

export async function signInWithPassword({ email, password, captchaToken }) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      data: null,
      error: 'Configure a VITE_SUPABASE_ANON_KEY no arquivo .env para usar login real.',
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  return { data, error: error ? getFriendlyError(error, 'Erro ao fazer login.') : null };
}

export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error: error ? getFriendlyError(error, 'Erro ao sair.') : null };
}

export async function getSession() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: { session: null }, error: null };
  }

  const { data, error } = await supabase.auth.getSession();
  return { data, error: error ? getFriendlyError(error, 'Erro ao verificar sessão.') : null };
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  return supabase.auth.onAuthStateChange(callback);
}

export async function getProfile(userId) {
  if (!userId) {
    return { data: null, error: null, usingFallback: false };
  }

  return runQuery(
    (client) => client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    null,
    'Erro ao carregar perfil do usuário.',
  );
}

export async function updateLastAccess(profileId) {
  if (!profileId) return { data: null, error: null };

  return runQuery(
    (client) =>
      client
        .from('profiles')
        .update({ last_access_at: new Date().toISOString() })
        .eq('id', profileId)
        .select()
        .maybeSingle(),
    null,
    'Erro ao atualizar último acesso.',
  );
}
