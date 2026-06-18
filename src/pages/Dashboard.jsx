import {
  AlertTriangle, CalendarCheck, CalendarDays, CheckCircle2, ClipboardCheck, DollarSign, FileClock,
  ShieldCheck, TrendingDown, TrendingUp, UserMinus, Users, XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSkeleton from '../components/DashboardSkeleton.jsx';
import PageTitle from '../components/PageTitle.jsx';
import SimpleBarChart from '../components/SimpleBarChart.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getDashboardData, subscribeDashboard } from '../services/dashboardService.js';
import { currencyBRL, shortDate } from '../utils/formatters.js';

const EMPTY = { employees: [], occurrences: [], requests: [], approvals: [], financial: { entriesTotal: 0, expensesTotal: 0, balance: 0, pendingClients: 0 } };
const pendingOccurrenceStatuses = ['aguardando_conferencia', 'recomendado_pelo_rh'];

function daysFromToday(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date - today) / 86400000);
}

export default function Dashboard() {
  const { role, isAdmin, isRH, isLeader, profile } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [state, setState] = useState({ loading: true, refreshing: false, error: '' });

  const load = useCallback(async (refreshing = false) => {
    setState((current) => ({ ...current, loading: !refreshing, refreshing, error: '' }));
    const result = await getDashboardData({ role, profileId: profile?.id });
    if (result.error) {
      setState({ loading: false, refreshing: false, error: result.error || 'Erro ao carregar dashboard.' });
      return;
    }
    setData(result.data || EMPTY);
    setState({ loading: false, refreshing: false, error: '' });
  }, [role, profile?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribeDashboard({ role, onChange: () => load(true) }), [role, load]);
  const summary = useMemo(() => buildSummary(data), [data]);

  if (state.loading) return <div className="page-shell"><PageTitle title="Dashboard" subtitle="Carregando informações atuais do Supabase." /><DashboardSkeleton /></div>;

  return (
    <div className="page-shell">
      <PageTitle
        title="Dashboard"
        subtitle={isLeader ? 'Resumo dos seus registros, aprovações e pedidos.' : isRH ? 'Visão operacional de pessoas, ocorrências e pendências.' : 'Central de gestão com indicadores atualizados em tempo real.'}
        actions={<Link className="primary-button" to={isLeader ? '/lideranca' : '/relatorios'}>{isLeader ? 'Abrir liderança' : 'Ver relatórios'}</Link>}
      />
      {state.error && <ErrorState detail={state.error} onRetry={() => load()} />}
      {state.refreshing && <p className="text-right text-xs font-bold text-luvig-blue">Atualizando dados…</p>}
      {!state.error && isLeader && <LeaderDashboard summary={summary} data={data} />}
      {!state.error && !isLeader && <PeopleDashboard summary={summary} data={data} isAdmin={isAdmin} />}
    </div>
  );
}

function PeopleDashboard({ summary, data, isAdmin }) {
  return (
    <>
      <Section title="Funcionários"><StatGrid stats={[
        ['Funcionários ativos', summary.employeeStatus.ativo, 'Equipe em atividade', Users, 'blue'],
        ['Em férias', summary.employeeStatus.ferias, 'Afastamento programado', CalendarDays, 'green'],
        ['Em atestado', summary.employeeStatus.atestado, 'Retorno acompanhado', ShieldCheck, 'cyan'],
        ['Em aviso prévio', summary.employeeStatus.aviso_previo, 'Término acompanhado', AlertTriangle, 'amber'],
        ['Inativos', summary.employeeStatus.inativo, 'Cadastros inativos', UserMinus, 'slate'],
        ['Desligados', summary.employeeStatus.desligado, 'Histórico preservado', XCircle, 'red'],
      ]} /></Section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EmployeeRanking title="Top 5 melhores notas" employees={summary.top} tone="green" />
        <EmployeeRanking title="Top 5 menores notas" employees={summary.bottom} tone="amber" />
      </section>

      <Section title="Ocorrências"><StatGrid stats={[
        ['Pendentes', summary.occurrenceStatus.pending, 'Aguardando decisão', AlertTriangle, 'amber'],
        ['Confirmadas', summary.occurrenceStatus.confirmado, 'Registros validados', CheckCircle2, 'green'],
        ['Recusadas', summary.occurrenceStatus.recusado, 'Registros não aplicados', XCircle, 'red'],
        ['Últimos 30 dias', summary.occurrenceStatus.last30, 'Volume recente', ClipboardCheck, 'blue'],
      ]} /></Section>

      <Section title="Pedidos e pendências"><StatGrid stats={[
        ['Pedidos pendentes', summary.requestStatus.pendente, 'Aguardando análise', FileClock, 'amber'],
        ['Em análise', summary.requestStatus.em_analise, 'Em tratamento', ClipboardCheck, 'blue'],
        ['Aprovados', summary.requestStatus.aprovado, 'Pedidos aprovados', CheckCircle2, 'green'],
        ['Recusados', summary.requestStatus.recusado, 'Pedidos recusados', XCircle, 'red'],
        ['Pendências RH/Admin', summary.pendingApprovals, 'Solicitações abertas', AlertTriangle, 'orange'],
      ]} /></Section>

      {isAdmin && <Section title="Financeiro"><StatGrid stats={[
        ['Entradas do mês', currencyBRL(data.financial.entriesTotal), 'Recebimentos pagos', TrendingUp, 'green'],
        ['Saídas do mês', currencyBRL(data.financial.expensesTotal), 'Despesas pagas', TrendingDown, 'red'],
        ['Saldo estimado', currencyBRL(data.financial.balance), 'Entradas menos saídas', DollarSign, 'slate'],
        ['Clientes pendentes', data.financial.pendingClients, 'Cobranças em aberto', AlertTriangle, 'amber'],
      ]} /></Section>}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card p-5"><h2 className="text-lg font-black text-luvig-ink">Funcionários por status</h2><SimpleBarChart data={summary.employeeChart} /></div>
        <AlertPanel alerts={summary.alerts} />
      </section>
    </>
  );
}

function LeaderDashboard({ summary, data }) {
  return (
    <>
      <StatGrid stats={[
        ['Pedidos enviados', data.requests.length, 'Seus pedidos registrados', FileClock, 'blue'],
        ['Ocorrências enviadas', data.occurrences.length, 'Seus registros', ClipboardCheck, 'cyan'],
        ['Aguardando aprovação', summary.occurrenceStatus.pending, 'Em conferência', AlertTriangle, 'amber'],
      ]} />
      <section className="surface-card p-5"><h2 className="text-lg font-black text-luvig-ink">Atalhos rápidos</h2><div className="mt-4 flex flex-wrap gap-3"><Link className="primary-button" to="/ocorrencias/nova">Registrar ocorrência</Link><Link className="secondary-button" to="/administracao/pedidos">Novo pedido</Link><Link className="secondary-button" to="/administracao/avisos">Ver avisos</Link></div></section>
      <section className="surface-card p-5">
        <h2 className="text-lg font-black text-luvig-ink">Pedidos recentes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.requests.slice(0, 6).map((request) => <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><StatusBadge status={statusText(request.statusValue)} /><p className="mt-3 font-black text-luvig-ink">{request.title}</p><p className="mt-1 text-sm font-semibold text-slate-500">{request.target}</p></article>)}
          {!data.requests.length && <EmptyMessage />}
        </div>
      </section>
    </>
  );
}

