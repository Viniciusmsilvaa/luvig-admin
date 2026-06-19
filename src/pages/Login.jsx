import { LockKeyhole, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark.jsx';
import TurnstileCaptcha from '../components/TurnstileCaptcha.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isCaptchaConfigured } from '../services/captchaService.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authError, authLoading, isAuthenticated, isSupabaseConfigured, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    }
  }, [isAuthenticated, location.state?.from, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLocalError('');

    if (!isSupabaseConfigured) {
      setLocalError('Configure a VITE_SUPABASE_ANON_KEY no arquivo .env para usar login real.');
      return;
    }

    if (!email || !password) {
      setLocalError('Informe e-mail e senha.');
      return;
    }

    if (!captchaToken) {
      setLocalError('Confirme que você não é um robô.');
      return;
    }

    const submittedCaptchaToken = captchaToken;
    setCaptchaToken('');
    const result = await login({ email, password, captchaToken: submittedCaptchaToken });
    if (result.ok) {
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } else {
      setCaptchaResetKey((value) => value + 1);
    }
  }

  const visibleError = localError || authError;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#0a74d9_0,#0756a6_34%,#171923_100%)] px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-white/20 bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark size="lg" />
          <h1 className="mt-4 text-3xl font-black text-luvig-ink">LUVIG Admin</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Acesso administrativo interno</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            Supabase ainda não configurado. Preencha a anon key no arquivo .env e reinicie o servidor.
          </div>
        )}

        {visibleError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {visibleError}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="field-label">E-mail</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="input-base pl-12"
                type="email"
                autoComplete="username"
                placeholder="admin@luvig.com.br"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <span className="field-label">Senha</span>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="input-base pl-12"
                type="password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </label>

          <TurnstileCaptcha
            resetKey={captchaResetKey}
            onToken={(token) => { setCaptchaToken(token); setLocalError(''); }}
            onExpired={() => { setCaptchaToken(''); setLocalError('O CAPTCHA expirou. Valide novamente.'); }}
            onError={() => { setCaptchaToken(''); setLocalError('Não foi possível validar o CAPTCHA.'); }}
          />
          {!captchaToken && isCaptchaConfigured() && !visibleError && <p className="text-center text-xs font-semibold text-slate-500">Confirme que você não é um robô.</p>}

          <button className="primary-button w-full" type="submit" disabled={authLoading || !captchaToken || !isCaptchaConfigured()}>
            {authLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
