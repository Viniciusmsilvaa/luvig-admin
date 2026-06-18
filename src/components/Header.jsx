import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LogoMark from './LogoMark.jsx';

export default function Header({ onOpenMobileMenu }) {
  const navigate = useNavigate();
  const { authLoading, logout, profile, role } = useAuth();

  async function handleLogout() {
    const result = await logout();
    if (result.ok) {
      navigate('/login', { replace: true });
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="quiet-button px-3 md:hidden"
            onClick={onOpenMobileMenu}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <LogoMark size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-luvig-ink">LUVIG Admin</p>
            <p className="truncate text-xs font-medium text-slate-500">{profile?.full_name ?? 'Painel interno'} · {role}</p>
          </div>
        </div>
        <button className="secondary-button px-3" type="button" onClick={handleLogout} disabled={authLoading}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
