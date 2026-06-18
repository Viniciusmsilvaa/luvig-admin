import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasPermission, roleDescriptions } from '../auth/permissions.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  dbRoleToAppRole,
  getProfile,
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signOut,
  updateLastAccess,
} from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return null;
    }

    const result = await getProfile(user.id);

    if (result.error) {
      setAuthError(result.error);
      setProfile(null);
      await signOut();
      setSession(null);
      return null;
    }

    if (!result.data) {
      setAuthError('Perfil de acesso não configurado. Procure um administrador.');
      setProfile(null);
      await signOut();
      setSession(null);
      return null;
    }

    if (result.data?.status === 'inativo') {
      setProfile(result.data);
      setAuthError('Acesso desativado. Procure um administrador.');
      await signOut();
      setSession(null);
      return null;
    }

    const nextProfile = result.data;
    setProfile(nextProfile);
    await updateLastAccess(user.id);
    return nextProfile;
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      setLoading(true);
      const { data, error } = await getSession();

      if (!active) return;

      if (error) {
        setAuthError(error);
      }

      const nextSession = data?.session ?? null;
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user);
      }
      setLoading(false);
    }

    bootstrapSession();

    const { data } = onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  async function login({ email, password, captchaToken }) {
    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await signInWithPassword({ email, password, captchaToken });

    if (error) {
      setAuthError(error);
      setAuthLoading(false);
      return { ok: false, error };
    }

    const nextSession = data?.session ?? null;
    setSession(nextSession);
    if (nextSession?.user) {
      const loadedProfile = await loadProfile(nextSession.user);
      if (!loadedProfile) {
        setAuthLoading(false);
        return { ok: false, error: 'Não foi possível validar seu perfil de acesso.' };
      }
    }
    setAuthLoading(false);
    return { ok: true };
  }

  async function logout() {
    setAuthLoading(true);
    const { error } = await signOut();
    setSession(null);
    setProfile(null);
    setAuthLoading(false);
    if (error) {
      setAuthError(error);
      return { ok: false, error };
    }
    return { ok: true };
  }

  const role = dbRoleToAppRole(profile?.role);
  const isAuthenticated = Boolean(session);

  const value = useMemo(
    () => ({
      authError,
      authLoading,
      can: (permission) => hasPermission(role, permission),
      description: roleDescriptions[role],
      isAdmin: role === 'Admin',
      isAuthenticated,
      isLeader: role === 'Líder',
      isRH: role === 'RH',
      isSupabaseConfigured,
      loading,
      login,
      logout,
      profile,
      role,
      session,
      user: session?.user ?? null,
    }),
    [authError, authLoading, isAuthenticated, loading, profile, role, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
