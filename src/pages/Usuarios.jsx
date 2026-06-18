import { Link2Off, Pencil, Plus, Search, UserCheck, UserX, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { activateUser, deactivateUser, getUsers, unlinkUserEmployee } from '../services/userService.js';

export default function Usuarios() {
  const { profile } = useAuth();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState({ text: location.state?.notice || '', error: false });
  const [status, setStatus] = useState({ loading: true, error: '', usingFallback: false });

  const loadUsers = useCallback(async () => {
    setStatus((current) => ({ ...current, loading: true, error: '' }));
    const result = await getUsers();
    setUsers(result.data || []);
    setStatus({ loading: false, error: result.error || '', usingFallback: Boolean(result.usingFallback) });
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return users.filter((user) => !normalized || `${user.name} ${user.email} ${user.role} ${user.access}`.toLocaleLowerCase('pt-BR').includes(normalized));
  }, [query, users]);

  async function handleStatus(user) {
    const activating = user.statusValue === 'inativo';
    if (!window.confirm(`Tem certeza que deseja ${activating ? 'ativar' : 'desativar'} o acesso de ${user.name}?`)) return;
    const result = activating ? await activateUser(user) : await deactivateUser(user);
    setMessage({ text: result.error || `Usuário ${activating ? 'ativado' : 'desativado'} com sucesso.`, error: Boolean(result.error) });
    if (!result.error) await loadUsers();
  }

  async function handleUnlink(user) {
    if (!window.confirm(`Tem certeza que deseja remover o vínculo de ${user.name} com o funcionário?`)) return;
    const result = await unlinkUserEmployee(user);
    setMessage({ text: result.error || 'Vínculo com funcionário removido.', error: Boolean(result.error) });
    if (!result.error) await loadUsers();
  }

  return (
    <div className="page-shell">
      <PageTitle title="Usuários" subtitle="Profiles, permissões e vínculos dos acessos do sistema." actions={<Link className="primary-button" to="/usuarios/novo"><Plus className="h-5 w-5" /> Configurar usuário</Link>} />

      {message.text && <div className={`rounded-2xl border p-4 text-sm font-bold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}

      <section className="surface-card p-4"><label className="relative block"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input className="input-base pl-12" placeholder="Pesquisar nome, e-mail, função ou perfil" value={query} onChange={(event) => setQuery(event.target.value)} /></label></section>

      {(status.loading || status.error) && <div className={`rounded-2xl border p-4 text-sm font-bold ${status.error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{status.loading ? 'Carregando usuários...' : status.error}</div>}

      <section className="grid gap-4 lg:grid-cols-2">
        {visibleUsers.map((user) => (
          <article key={user.id} className={`surface-card p-5 ${user.statusValue === 'inativo' ? 'grayscale-[35%] opacity-80' : ''}`}>
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-luvig-ink text-sm font-black text-white">{user.avatarUrl ? <img className="h-full w-full object-cover" src={user.avatarUrl} alt={`Avatar de ${user.name}`} /> : user.avatar}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h2 className="truncate text-lg font-black text-luvig-ink">{user.name}</h2><p className="truncate text-sm font-semibold text-slate-500">{user.email}</p></div><StatusBadge status={user.status} /></div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <Info label="Função na empresa" value={user.role} />
                  <Info label="Perfil de acesso" value={user.access} />
                  <Info label="Último acesso" value={user.lastAccess} />
                  <Info label="Dispositivo principal" value={user.device} />
                  <Info label="Funcionário vinculado" value={user.linkedEmployee} wide />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="secondary-button" to={`/usuarios/${user.id}/editar`}><Pencil className="h-4 w-4" /> Editar</Link>
                  <button className="secondary-button" type="button" disabled={user.id === profile?.id && user.statusValue === 'ativo'} onClick={() => handleStatus(user)}>{user.statusValue === 'inativo' ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />} {user.statusValue === 'inativo' ? 'Ativar' : 'Desativar'}</button>
                  {user.linkedEmployeeId && <button className="secondary-button" type="button" onClick={() => handleUnlink(user)}><Link2Off className="h-4 w-4" /> Remover vínculo</button>}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!visibleUsers.length && !status.loading && <section className="surface-card flex min-h-56 flex-col items-center justify-center p-6 text-center"><UsersRound className="h-10 w-10 text-slate-400" /><h2 className="mt-3 text-lg font-black text-luvig-ink">Nenhum usuário encontrado</h2></section>}
    </div>
  );
}

function Info({ label, value, wide = false }) {
  return <div className={`rounded-xl bg-slate-50 p-3 ${wide ? 'sm:col-span-2' : ''}`}><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-black text-luvig-ink">{value}</p></div>;
}
