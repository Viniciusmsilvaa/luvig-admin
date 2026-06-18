import { ArrowDownCircle, ArrowUpCircle, Boxes, CreditCard, DollarSign, Fuel, Plus, Receipt, Shirt, Users, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { currentMonth, getFinancialSummary } from '../services/financeService.js';
import { currencyBRL, shortDate } from '../utils/formatters.js';

const emptySummary = {
  entriesTotal: 0,
  expensesTotal: 0,
  balance: 0,
  pendingClients: 0,
  pendingEntries: [],
  monthlyFees: 0,
  extraServices: 0,
  payroll: 0,
  termination: 0,
  fuel: 0,
  equipment: 0,
  uniforms: 0,
  products: 0,
};

export default function Financeiro() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(emptySummary);
  const [status, setStatus] = useState({ loading: true, error: '', usingFallback: false });

  const loadFinance = useCallback(async () => {
    setStatus({ loading: true, error: '', usingFallback: false });
    const result = await getFinancialSummary(month);
    setSummary(result.data || emptySummary);
    setStatus({ loading: false, error: result.error || '', usingFallback: Boolean(result.usingFallback) });
  }, [month]);

  useEffect(() => { loadFinance(); }, [loadFinance]);

  const cards = [
    { label: 'Entradas do mês', value: summary.entriesTotal, icon: ArrowUpCircle, tone: 'green' },
    { label: 'Saídas do mês', value: summary.expensesTotal, icon: ArrowDownCircle, tone: 'red' },
    { label: 'Saldo estimado', value: summary.balance, icon: DollarSign, tone: 'slate' },
    { label: 'Clientes pendentes', value: summary.pendingClients, icon: Users, tone: 'amber', count: true },
    { label: 'Mensalidades recebidas', value: summary.monthlyFees, icon: Receipt, tone: 'green' },
    { label: 'Serviços extras recebidos', value: summary.extraServices, icon: Plus, tone: 'cyan' },
    { label: 'Gastos com folha', value: summary.payroll, icon: Wallet, tone: 'blue' },
    { label: 'Gastos com rescisão', value: summary.termination, icon: Receipt, tone: 'slate' },
    { label: 'Gastos com combustível', value: summary.fuel, icon: Fuel, tone: 'orange' },
    { label: 'Gastos com equipamentos', value: summary.equipment, icon: CreditCard, tone: 'cyan' },
    { label: 'Gastos com uniformes', value: summary.uniforms, icon: Shirt, tone: 'blue' },
    { label: 'Gastos com produtos', value: summary.products, icon: Boxes, tone: 'amber' },
  ];

  return (
    <div className="page-shell">
      <PageTitle
        title="Financeiro"
        subtitle="Resumo simples de receitas, despesas e cobranças pendentes."
        actions={<div className="flex flex-wrap gap-2"><Link className="secondary-button" to="/financeiro/entradas">Ver entradas</Link><Link className="secondary-button" to="/financeiro/saidas">Ver saídas</Link></div>}
      />

      <section className="surface-card max-w-xs p-4"><FormInput label="Mês de referência" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></section>

      {(status.loading || status.error) && <div className={`rounded-2xl border p-4 text-sm font-bold ${status.error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{status.loading ? 'Carregando financeiro...' : status.error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => <StatCard key={card.label} label={card.label} value={card.count ? card.value : currencyBRL(card.value)} icon={card.icon} tone={card.tone} />)}
      </section>

      <section className="surface-card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-black text-luvig-ink">Clientes pendentes</h2><p className="text-sm font-semibold text-slate-500">Cobranças pendentes ou atrasadas.</p></div>
          <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-black text-amber-800">{summary.pendingEntries.length} cobranças</span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {summary.pendingEntries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-luvig-blue">{entry.client}</p><h3 className="mt-1 font-black text-luvig-ink">{entry.title}</h3></div><StatusBadge status={entry.status} /></div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-500"><span>{currencyBRL(entry.amount)}</span><span>Vence: {shortDate(entry.dueDate)}</span>{entry.daysLate > 0 && <span className="font-black text-red-700">{entry.daysLate} dias em atraso</span>}</div>
            </article>
          ))}
          {!summary.pendingEntries.length && !status.loading && <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500 lg:col-span-2">Nenhuma cobrança pendente.</div>}
        </div>
      </section>

      <section className="surface-card flex flex-col gap-3 p-5 sm:flex-row">
        <Link className="primary-button" to="/financeiro/entradas"><Plus className="h-5 w-5" /> Adicionar entrada</Link>
        <Link className="secondary-button" to="/financeiro/saidas"><Plus className="h-5 w-5" /> Adicionar saída</Link>
      </section>
    </div>
  );
}