function buildSummary(data) {
  const employeeStatus = ['ativo', 'ferias', 'atestado', 'aviso_previo', 'inativo', 'desligado'].reduce((acc, status) => ({ ...acc, [status]: data.employees.filter((item) => item.statusValue === status).length }), {});
  const requestStatus = ['pendente', 'em_analise', 'aprovado', 'recusado'].reduce((acc, status) => ({ ...acc, [status]: data.requests.filter((item) => item.statusValue === status).length }), {});
  const occurrenceStatus = {
    pending: data.occurrences.filter((item) => pendingOccurrenceStatuses.includes(item.statusValue)).length,
    confirmado: data.occurrences.filter((item) => item.statusValue === 'confirmado').length,
    recusado: data.occurrences.filter((item) => item.statusValue === 'recusado').length,
    last30: data.occurrences.filter((item) => { const days = daysFromToday(item.date); return days !== null && days <= 0 && days >= -30; }).length,
  };
  const ranked = [...data.employees].sort((a, b) => b.score - a.score);
  const alerts = [];
  data.employees.forEach((employee) => {
    const vacation = daysFromToday(employee.nextVacationDate);
    const vacationReturn = daysFromToday(employee.vacationReturnDate);
    const medicalReturn = daysFromToday(employee.medicalLeaveReturnDate);
    const noticeEnd = daysFromToday(employee.noticeEndDate);
    if (vacation !== null && vacation >= 0 && vacation <= 30) alerts.push({ id: `${employee.id}-vacation`, title: 'Férias próximas', text: `${employee.name} · ${shortDate(employee.nextVacationDate)}` });
    if (employee.statusValue === 'ferias' && vacationReturn !== null && vacationReturn >= 0 && vacationReturn <= 15) alerts.push({ id: `${employee.id}-vacation-return`, title: 'Retorno de férias', text: `${employee.name} · ${shortDate(employee.vacationReturnDate)}` });
    if (employee.statusValue === 'atestado' && medicalReturn !== null && medicalReturn >= 0 && medicalReturn <= 15) alerts.push({ id: `${employee.id}-medical`, title: 'Retorno de atestado', text: `${employee.name} · ${shortDate(employee.medicalLeaveReturnDate)}` });
    if (employee.statusValue === 'aviso_previo' && noticeEnd !== null && noticeEnd >= 0 && noticeEnd <= 15) alerts.push({ id: `${employee.id}-notice`, title: 'Aviso prévio próximo do fim', text: `${employee.name} · ${shortDate(employee.noticeEndDate)}` });
    if (employee.score < 5) alerts.push({ id: `${employee.id}-score`, title: 'Nota abaixo de 5', text: `${employee.name} · ${employee.score.toFixed(1)}` });
  });
  return {
    employeeStatus, requestStatus, occurrenceStatus,
    pendingApprovals: data.approvals.filter((item) => item.status === 'pendente').length,
    top: ranked.slice(0, 5), bottom: [...ranked].reverse().slice(0, 5), alerts,
    employeeChart: [['Ativos', 'ativo'], ['Férias', 'ferias'], ['Atestado', 'atestado'], ['Aviso', 'aviso_previo'], ['Inativos', 'inativo'], ['Desligados', 'desligado']].map(([name, key]) => ({ name, value: employeeStatus[key] })),
  };
}

