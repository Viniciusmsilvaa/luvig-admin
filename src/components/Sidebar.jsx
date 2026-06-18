import {
  Building2,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardList,
  DollarSign,
  FolderArchive,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Timer,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { filterByRole } from '../auth/permissions.js';
import { getTimeClockAccess } from '../auth/accessRules.js';
import { useAuth } from '../context/AuthContext.jsx';
import LogoMark from './LogoMark.jsx';
import ProfileSwitcher from './ProfileSwitcher.jsx';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'RH', 'Líder'] },
  { label: 'Relatórios', to: '/relatorios', icon: ChartNoAxesCombined, roles: ['Admin', 'RH'] },
  { label: 'Documentos', to: '/documentos', icon: FolderArchive, roles: ['Admin', 'RH'] },
  { label: 'Funcionários', to: '/funcionarios', icon: Users, roles: ['Admin', 'RH'] },
  { label: 'Central RH/Admin', to: '/rh', icon: ShieldCheck, roles: ['Admin', 'RH'] },
  { label: 'Liderança', to: '/lideranca', icon: ClipboardList, roles: ['Admin', 'RH', 'Líder'] },
  { label: 'Administração', to: '/administracao', icon: UserCog, roles: ['Admin', 'RH'] },
  { label: 'Pedidos', to: '/administracao/pedidos', icon: ClipboardList, roles: ['Líder'] },
  { label: 'Avisos', to: '/administracao/avisos', icon: ShieldCheck, roles: ['Líder'] },
  { label: 'Financeiro', to: '/financeiro', icon: DollarSign, roles: ['Admin'] },
  { label: 'Clientes', to: '/clientes', icon: Building2, roles: ['Admin', 'RH'] },
  { label: 'Usuários', to: '/usuarios', icon: UserCog, roles: ['Admin'] },
  { label: 'Meu Ponto', to: '/meu-ponto', icon: Timer, roles: ['Admin', 'RH', 'Líder'] },
  { label: 'Configurações', to: '/configuracoes', icon: Settings, roles: ['Admin', 'RH'] },
];

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapsed }) {
  const { profile, role, user } = useAuth();
  const timeClockAccess = getTimeClockAccess(profile, user);
  const visibleItems = filterByRole(navItems, role).filter((item) => item.to !== '/meu-ponto' || timeClockAccess.canView);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-luvig-ink text-white shadow-2xl transition-all duration-300 md:sticky md:top-0 md:translate-x-0 md:shadow-none ${
        collapsed ? 'md:w-20' : 'md:w-72'
      } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} w-72`}
    >
      <div className={`flex h-20 items-center border-b border-white/10 px-4 ${collapsed ? 'md:justify-center' : 'justify-between gap-3'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'md:hidden' : ''}`}>
          <LogoMark size="sm" />
          <div className="min-w-0 transition-opacity">
            <p className="truncate text-sm font-black">LUVIG Admin</p>
            <p className="truncate text-xs text-blue-100">LUVIG Serviços</p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-blue-100 transition hover:bg-white/10 hover:text-white md:hidden"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          type="button"
          className={`hidden h-10 w-10 items-center justify-center rounded-xl text-blue-100 transition hover:bg-white/10 hover:text-white md:inline-flex ${
            collapsed ? 'md:flex' : ''
          }`}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Abrir menu' : 'Recolher menu'}
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            title={item.label}
            className={({ isActive }) =>
              [
                'group flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition',
                collapsed ? 'md:justify-center' : '',
                isActive
                  ? 'bg-white text-luvig-blue shadow-sm'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={`border-t border-white/10 p-4 ${collapsed ? 'md:hidden' : ''}`}>
        <div className={collapsed ? 'md:hidden' : ''}>
          <ProfileSwitcher />
        </div>
      </div>
    </aside>
  );
}
