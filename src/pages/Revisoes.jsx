import { CheckSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { listOccurrences } from '../services/occurrenceService.js';
import { shortDate } from '../utils/formatters.js';

export default function Revisoes() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let active = true;
    listOccurrences().then((result) => {
      if (!active) return;
      setItems((result.data || []).filter((item) => ['aguardando_conferencia', 'recomendado_pelo_rh'].includes(item.statusValue)));
      setState({ loading: false, error: result.error || '' });
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="page-shell">
      <PageTitle title="Revisões" subtitle="Ocorrências reais aguardando conferência administrativa." />
      {(state.loading || state.error) && <div className={`rounded-2xl border p-4 text-sm font-bold ${state.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{state.loading ? 'Carregando revisões...' : state.error}</div>}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="surface-card p-5">
            <div className="flex items-start justify-between gap-3"><CheckSquare className="h-8 w-8 text-luvig-blue" /><StatusBadge status={item.status} /></div>
            <h2 className="mt-4 text-lg font-black text-luvig-ink">{item.title}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">{item.employee} · {shortDate(item.date)}</p>
            <Link className="secondary-button mt-5 w-full" to="/rh">Conferir na Central</Link>
          </article>
        ))}
        {!state.loading && !state.error && !items.length && <div className="surface-card p-8 text-center text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">Nenhuma revisão pendente.</div>}
      </section>
    </div>
  );
}
