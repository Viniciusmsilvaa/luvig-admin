import {
  Activity, BriefcaseBusiness, Building2, CalendarDays, Download, FileSpreadsheet, FileText,
  HeartPulse, Receipt, Star, Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardSkeleton from '../components/DashboardSkeleton.jsx';
import GlobalReportFilters, { initialReportFilters } from '../components/GlobalReportFilters.jsx';
import PageTitle from '../components/PageTitle.jsx';
import SimpleBarChart from '../components/SimpleBarChart.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { exportReportExcel, exportReportPdf, getReport, getReportOptions, reportLabels, subscribeReports } from '../services/reportService.js';
import { currencyBRL } from '../utils/formatters.js';

const reports = [
  { id: 'employees', title: 'Funcionários', description: 'Quadro, status e tempo de casa', icon: Users, roles: ['Admin', 'RH'] },
  { id: 'occurrences', title: 'Ocorrências', description: 'Tipos, responsáveis e situação', icon: Activity, roles: ['Admin', 'RH'] },
  { id: 'scores', title: 'Notas', description: 'Ranking, atenção e evolução', icon: Star, roles: ['Admin', 'RH'] },
  { id: 'vacations', title: 'Férias', description: 'Em férias, próximas e retornos', icon: CalendarDays, roles: ['Admin', 'RH'] },
  { id: 'medical', title: 'Atestados', description: 'Afastamentos e retornos', icon: HeartPulse, roles: ['Admin', 'RH'] },
  { id: 'clients', title: 'Clientes', description: 'Contratos e situação cadastral', icon: Building2, roles: ['Admin', 'RH'] },
  { id: 'financial', title: 'Financeiro', description: 'Entradas, saídas e pendências', icon: Receipt, roles: ['Admin'] },
];

const filterVisibility = {
  employees: { employee: true, status: true, role: true }, occurrences: { employee: true, status: true, type: true },
  scores: { employee: true, role: true }, vacations: { employee: true, status: true, role: true },
  medical: { employee: true, status: true, role: true }, clients: { client: true, status: true }, financial: { client: true, status: true },
};

const tableTitles = {
  ranking: '#', name: 'Nome', role: 'Função', score: 'Nota', attention: 'Situação', status: 'Status', tenure: 'Tempo de casa',
  type: 'Tipo', employee: 'Funcionário', date: 'Data', responsible: 'Responsável', nextVacation: 'Próximas férias',
  returnDate: 'Retorno previsto', condominium: 'Condomínio', monthlyValue: 'Valor mensal', services: 'Serviços contratados',
  movement: 'Movimento', description: 'Descrição', client: 'Cliente', value: 'Valor',
};

export default function Relatorios() {
  const { role } = useAuth();
  const visibleReports = useMemo(() => reports.filter((item) => item.roles.includes(role)), [role]);
  const [active, setActive] = useState('employees');
  const [filters, setFilters] = useState(initialReportFilters);
  const [options, setOptions] = useState({ employees: [], clients: [] });
  const [result, setResult] = useState({ data: [], chart: [], error: null });
  const [state, setState] = useState({ loading: true, exporting: '', exportError: '' });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState((current) => ({ ...current, loading: true }));
    const response = await getReport(active, filters, role);
    setResult(response);
    setState((current) => ({ ...current, loading: false }));
  }, [active, filters, role]);

  useEffect(() => { getReportOptions({ role }).then((response) => setOptions(response.data)); }, [role]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribeReports({ role, onChange: () => load(true) }), [role, load]);

  function selectReport(id) { setActive(id); setFilters(initialReportFilters); setState((current) => ({ ...current, exportError: '' })); }
  async function exportFile(format) {
    setState((current) => ({ ...current, exporting: format, exportError: '' }));
    try {
      if (format === 'pdf') await exportReportPdf({ type: active, rows: result.data });
      else await exportReportExcel({ type: active, rows: result.data });
      setState((current) => ({ ...current, exporting: '' }));
    } catch (error) {
      setState((current) => ({ ...current, exporting: '', exportError: error.message || 'Erro ao gerar relatório.' }));
    }
  }

  return (
    <div className="page-shell">
      <PageTitle title="Relatórios" subtitle="Indicadores operacionais com filtros, gráficos e exportação profissional." />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleReports.map((item) => <button key={item.id} type="button" onClick={() => selectReport(item.id)} className={`surface-card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-luvig-sky ${active === item.id ? 'border-luvig-blue ring-2 ring-blue-100' : ''}`}><span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active === item.id ? 'bg-luvig-blue text-white' : 'bg-luvig-light text-luvig-blue'}`}><item.icon className="h-5 w-5" /></span><span><strong className="block text-sm font-black text-luvig-ink">{item.title}</strong><small className="mt-1 block text-xs font-semibold text-slate-500">{item.description}</small></span></button>)}
      </section>
      <GlobalReportFilters value={filters} onChange={setFilters} options={options} show={filterVisibility[active]} />

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="flex items-center gap-2 text-lg font-black text-luvig-ink"><BriefcaseBusiness className="h-5 w-5 text-luvig-blue" />Relatório de {reportLabels[active]}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{result.data.length} registro(s) encontrado(s)</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" className="secondary-button" disabled={state.exporting || !result.data.length} onClick={() => exportFile('pdf')}><FileText className="h-4 w-4" />PDF</button><button type="button" className="primary-button" disabled={state.exporting || !result.data.length} onClick={() => exportFile('excel')}><FileSpreadsheet className="h-4 w-4" />Excel</button></div>
        </div>
        {state.exportError && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">Erro ao gerar relatório. {state.exportError}</div>}
        {result.error && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Erro ao gerar relatório. {result.error}</div>}
        {state.loading ? <div className="p-5"><DashboardSkeleton /></div> : !result.error && !result.data.length ? <EmptyReport /> : !result.error && <>
          <ReportHighlights type={active} rows={result.data} summary={result.summary} />
          {!!result.chart?.length && <div className="border-b border-slate-200 p-5"><h3 className="mb-2 font-black text-luvig-ink">{chartTitle(active)}</h3><SimpleBarChart data={result.chart} series={active === 'financial' ? [{ key: 'entries', label: 'Entradas', color: 'bg-emerald-500' }, { key: 'expenses', label: 'Saídas', color: 'bg-red-400' }] : [{ key: 'value', label: active === 'scores' ? 'Variação' : 'Total', color: 'bg-luvig-blue' }]} /></div>}
          <ReportTable rows={result.data} />
        </>}
      </section>
    </div>
  );
}

function ReportHighlights({ type, rows, summary }) {
  if (type === 'scores') {
    const attention = rows.filter((item) => item.score < 5).length;
    const average = rows.length ? rows.reduce((total, item) => total + Number(item.score), 0) / rows.length : 0;
    return <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-3"><StatCard label="Ranking geral" value={rows.length} detail="Funcionários avaliados" icon={Users} /><StatCard label="Funcionários em atenção" value={attention} detail="Nota abaixo de 5" icon={Activity} tone="red" /><StatCard label="Média geral" value={average.toFixed(1)} detail="Nota atual da equipe" icon={Star} tone="amber" /></div>;
  }
  if (type === 'vacations') return <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-3"><StatCard label="Em férias" value={rows.filter((item) => item.status === 'Férias').length} icon={CalendarDays} tone="green" /><StatCard label="Próximas férias" value={rows.filter((item) => item.nextVacation !== 'A definir').length} icon={CalendarDays} /><StatCard label="Retornos previstos" value={rows.filter((item) => item.returnDate !== 'A definir').length} icon={Download} tone="cyan" /></div>;
  if (type === 'financial' && summary) return <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Entradas" value={currencyBRL(summary.entriesTotal)} icon={Receipt} tone="green" /><StatCard label="Saídas" value={currencyBRL(summary.expensesTotal)} icon={Receipt} tone="red" /><StatCard label="Saldo" value={currencyBRL(summary.balance)} icon={Receipt} /><StatCard label="Clientes pendentes" value={summary.pendingClients} icon={Building2} tone="amber" /></div>;
  return null;
}

function ReportTable({ rows }) {
  const keys = Object.keys(rows[0] || {});
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{keys.map((key) => <th key={key} className="whitespace-nowrap px-5 py-3 font-black">{tableTitles[key] || key}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={`${index}-${Object.values(row)[0]}`} className="hover:bg-blue-50/40">{keys.map((key) => <td key={key} className="max-w-sm px-5 py-3 font-semibold text-slate-700">{row[key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}

function EmptyReport() { return <div className="flex flex-col items-center px-5 py-16 text-center"><span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><FileText className="h-6 w-6" /></span><p className="mt-4 font-black text-luvig-ink">Sem dados para exibir.</p><p className="mt-1 text-sm font-semibold text-slate-500">Ajuste os filtros ou aguarde novos registros.</p></div>; }
function chartTitle(type) { return { employees: 'Funcionários por status', occurrences: 'Ocorrências por mês', scores: 'Evolução das notas', financial: 'Entradas x saídas' }[type] || 'Visão geral'; }
