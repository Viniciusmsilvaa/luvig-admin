import {
  Activity, BriefcaseBusiness, Building2, CalendarDays, ClipboardList, DollarSign, FileSearch,
  FileText, HeartPulse, Package, Receipt, ShieldAlert, Star, Timer, Users, WalletCards,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTimeClockAccess } from '../auth/accessRules.js';
import DashboardSkeleton from '../components/DashboardSkeleton.jsx';
import GlobalReportFilters, { initialReportFilters } from '../components/GlobalReportFilters.jsx';
import PageTitle from '../components/PageTitle.jsx';
import PrintableReportActions from '../components/PrintableReportActions.jsx';
import SimpleBarChart from '../components/SimpleBarChart.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { columnTitle, exportReportExcel, exportReportPdf, getReport, getReportOptions, previewReportPdf, printReportPdf, reportLabels, subscribeReports } from '../services/reportService.js';
import { formatMinutes } from '../utils/timeClock.js';
import { currencyBRL } from '../utils/formatters.js';

const reports = [
  { id: 'employees', description: 'Quadro, status e tempo de casa', icon: Users, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'scores', description: 'Ranking e evolução das notas', icon: Star, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'vacations', description: 'Programação e retornos', icon: CalendarDays, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'medical', description: 'Atestados e retornos', icon: HeartPulse, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'absences', description: 'Faltas registradas', icon: ShieldAlert, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'warnings', description: 'Advertências registradas', icon: ShieldAlert, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'suspensions', description: 'Suspensões registradas', icon: ShieldAlert, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'notices', description: 'Avisos prévios e períodos', icon: CalendarDays, roles: ['Admin', 'RH'], group: 'Pessoas' },
  { id: 'occurrences', description: 'Tipos, responsáveis e situação', icon: Activity, roles: ['Admin', 'RH'], group: 'Operação' },
  { id: 'complaints', description: 'Por condomínio e funcionário', icon: Activity, roles: ['Admin', 'RH'], group: 'Operação' },
  { id: 'requests', description: 'Pedidos por cliente, tipo e status', icon: ClipboardList, roles: ['Admin', 'RH'], group: 'Operação' },
  { id: 'clients', description: 'Contratos e situação cadastral', icon: Building2, roles: ['Admin', 'RH'], group: 'Operação' },
  { id: 'services', description: 'Serviços por condomínio', icon: BriefcaseBusiness, roles: ['Admin', 'RH'], group: 'Operação' },
  { id: 'documents', description: 'Documentos por vínculo e tipo', icon: FileSearch, roles: ['Admin', 'RH'], group: 'Operação' },
  { id: 'financial', description: 'Consolidado financeiro', icon: Receipt, roles: ['Admin'], group: 'Financeiro' },
  { id: 'entries', description: 'Receitas e clientes', icon: DollarSign, roles: ['Admin'], group: 'Financeiro' },
  { id: 'expenses', description: 'Despesas por categoria', icon: WalletCards, roles: ['Admin'], group: 'Financeiro' },
  { id: 'terminations', description: 'Custos de rescisão', icon: WalletCards, roles: ['Admin'], group: 'Financeiro' },
  { id: 'fuel', description: 'Despesas de combustível', icon: WalletCards, roles: ['Admin'], group: 'Financeiro' },
  { id: 'uniforms', description: 'Despesas de uniformes', icon: Package, roles: ['Admin'], group: 'Financeiro' },
  { id: 'equipment', description: 'Despesas de equipamentos', icon: Package, roles: ['Admin'], group: 'Financeiro' },
  { id: 'products', description: 'Despesas de produtos', icon: Package, roles: ['Admin'], group: 'Financeiro' },
  { id: 'users', description: 'Perfis e permissões', icon: Users, roles: ['Admin'], group: 'Sistema' },
  { id: 'audits', description: 'Eventos críticos do sistema', icon: FileSearch, roles: ['Admin'], group: 'Sistema' },
  { id: 'time_clock', description: 'Jornada, horários e saldos', icon: Timer, roles: ['Admin'], group: 'Sistema', timeClock: true },
];

const filterVisibility = {
  employees: { employee: true, status: true, role: true }, occurrences: { employee: true, status: true, type: true }, scores: { employee: true, role: true },
  vacations: { employee: true, status: true, role: true }, medical: { employee: true, status: true, role: true }, clients: { client: true, status: true }, services: { client: true, status: true },
  financial: { client: true, status: true }, entries: { client: true, status: true }, expenses: { status: true }, requests: { employee: true, client: true, status: true },
  complaints: { employee: true, client: true, status: true }, absences: { employee: true, client: true, status: true }, warnings: { employee: true, client: true, status: true }, suspensions: { employee: true, client: true, status: true }, notices: { employee: true, status: true },
  documents: { employee: true, client: true, status: true }, time_clock: { status: true, type: true },
};
const timeClockStatusChoices = [['folga', 'Folga'], ['atestado', 'Atestado'], ['ferias', 'Férias'], ['feriado', 'Feriado'], ['outro_justificado', 'Outro justificado']];
const timeClockTypeChoices = [['late', 'Dias com atraso'], ['extra', 'Dias com horas extras'], ['negative', 'Dias com saldo negativo'], ['incomplete', 'Dias incompletos'], ['edited', 'Dias editados']];

