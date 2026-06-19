import { AlertTriangle, CalendarCheck, CalendarDays, CalendarPlus, Clock3, FileText, LogIn, LogOut, Paperclip, Utensils } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTimeClockAccess } from '../auth/accessRules.js';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  buildClockDays,
  createClockRecord,
  createManualClockRecords,
  dateKey,
  ensureClockPeriod,
  formatMinutes,
  getClockHistory,
  getDayStatuses,
  getDayStatusAttachmentUrl,
  getHolidays,
  getTimeClockOwnerId,
  getWorkScheduleSettings,
  saveDayStatus,
  summarizeClockDays,
  updateClockPeriodTotals,
  uploadDayStatusAttachment,
} from '../services/timeClockService.js';

const actions = [
  { label: 'Entrada', value: 'entrada', icon: LogIn },
  { label: 'Saída almoço', value: 'saida_almoco', icon: Utensils },
  { label: 'Retorno almoço', value: 'retorno_almoco', icon: Clock3 },
  { label: 'Saída', value: 'saida', icon: LogOut },
];
const labels = Object.fromEntries(actions.map((item) => [item.value, item.label]));
const statusOptions = [
  ['folga', 'Folga'], ['atestado', 'Atestado'], ['ferias', 'Férias'], ['feriado', 'Feriado'], ['outro_justificado', 'Outro justificado'],
];

