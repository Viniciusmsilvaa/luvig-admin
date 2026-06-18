import { CalendarDays, Clock3, LogIn, LogOut, Timer, Utensils } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageTitle from '../components/PageTitle.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getTimeClockAccess } from '../auth/accessRules.js';
import {
  createClockRecord,
  formatWorkedTime,
  getClockHistory,
  getMonthClockSummary,
  getTimeClockOwnerId,
  getTodayClock,
  getWeekClockSummary,
} from '../services/timeClockService.js';

const actions = [
  { label: 'Entrada', value: 'entrada', icon: LogIn },
  { label: 'Saída almoço', value: 'saida_almoco', icon: Utensils },
  { label: 'Retorno almoço', value: 'retorno_almoco', icon: Clock3 },
  { label: 'Saída', value: 'saida', icon: LogOut },
];

const labels = Object.fromEntries(actions.map((item) => [item.value, item.label]));
const views = [
  { value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' }, { value: 'historico', label: 'Histórico' },
];

function startOfPeriod(view, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (view === 'hoje') return today;
  if (view === 'semana') {
    const week = new Date(today);
    const weekday = week.getDay() || 7;
    week.setDate(week.getDate() - weekday + 1);
    return week;
  }
  if (view === 'mes') return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

function clockValue(record) {
  return record ? new Date(record.clock_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function MeuPonto() {
  const { profile, user } = useAuth();
  const access = getTimeClockAccess(profile, user);
  const [ownerId, setOwnerId] = useState(null);
  const [records, setRecords] = useState([]);
  const [view, setView] = useState('hoje');
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState({ loading: true, saving: false, message: '', error: '' });

  const loadRecords = useCallback(async () => {
    if (!access.canView) { setStatus((current) => ({ ...current, loading: false })); return; }
    setStatus((current) => ({ ...current, loading: true, error: '' }));
    const ownerResult = await getTimeClockOwnerId();
    if (ownerResult.error || !ownerResult.data) {
      setStatus((current) => ({ ...current, loading: false, error: ownerResult.error || 'Perfil do Vinícius não encontrado.' }));
      return;
    }
    setOwnerId(ownerResult.data);
    const result = await getClockHistory(ownerResult.data);
    setRecords(result.data || []);
    setStatus((current) => ({ ...current, loading: false, error: result.error || '' }));
  }, [access.canView]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const today = useMemo(() => getTodayClock(records, now), [records, now]);
  const week = useMemo(() => getWeekClockSummary(records, now), [records, now]);
  const month = useMemo(() => getMonthClockSummary(records, now), [records, now]);

  async function handleClock(clockType) {
    if (!access.canWrite || clockType !== today.nextType) return;
    setStatus((current) => ({ ...current, saving: true, message: '', error: '' }));
    const result = await createClockRecord(clockType);
    if (result.error) {
      setStatus((current) => ({ ...current, saving: false, error: result.error }));
      return;
    }
    setStatus((current) => ({ ...current, saving: false, message: 'Ponto registrado com sucesso.' }));
    await loadRecords();
  }

  const visibleRecords = useMemo(() => {
    const start = startOfPeriod(view, now);
    return start ? records.filter((record) => new Date(record.clock_time) >= start) : records;
  }, [records, view, now]);

  if (!access.canView && !status.loading) {
    return <div className="page-shell"><section className="surface-card flex min-h-[320px] items-center justify-center p-6 text-center"><h1 className="text-2xl font-black text-luvig-ink">Acesso não permitido.</h1></section></div>;
  }

  return (
    <div className="page-shell max-w-6xl">
      <PageTitle title="Meu Ponto" subtitle={access.isGirlane ? 'Visualização do ponto de Vinícius Miranda.' : 'Registro individual de Vinícius Miranda.'} />

      {(status.loading || status.error || status.message) && <div className={`rounded-2xl border p-4 text-sm font-bold ${status.error ? 'border-red-200 bg-red-50 text-red-700' : status.message ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{status.loading ? 'Carregando ponto...' : status.error || status.message}</div>}
      {today.incomplete && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Ponto incompleto.</div>}

      {access.canWrite && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => {
            const enabled = today.nextType === action.value;
            return <button key={action.value} className={`touch-button min-h-24 flex-col text-base ${enabled ? 'bg-luvig-blue text-white shadow-sm hover:bg-luvig-sky' : 'border border-slate-200 bg-slate-100 text-slate-400'}`} type="button" onClick={() => handleClock(action.value)} disabled={status.saving || !enabled}><action.icon className="h-7 w-7" />{status.saving && enabled ? 'Registrando...' : action.label}</button>;
          })}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-luvig-ink">Hoje</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Entrada" value={clockValue(today.entry)} icon={LogIn} tone="blue" />
          <StatCard label="Saída almoço" value={clockValue(today.lunchOut)} icon={Utensils} tone="amber" />
          <StatCard label="Retorno almoço" value={clockValue(today.lunchReturn)} icon={Clock3} tone="cyan" />
          <StatCard label="Saída" value={clockValue(today.exit)} icon={LogOut} tone="slate" />
          <StatCard label="Total trabalhado" value={formatWorkedTime(today.workedMs)} icon={Timer} tone="green" detail={today.inProgress ? 'Em andamento' : today.complete ? 'Jornada concluída' : 'Períodos registrados'} />
          <StatCard label="Intervalo" value={formatWorkedTime(today.intervalMs)} icon={Utensils} tone="amber" detail={today.lunchOut && !today.lunchReturn ? 'Em andamento' : 'Total do dia'} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PeriodCard title="Semana" summary={week} />
        <PeriodCard title="Mês" summary={month} />
      </section>

      <section className="surface-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-luvig-ink">Histórico do ponto</h2>
          <div className="flex gap-2 overflow-x-auto">{views.map((item) => <button key={item.value} className={`touch-button whitespace-nowrap ${view === item.value ? 'bg-luvig-blue text-white' : 'bg-slate-100 text-slate-600'}`} type="button" onClick={() => setView(item.value)}>{item.label}</button>)}</div>
        </div>
        <div className="mt-4 space-y-3">
          {visibleRecords.map((record) => <ClockHistoryRow key={record.id} record={record} />)}
          {!visibleRecords.length && !status.loading && <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-700">Nenhum registro encontrado neste período.</div>}
        </div>
      </section>
      {!ownerId && !status.loading && !status.error && <p className="text-sm font-semibold text-slate-500">Aguardando identificação do perfil responsável.</p>}
    </div>
  );
}

function PeriodCard({ title, summary }) {
  return <section className="surface-card p-5"><h2 className="flex items-center gap-2 text-lg font-black text-luvig-ink"><CalendarDays className="h-5 w-5 text-luvig-blue" />{title}</h2><div className="mt-4 grid grid-cols-3 gap-3"><PeriodValue label="Trabalhado" value={summary.total} /><PeriodValue label="Dias" value={summary.daysRegistered} /><PeriodValue label="Média diária" value={summary.average} /></div></section>;
}

function PeriodValue({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-base font-black text-luvig-ink">{value}</p></div>;
}

function ClockHistoryRow({ record }) {
  const [showEdit, setShowEdit] = useState(false);
  const editedBy = record.editor?.full_name || 'Vinícius Miranda';
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-[130px,1fr,120px,auto] sm:items-center">
        <span className="font-black text-luvig-ink">{new Date(record.clock_time).toLocaleDateString('pt-BR')}</span>
        <span className="font-bold text-slate-700">{labels[record.clock_type] || record.clock_type}</span>
        <span className="font-bold text-slate-500">{clockValue(record)}</span>
        {record.is_edited ? <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-amber-100" onClick={() => setShowEdit((value) => !value)} title={`Este ponto foi modificado. Motivo: ${record.edit_reason || 'Não informado'}`} aria-label="Ver detalhes da alteração" aria-expanded={showEdit}><span className="h-3 w-3 rounded-full bg-amber-400 ring-4 ring-amber-100" /></button> : <span />}
      </div>
      {record.notes && <p className="mt-2 font-semibold text-slate-500">Observação: {record.notes}</p>}
      {showEdit && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900"><p>Este ponto foi modificado.</p><p>Motivo: {record.edit_reason || 'Não informado'}</p><p>Alterado por: {editedBy}</p><p>Data da alteração: {record.edited_at ? new Date(record.edited_at).toLocaleString('pt-BR') : 'Não informada'}</p></div>}
    </div>
  );
}