export default function Relatorios() {
  const { role, profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const timeClockAccess = getTimeClockAccess(profile, user);
  const visibleReports = useMemo(() => reports.filter((item) => item.roles.includes(role) && (!item.timeClock || timeClockAccess.canView)), [role, timeClockAccess.canView]);
  const requested = searchParams.get('report');
  const initialActive = visibleReports.some((item) => item.id === requested) ? requested : visibleReports[0]?.id || 'employees';
  const [active, setActive] = useState(initialActive);
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
    const args = { type: active, rows: result.data, filters, summary: result.summary, generatedBy: profile?.full_name || user?.email || 'Usuário não identificado' };
    try {
      if (format === 'pdf') await exportReportPdf(args);
      if (format === 'preview') await previewReportPdf(args);
      if (format === 'print') await printReportPdf(args);
      if (format === 'excel') await exportReportExcel({ type: active, rows: result.data });
      setState((current) => ({ ...current, exporting: '' }));
    } catch (error) {
      setState((current) => ({ ...current, exporting: '', exportError: error.message || 'Erro ao gerar relatório.' }));
    }
  }

  const groups = [...new Set(visibleReports.map((item) => item.group))];
  return <div className="page-shell">
    <PageTitle title="Relatórios" subtitle="Dados reais organizados, com prévia, impressão, PDF e Excel." />
    {groups.map((group) => <section key={group}><h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">{group}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{visibleReports.filter((item) => item.group === group).map((item) => <button key={item.id} type="button" onClick={() => selectReport(item.id)} className={`surface-card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-luvig-sky ${active === item.id ? 'border-luvig-blue ring-2 ring-blue-100' : ''}`}><span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active === item.id ? 'bg-luvig-blue text-white' : 'bg-luvig-light text-luvig-blue'}`}><item.icon className="h-5 w-5" /></span><span><strong className="block text-sm font-black text-luvig-ink">{reportLabels[item.id]}</strong><small className="mt-1 block text-xs font-semibold text-slate-500">{item.description}</small></span></button>)}</div></section>)}
    <GlobalReportFilters value={filters} onChange={setFilters} options={options} show={filterVisibility[active]} statusChoices={active === 'time_clock' ? timeClockStatusChoices : undefined} typeChoices={active === 'time_clock' ? timeClockTypeChoices : undefined} />
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="flex items-center gap-2 text-lg font-black text-luvig-ink"><BriefcaseBusiness className="h-5 w-5 text-luvig-blue" />Relatório de {reportLabels[active]}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{result.data.length} registro(s) encontrado(s)</p></div><div className="flex flex-wrap gap-2"><PrintableReportActions busy={state.exporting} disabled={!result.data.length} onAction={exportFile} /><button type="button" className="secondary-button" disabled={state.exporting || !result.data.length} onClick={() => exportFile('excel')}>Excel</button></div></div>
      {state.exportError && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{state.exportError}</div>}
      {result.error && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{result.error}</div>}
      {state.loading ? <div className="p-5"><DashboardSkeleton /></div> : !result.error && !result.data.length ? <EmptyReport /> : !result.error && <><ReportHighlights type={active} rows={result.data} summary={result.summary} />{!!result.chart?.length && <div className="border-b border-slate-200 p-5"><SimpleBarChart data={result.chart} series={active === 'financial' ? [{ key: 'entries', label: 'Entradas', color: 'bg-emerald-500' }, { key: 'expenses', label: 'Saídas', color: 'bg-red-400' }] : [{ key: 'value', label: 'Total', color: 'bg-luvig-blue' }]} /></div>}<ReportTable rows={result.data} /></>}
    </section>
  </div>;
}

function ReportHighlights({ type, rows, summary }) {
  if (type === 'scores') { const attention = rows.filter((item) => item.score < 5).length; const average = rows.length ? rows.reduce((total, item) => total + Number(item.score), 0) / rows.length : 0; return <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-3"><StatCard label="Ranking geral" value={rows.length} icon={Users} /><StatCard label="Em atenção" value={attention} icon={Activity} tone="red" /><StatCard label="Média geral" value={average.toFixed(1)} icon={Star} tone="amber" /></div>; }
  if (type === 'financial' && summary) return <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Entradas" value={currencyBRL(summary.entriesTotal)} icon={Receipt} tone="green" /><StatCard label="Saídas" value={currencyBRL(summary.expensesTotal)} icon={Receipt} tone="red" /><StatCard label="Saldo" value={currencyBRL(summary.balance)} icon={Receipt} /><StatCard label="Clientes pendentes" value={summary.pendingClients} icon={Building2} tone="amber" /></div>;
  if (type === 'time_clock' && summary) return <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Esperado" value={formatMinutes(summary.totalExpectedMinutes)} icon={Timer} /><StatCard label="Trabalhado" value={formatMinutes(summary.totalWorkedMinutes)} icon={Timer} tone="green" /><StatCard label="Saldo" value={formatMinutes(summary.balanceMinutes, { signed: true })} icon={Timer} tone={summary.balanceMinutes < 0 ? 'red' : 'green'} /><StatCard label="Extras" value={formatMinutes(summary.extraMinutes)} icon={Timer} tone="green" /><StatCard label="Negativas" value={formatMinutes(summary.negativeMinutes)} icon={Timer} tone="red" /></div>;
  return null;
}

function ReportTable({ rows }) { const keys = Object.keys(rows[0] || {}); return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{keys.map((key) => <th key={key} className="whitespace-nowrap px-5 py-3 font-black">{columnTitle(key)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={`${index}-${Object.values(row)[0]}`} className="break-inside-avoid hover:bg-blue-50/40">{keys.map((key) => <td key={key} className="max-w-sm px-5 py-3 font-semibold text-slate-700">{row[key] ?? '—'}</td>)}</tr>)}</tbody></table></div>; }
function EmptyReport() { return <div className="flex flex-col items-center px-5 py-16 text-center"><FileText className="h-8 w-8 text-slate-400" /><p className="mt-4 font-black text-luvig-ink">Sem dados para exibir.</p><p className="mt-1 text-sm font-semibold text-slate-500">Ajuste os filtros ou aguarde novos registros.</p></div>; }