function Section({ title, children }) { return <section><h2 className="mb-3 text-lg font-black text-luvig-ink">{title}</h2>{children}</section>; }
function StatGrid({ stats }) { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{stats.map(([label, value, detail, icon, tone]) => <StatCard key={label} label={label} value={value} detail={detail} icon={icon} tone={tone} />)}</div>; }
function EmptyMessage() { return <p className="py-5 text-center text-sm font-semibold text-slate-500">Sem dados para exibir.</p>; }
function statusText(status) { return { pendente: 'Pendente', em_analise: 'Em análise', aprovado: 'Aprovado', recusado: 'Recusado', resolvido: 'Resolvido' }[status] || status; }

function EmployeeRanking({ title, employees, tone }) {
  const color = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800';
  return <div className="surface-card p-5"><h2 className="text-lg font-black text-luvig-ink">{title}</h2><div className="mt-4 space-y-2">{employees.map((employee) => <Link key={employee.id} to={`/funcionarios/${employee.id}`} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${color}`}><div><p className="font-black text-luvig-ink">{employee.name}</p><p className="text-sm font-semibold">{employee.role}</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-black">{employee.score.toFixed(1)}</span></Link>)}{!employees.length && <EmptyMessage />}</div></div>;
}

function AlertPanel({ alerts }) {
  return <div className="surface-card p-5"><h2 className="flex items-center gap-2 text-lg font-black text-luvig-ink"><AlertTriangle className="h-5 w-5 text-amber-500" />Alertas importantes</h2><div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">{alerts.map((alert) => <div key={alert.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-luvig-blue" /><div><p className="text-sm font-black text-luvig-ink">{alert.title}</p><p className="text-xs font-semibold text-slate-500">{alert.text}</p></div></div>)}{!alerts.length && <EmptyMessage />}</div></div>;
}

function ErrorState({ detail, onRetry }) { return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><p className="font-black">Erro ao carregar dashboard.</p><p className="mt-1 text-sm font-semibold">{detail}</p><button type="button" className="secondary-button mt-4" onClick={onRetry}>Tentar novamente</button></div>; }
