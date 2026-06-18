import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfileSwitcher() {
  const { description, profile, role } = useAuth();

  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-100">
        <ShieldCheck className="h-4 w-4" />
        Perfil de acesso
      </span>
      <p className="truncate text-sm font-black text-white">{profile?.full_name ?? 'Usuário LUVIG'}</p>
      <p className="mt-1 text-xs font-semibold text-blue-100">{role} · {description}</p>
    </div>
  );
}