function clockValue(record) {
  return record ? new Date(record.clock_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function weekStart(now) {
  const current = new Date(`${dateKey(now)}T12:00:00-03:00`);
  const weekday = current.getDay() || 7;
  current.setDate(current.getDate() - weekday + 1);
  return dateKey(current);
}

export default function MeuPonto() {
  const { profile, user } = useAuth();
  const access = getTimeClockAccess(profile, user);
  const [ownerId, setOwnerId] = useState(null);
  const [records, setRecords] = useState([]);
  const [settings, setSettings] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [period, setPeriod] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
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
    const periodResult = await ensureClockPeriod(dateKey());
    const bounds = periodResult.data || {};
    const [historyResult, scheduleResult, statusResult, holidayResult] = await Promise.all([
      getClockHistory(ownerResult.data, { limit: 2000 }),
      getWorkScheduleSettings(ownerResult.data),
      getDayStatuses(ownerResult.data, { dateFrom: bounds.start_date, dateTo: bounds.end_date }),
      getHolidays({ dateFrom: bounds.start_date, dateTo: bounds.end_date }),
    ]);
    setPeriod(periodResult.data || null);
    setRecords(historyResult.data || []);
    setSettings(scheduleResult.data || []);
    setStatuses(statusResult.data || []);
    setHolidays(holidayResult.data || []);
    setStatus((current) => ({ ...current, loading: false, error: periodResult.error || historyResult.error || scheduleResult.error || statusResult.error || holidayResult.error || '' }));
  }, [access.canView]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const days = useMemo(() => buildClockDays({
    records, settings, statuses, holidays,
    startDate: period?.start_date, endDate: period?.end_date, now, includeEmpty: Boolean(period),
  }), [records, settings, statuses, holidays, period, now]);
  const today = useMemo(() => days.find((day) => day.referenceDate === dateKey(now)) || buildClockDays({ records, settings, statuses, holidays, startDate: dateKey(now), endDate: dateKey(now), now, includeEmpty: true })[0], [days, records, settings, statuses, holidays, now]);
  const periodSummary = useMemo(() => summarizeClockDays(days), [days]);
  const weekSummary = useMemo(() => summarizeClockDays(days.filter((day) => day.referenceDate >= weekStart(now))), [days, now]);

  useEffect(() => {
    if (access.canWrite && period?.id && !status.loading) updateClockPeriodTotals(period.id, periodSummary);
  }, [access.canWrite, period?.id, periodSummary.totalWorkedMinutes, periodSummary.totalExpectedMinutes, periodSummary.balanceMinutes, status.loading]);

  async function handleClock(clockType) {
    if (!access.canWrite || clockType !== today?.nextType) return;
    setStatus((current) => ({ ...current, saving: true, message: '', error: '' }));
    const result = await createClockRecord(clockType);
    setStatus((current) => ({ ...current, saving: false, message: result.error ? '' : 'Ponto registrado com sucesso.', error: result.error || '' }));
    if (!result.error) await loadRecords();
  }

  async function handleDayStatus(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setStatus((current) => ({ ...current, saving: true, message: '', error: '' }));
    let attachmentUrl = '';
    const attachment = form.elements.attachment?.files?.[0];
    if (attachment) {
      const upload = await uploadDayStatusAttachment(ownerId, attachment);
      if (upload.error) { setStatus((current) => ({ ...current, saving: false, error: upload.error })); return; }
      attachmentUrl = upload.path;
    }
    const result = await saveDayStatus({ referenceDate: values.reference_date, status: values.day_status, reason: values.reason, attachmentUrl });
    setStatus((current) => ({ ...current, saving: false, message: result.error ? '' : 'Situação do dia registrada.', error: result.error || '' }));
    if (!result.error) { form.reset(); setShowStatusForm(false); await loadRecords(); }
  }

  async function handleManualRecords(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setStatus((current) => ({ ...current, saving: true, message: '', error: '' }));
    const result = await createManualClockRecords({
      referenceDate: values.reference_date,
      entries: Object.fromEntries(actions.map((action) => [action.value, values[action.value]])),
      reason: values.reason,
      notes: values.notes,
    });
    setStatus((current) => ({ ...current, saving: false, message: result.error ? '' : 'Registro retroativo adicionado.', error: result.error || '' }));
    if (!result.error) { form.reset(); setShowManualForm(false); await loadRecords(); }
  }

  if (!access.canView && !status.loading) return <div className="page-shell"><section className="surface-card flex min-h-[320px] items-center justify-center p-6 text-center"><h1 className="text-2xl font-black text-luvig-ink">Acesso não permitido.</h1></section></div>;
  if (!today) return <div className="page-shell"><p className="surface-card p-5">Carregando ponto...</p></div>;

  return (
    <div className="page-shell max-w-7xl">
      <PageTitle title="Meu Ponto" subtitle={access.isGirlane ? 'Visualização do ponto de Vinícius Miranda.' : 'Jornada de Vinícius Miranda · meta vigente calculada pelo Supabase.'} actions={<Link className="secondary-button" to="/relatorios?report=time_clock"><FileText className="h-4 w-4" />Relatório de ponto</Link>} />
      {(status.loading || status.error || status.message) && <div className={`rounded-2xl border p-4 text-sm font-bold ${status.error ? 'border-red-200 bg-red-50 text-red-700' : status.message ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{status.loading ? 'Carregando ponto...' : status.error || status.message}</div>}
      {today.incomplete && <Alert tone="red" text={`Ponto incompleto. ${today.missingTypes.length ? `Faltando: ${today.missingTypes.map((item) => labels[item]).join(', ')}.` : 'A sequência precisa ser corrigida.'}`} />}
      {today.scheduleAlerts.filter((item) => !item.startsWith('Ponto incompleto')).map((item) => <Alert key={item} tone="red" text={item} />)}

      <section className="surface-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <TopValue label="Data" value={new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Sao_Paulo' }).format(now)} />
        <TopValue label="Horário" value={new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(now)} />
        <TopValue label="Situação" value={today.statusLabel} />
        <TopValue label="Trabalhado hoje" value={formatMinutes(today.workedMinutes)} />
        <TopValue label="Saldo do dia" value={formatMinutes(today.balanceMinutes, { signed: true })} tone={today.balanceMinutes} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{actions.map((action) => {
        const record = today.records.find((item) => item.clock_type === action.value);
        const enabled = access.canWrite && today.nextType === action.value;
        return <article key={action.value} className={`surface-card flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center ${record ? 'border-emerald-200' : ''}`}><action.icon className={`h-6 w-6 ${record ? 'text-emerald-600' : 'text-luvig-blue'}`} /><p className="font-black text-luvig-ink">{action.label}</p><p className="text-sm font-bold text-slate-500">{record ? clockValue(record) : 'Pendente'}</p>{enabled && <button className="primary-button mt-1" type="button" onClick={() => handleClock(action.value)} disabled={status.saving}>{status.saving ? 'Registrando...' : 'Registrar'}</button>}</article>;
      })}</section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-luvig-ink">Ajustes</h2>{access.canWrite && <div className="flex flex-wrap gap-2"><button className="secondary-button" type="button" onClick={() => setShowManualForm((value) => !value)}><CalendarPlus className="h-4 w-4" />Adicionar registro retroativo</button><button className="secondary-button" type="button" onClick={() => setShowStatusForm((value) => !value)}><CalendarCheck className="h-4 w-4" />Marcar situação do dia</button></div>}</div>
        {showManualForm && <form className="surface-card mb-4 grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleManualRecords}>
          <Field label="Data"><input className="input-base" name="reference_date" type="date" max={dateKey(now)} required /></Field>
          {actions.map((action) => <Field key={action.value} label={action.label}><input className="input-base" name={action.value} type="time" /></Field>)}
          <Field label="Motivo obrigatório"><input className="input-base" name="reason" placeholder="Ex.: início do uso do sistema" required /></Field>
          <Field label="Observação opcional"><input className="input-base" name="notes" /></Field>
          <button className="primary-button self-end" type="submit" disabled={status.saving}><CalendarPlus className="h-4 w-4" />Salvar registros</button>
        </form>}
        {showStatusForm && <form className="surface-card mb-4 grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleDayStatus}>
          <Field label="Data"><input className="input-base" name="reference_date" type="date" defaultValue={dateKey(now)} required /></Field>
          <Field label="Situação"><select className="input-base" name="day_status">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Motivo / observação"><input className="input-base" name="reason" placeholder="Obrigatório para datas retroativas" /></Field>
          <Field label="Anexo"><input className="input-base py-3" name="attachment" type="file" accept="image/*,.pdf" /></Field>
          <button className="primary-button self-end" type="submit" disabled={status.saving}><Paperclip className="h-4 w-4" />Salvar situação</button>
        </form>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="Hoje" value={formatMinutes(today.workedMinutes)} /><SummaryCard label="Semana" value={formatMinutes(weekSummary.totalWorkedMinutes)} /><SummaryCard label="Período atual" value={formatMinutes(periodSummary.totalWorkedMinutes)} /><SummaryCard label="Saldo acumulado" value={formatMinutes(periodSummary.balanceMinutes, { signed: true })} tone={periodSummary.balanceMinutes} /></section>
      <details className="surface-card p-5"><summary className="cursor-pointer font-black text-luvig-ink">Ver detalhes dos totais</summary><div className="mt-4 grid gap-4 lg:grid-cols-2"><PeriodCard title="Semana" summary={weekSummary} /><PeriodCard title={period ? `Período · ${formatDate(period.start_date)} a ${formatDate(period.end_date)}` : 'Período atual'} summary={periodSummary} /></div></details>

      <section className="surface-card p-5">
        <h2 className="text-lg font-black text-luvig-ink">Histórico do período</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">O período muda automaticamente no dia 2; registros anteriores permanecem nos relatórios.</p>
        <div className="mt-4 space-y-3">{days.filter((day) => day.records.length || day.justified || day.incomplete).map((day) => <ClockDayRow key={day.referenceDate} day={day} />)}{!days.some((day) => day.records.length || day.justified || day.incomplete) && !status.loading && <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-600">Nenhum registro neste período.</p>}</div>
      </section>
    </div>
  );
}

function Alert({ text }) { return <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{text}</div>; }
function Field({ label, children }) { return <label><span className="field-label">{label}</span>{children}</label>; }
function TopValue({ label, value, tone = 0 }) { return <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 font-black ${tone > 0 ? 'text-emerald-700' : tone < 0 ? 'text-red-700' : 'text-luvig-ink'}`}>{value}</p></div>; }
function SummaryCard({ label, value, tone = 0 }) { return <div className="surface-card p-4"><TopValue label={label} value={value} tone={tone} /></div>; }
function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR'); }
function toneName(tone) { return tone === 'positive' ? 'green' : tone === 'negative' ? 'red' : 'slate'; }

function PeriodCard({ title, summary }) {
  return <section className="surface-card p-5"><h2 className="flex items-center gap-2 text-lg font-black text-luvig-ink"><CalendarDays className="h-5 w-5 text-luvig-blue" />{title}</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><PeriodValue label="Trabalhado" value={formatMinutes(summary.totalWorkedMinutes)} /><PeriodValue label="Esperado" value={formatMinutes(summary.totalExpectedMinutes)} /><PeriodValue label="Saldo" value={formatMinutes(summary.balanceMinutes, { signed: true })} tone={summary.balanceMinutes} /><PeriodValue label="Média" value={formatMinutes(summary.averageMinutes)} /></div><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><Badge tone="green">Extras {formatMinutes(summary.extraMinutes)}</Badge><Badge tone="red">Negativas {formatMinutes(summary.negativeMinutes)}</Badge><Badge>{summary.completeDays} completos</Badge><Badge tone="amber">{summary.incompleteDays} incompletos</Badge><Badge tone="blue">{summary.justifiedDays} justificados</Badge></div></section>;
}

function PeriodValue({ label, value, tone = 0 }) { return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 text-base font-black ${tone > 0 ? 'text-emerald-700' : tone < 0 ? 'text-red-700' : 'text-luvig-ink'}`}>{value}</p></div>; }
function Badge({ children, tone = 'slate' }) { const colors = { green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-800', blue: 'bg-blue-50 text-luvig-blue', slate: 'bg-slate-100 text-slate-600' }; return <span className={`rounded-full px-3 py-1 ${colors[tone]}`}>{children}</span>; }

function ClockDayRow({ day }) {
  const [showEdit, setShowEdit] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const editedRecords = day.records.filter((record) => record.is_edited || record.is_manual);
  async function openAttachment() {
    const result = await getDayStatusAttachmentUrl(day.dayStatus.attachment_url);
    if (result.error || !result.data?.signedUrl) { setAttachmentError(result.error || 'Anexo indisponível.'); return; }
    window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  return <article className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-black text-luvig-ink">{formatDate(day.referenceDate)} · {new Date(`${day.referenceDate}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' })}</p><div className="mt-2 flex flex-wrap gap-2"><Badge tone={day.scheduleAlerts.length ? 'red' : 'slate'}>Horário: {day.scheduleAlerts.length ? 'irregular' : 'regular'}</Badge><Badge tone={toneName(day.journeyTone)}>Jornada: {formatMinutes(day.workedMinutes)}</Badge><Badge tone={toneName(day.journeyTone)}>Saldo: {formatMinutes(day.balanceMinutes, { signed: true })}</Badge>{day.justified && <Badge tone="blue">Justificativa: {day.statusLabel}</Badge>}{day.incomplete && <Badge tone="red">Ponto incompleto</Badge>}{(day.edited || day.manual) && <button type="button" onClick={() => setShowEdit((value) => !value)} title="Registro adicionado ou alterado manualmente" className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Manual</button>}{day.dayStatus?.attachment_url && <button type="button" className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-luvig-blue" onClick={openAttachment}><Paperclip className="h-3 w-3" />Abrir anexo</button>}</div></div><div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm font-semibold text-slate-600 sm:grid-cols-4"><span>Entrada <strong>{clockValue(day.entry)}</strong></span><span>Almoço <strong>{clockValue(day.lunchOut)}</strong></span><span>Retorno <strong>{clockValue(day.lunchReturn)}</strong></span><span>Saída <strong>{clockValue(day.exit)}</strong></span></div></div>{day.scheduleAlerts.length > 0 && <p className="mt-3 text-sm font-bold text-red-700">{day.scheduleAlerts.join(' · ')}</p>}{day.dayStatus?.reason && <p className="mt-2 text-sm font-semibold text-slate-600">Observação: {day.dayStatus.reason}</p>}{attachmentError && <p className="mt-2 text-sm font-bold text-red-700">{attachmentError}</p>}{showEdit && <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{editedRecords.map((record) => <p key={record.id}>{record.is_manual ? 'Registro adicionado manualmente.' : 'Este ponto foi modificado.'} Motivo: {record.manual_reason || record.edit_reason || 'Não informado'} · Registrado por: {record.editor?.full_name || 'Vinícius Miranda'} · {new Date(record.edited_at || record.created_at).toLocaleString('pt-BR')}</p>)}</div>}</article>;
}
