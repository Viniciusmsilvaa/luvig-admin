import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

export function getFriendlyError(error, fallback = 'Erro ao carregar dados.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const message = error.message ?? fallback;

  if (/invalid login credentials/i.test(message)) {
    return 'E-mail ou senha incorretos.';
  }

  if (/invalid.*captcha|captcha.*invalid|captcha verification.*failed/i.test(message)) {
    return 'Não foi possível validar o CAPTCHA.';
  }

  if (/captcha/i.test(message)) {
    return 'Não foi possível validar o CAPTCHA.';
  }

  if (/failed to fetch|network/i.test(message)) {
    return 'Erro ao conectar com a autenticação.';
  }

  if (/jwt|permission|rls|row-level/i.test(message)) {
    return 'Sem permissão para realizar esta ação.';
  }

  if (/relation .* does not exist|schema cache/i.test(message)) {
    return 'As tabelas do Supabase ainda não foram aplicadas.';
  }

  return message;
}

export async function runQuery(operation, emptyData = null, fallbackMessage = 'Falha ao carregar.') {
  if (!isSupabaseConfigured || !supabase) {
    return {
      data: emptyData,
      error: 'Supabase ainda não configurado. Preencha VITE_SUPABASE_ANON_KEY no .env.',
      usingFallback: false,
    };
  }

  try {
    const result = await operation(supabase);
    if (result?.error) {
      throw result.error;
    }

    return {
      data: result?.data ?? emptyData,
      error: null,
      usingFallback: false,
    };
  } catch (error) {
    return {
      data: emptyData,
      error: getFriendlyError(error, fallbackMessage),
      usingFallback: false,
    };
  }
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeDate(value) {
  if (!value) return null;
  return value;
}

export function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
}
