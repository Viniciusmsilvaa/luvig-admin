import { LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AccessDenied() {
  const { role } = useAuth();

  return (
    <div className="page-shell">
      <section className="surface-card flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-700">
          <LockKeyhole className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-luvig-ink">Acesso não permitido para este perfil.</h1>
        <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
          O perfil {role} não possui permissão para acessar esta área.
        </p>
        <Link className="primary-button mt-6" to="/dashboard">
          Voltar ao dashboard
        </Link>
      </section>
    </div>
  );
}
