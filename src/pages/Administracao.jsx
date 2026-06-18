import { Bell, ClipboardCheck, FileText, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';
import StatCard from '../components/StatCard.jsx';
import { listApprovalRequests } from '../services/approvalService.js';
import { listNotices } from '../services/noticeService.js';
import { listOccurrences } from '../services/occurrenceService.js';
import { listRequests } from '../services/requestService.js';

const accessCards = [
  { title: 'Pedidos', to: '/administracao/pedidos', icon: ClipboardCheck },
  { title: 'Pendências', to: '/administracao/pendencias', icon: ListChecks },
  { title: 'Revisões', to: '/administracao/revisoes', icon: FileText },
  { title: 'Avisos', to: '/administracao/avisos', icon: Bell },
];

export default function Administracao() {
  const [summary, setSummary] = useState({ requests: 0, approvals: 0, reviews: 0, notices: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listRequests(), listApprovalRequests(), listOccurrences(), listNotices()]).then(([requests, approvals, occurrences, notices]) => {
      if (!active) return;
      setSummary({
        requests: (requests.data || []).filter((item) => ['pendente', 'em_analise'].includes(item.statusValue)).length,
        approvals: (approvals.data || []).filter((item) => item.statusValue === 'pendente').length,
        reviews: (occurrences.data || []).filter((item) => ['aguardando_conferencia', 'recomendado_pelo_rh'].includes(item.statusValue)).length,
        notices: (notices.data || []).filter((item) => ['ativo', 'programado'].includes(item.statusValue)).length,
      });
      setError(requests.error || approvals.error || occurrences.error || notices.error || '');
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="page-shell">
      <PageTitle title="Administração" subtitle="Pedidos, pendências, revisões e avisos internos." />
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accessCards.map((card) => (
          <Link key={card.title} to={card.to} className="surface-card p-5 transition hover:border-luvig-sky hover:shadow-soft">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-luvig-light text-luvig-blue"><card.icon className="h-6 w-6" /></div>
            <h2 className="mt-5 text-xl font-black text-luvig-ink">{card.title}</h2>
          </Link>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pedidos pendentes" value={summary.requests} icon={ClipboardCheck} tone="amber" />
        <StatCard label="Solicitações RH" value={summary.approvals} icon={ListChecks} tone="red" />
        <StatCard label="Revisões pendentes" value={summary.reviews} icon={FileText} tone="blue" />
        <StatCard label="Avisos ativos" value={summary.notices} icon={Bell} tone="green" />
      </section>
    </div>
  );
}
