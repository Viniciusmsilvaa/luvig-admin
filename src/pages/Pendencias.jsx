import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { listApprovalRequests } from '../services/approvalService.js';
import { listRequests } from '../services/requestService.js';
import { shortDate } from '../utils/formatters.js';

export default function Pendencias() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let active = true;
    Promise.all([listRequests(), listApprovalRequests()]).then(([requests, approvals]) => {
      if (!active) return;
      const requestItems = (requests.data || []).filter((item) => ['pendente', 'em_analise'].includes(item.statusValue)).map((item) => ({ id: `request-${item.id}`, title: item.title, owner: item.requester, date: item.date, status: item.status, priority: item.urgency || 'normal' }));
      const approvalItems = (approvals.data || []).filter((item) => item.statusValue === 'pendente').map((item) => ({ id: `approval-${item.id}`, title: item.title, owner: item.requester, date: item.date, status: item.status, priority: 'administrativa' }));
      setItems([...requestItems, ...approvalItems]);
      setState({ loading: false, error: requests.error || approvals.error || '' });
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="page-shell">
      <PageTitle title="Pendências" subtitle="Pedidos e solicitações reais aguardando tratamento." />
      {(state.loading || state.error) && <div className={`rounded-2xl border p-4 text-sm font-bold ${state.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{state.loading ? 'Carregando pendências...' : state.error}</div>}
      <section className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="surface-card p-5">
            <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-black text-luvig-ink">{item.title}</h2><StatusBadge status={item.status} /></div>
            <div className="mt-5 space-y-3 text-sm font-semibold text-slate-600">
              <p>Responsável: <strong className="text-luvig-ink">{item.owner}</strong></p>
              <p>Recebido em: <strong className="text-luvig-ink">{shortDate(item.date)}</strong></p>
              <p>Prioridade: <strong className="capitalize text-luvig-ink">{item.priority}</strong></p>
            </div>
          </article>
        ))}
        {!state.loading && !state.error && !items.length && <div className="surface-card p-8 text-center text-sm font-semibold text-slate-500 lg:col-span-3">Nenhuma pendência em aberto.</div>}
      </section>
    </div>
  );
}
