import { Building2, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { clientStatusOptions, getClients } from '../services/clientService.js';
import { currencyBRL } from '../utils/formatters.js';

export default function Clientes() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [status, setStatus] = useState({ loading: true, error: '', usingFallback: false });

  const loadClients = useCallback(async () => {
    setStatus((current) => ({ ...current, loading: true, error: '' }));
    const result = await getClients();
    setClients(result.data || []);
    setStatus({ loading: false, error: result.error || '', usingFallback: Boolean(result.usingFallback) });
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return clients.filter((client) => {
      const searchable = `${client.name} ${client.manager} ${client.neighborhood} ${client.services}`.toLocaleLowerCase('pt-BR');
      return (!normalized || searchable.includes(normalized)) && (filter === 'todos' || client.statusValue === filter);
    });
  }, [clients, filter, query]);

  return (
    <div className="page-shell">
      <PageTitle
        title="Clientes / Condomínios"
        subtitle="Contratos, serviços, vencimentos e ocorrências dos condomínios."
        actions={<Link className="primary-button" to="/clientes/novo"><Plus className="h-5 w-5" /> Adicionar condomínio</Link>}
      />

      {location.state?.notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{location.state.notice}</div>}

      <section className="surface-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr,220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input className="input-base pl-12" placeholder="Pesquisar condomínio, responsável ou serviço" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="input-base" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="todos">Todos os status</option>
            {clientStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </section>

      {status.loading && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-luvig-blue">Carregando clientes...</div>}
      {!status.loading && status.error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{status.error}</span><button className="secondary-button" type="button" onClick={loadClients}>Tentar novamente</button>
        </div>
      )}

      {filteredClients.length ? (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client) => (
            <article key={client.id} className={`surface-card p-5 ${client.isInactive ? 'grayscale-[35%] opacity-80' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate text-lg font-black text-luvig-ink">{client.name}</h2><p className="text-sm font-semibold text-slate-500">{client.neighborhood || 'Bairro não informado'}</p></div>
                <StatusBadge status={client.status} />
              </div>
              <div className="mt-5 space-y-2 text-sm font-semibold text-slate-600">
                <p>Responsável: <strong className="text-luvig-ink">{client.manager || 'Não informado'}</strong></p>
                <p>Telefone: <strong className="text-luvig-ink">{client.phone || 'Não informado'}</strong></p>
                <p>Valor mensal: <strong className="text-luvig-ink">{isAdmin ? client.monthlyValue === null ? 'Não informado' : currencyBRL(client.monthlyValue) : 'Restrito ao Admin'}</strong></p>
                <p>Vencimento: <strong className="text-luvig-ink">{client.dueDay ? `Dia ${client.dueDay}` : 'Não informado'}</strong></p>
                <p>Serviços: <strong className="text-luvig-ink">{client.services || 'Nenhum serviço informado'}</strong></p>
              </div>
              <div className="mt-5 flex gap-2">
                <Link className="secondary-button flex-1" to={`/clientes/${client.id}`}>Ver</Link>
                <Link className="quiet-button flex-1" to={`/clientes/${client.id}/editar`}>Editar</Link>
              </div>
            </article>
          ))}
        </section>
      ) : !status.loading ? (
        <section className="surface-card flex min-h-56 flex-col items-center justify-center p-6 text-center">
          <Building2 className="h-10 w-10 text-slate-400" />
          <h2 className="mt-3 text-lg font-black text-luvig-ink">Nenhum condomínio encontrado</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Ajuste a pesquisa ou cadastre o primeiro cliente.</p>
        </section>
      ) : null}
    </div>
  );
}
