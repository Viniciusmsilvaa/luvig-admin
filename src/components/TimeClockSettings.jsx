import { CalendarCog, CalendarPlus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getTimeClockAccess } from '../auth/accessRules.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  DEFAULT_WORK_SCHEDULE,
  deleteHoliday,
  getHolidays,
  getTimeClockOwnerId,
  getWorkScheduleSettings,
  saveHoliday,
  saveWorkScheduleSettings,
} from '../services/timeClockService.js';
import FormInput from './FormInput.jsx';

const weekdays = [
  [1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [0, 'Domingo'],
];

function normalizeSchedule(value) {
  return {
    ...DEFAULT_WORK_SCHEDULE,
    ...(value || {}),
    expected_start_time: String(value?.expected_start_time || DEFAULT_WORK_SCHEDULE.expected_start_time).slice(0, 5),
    expected_end_time: String(value?.expected_end_time || DEFAULT_WORK_SCHEDULE.expected_end_time).slice(0, 5),
    expected_break_start: value?.expected_break_start ? String(value.expected_break_start).slice(0, 5) : '',
    expected_break_end: value?.expected_break_end ? String(value.expected_break_end).slice(0, 5) : '',
    weekdays: (value?.weekdays || DEFAULT_WORK_SCHEDULE.weekdays).map(Number),
  };
}

export default function TimeClockSettings() {
  const { profile, user } = useAuth();
  const access = getTimeClockAccess(profile, user);
  const [schedule, setSchedule] = useState(() => normalizeSchedule());
  const [holidays, setHolidays] = useState([]);
  const [state, setState] = useState({ loading: true, saving: false, message: '', error: '' });

  const load = useCallback(async () => {
    if (!access.canView) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    const owner = await getTimeClockOwnerId();
    if (owner.error || !owner.data) {
      setState((current) => ({ ...current, loading: false, error: owner.error || 'Perfil do Vinícius não encontrado.' }));
      return;
    }
    const [scheduleResult, holidayResult] = await Promise.all([getWorkScheduleSettings(owner.data), getHolidays()]);
    setSchedule(normalizeSchedule(scheduleResult.data?.[0]));
    setHolidays(holidayResult.data || []);
    setState((current) => ({ ...current, loading: false, error: scheduleResult.error || holidayResult.error || '' }));
  }, [access.canView]);

  useEffect(() => { load(); }, [load]);
  if (!access.canView) return null;

  function setField(name, value) {
    setSchedule((current) => ({ ...current, [name]: value }));
  }

  function toggleWeekday(day) {
    if (!access.canWrite) return;
    setSchedule((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day) ? current.weekdays.filter((item) => item !== day) : [...current.weekdays, day],
    }));
  }

  async function handleSchedule(event) {
    event.preventDefault();
    setState((current) => ({ ...current, saving: true, message: '', error: '' }));
    const result = await saveWorkScheduleSettings(schedule);
    setState((current) => ({ ...current, saving: false, message: result.error ? '' : 'Jornada salva com sucesso.', error: result.error || '' }));
    if (!result.error) await load();
  }

  async function handleHoliday(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setState((current) => ({ ...current, saving: true, message: '', error: '' }));
    const result = await saveHoliday(values);
    setState((current) => ({ ...current, saving: false, message: result.error ? '' : 'Feriado salvo com sucesso.', error: result.error || '' }));
    if (!result.error) { event.currentTarget.reset(); await load(); }
  }

  async function handleDeleteHoliday(id) {
    if (!window.confirm('Remover este feriado?')) return;
    const result = await deleteHoliday(id);
    setState((current) => ({ ...current, message: result.error ? '' : 'Feriado removido.', error: result.error || '' }));
    if (!result.error) await load();
  }

  const disabled = !access.canWrite || state.saving;
  return (
    <>
      <section className="surface-card p-5">
        <Header icon={CalendarCog} title="Configuração da jornada" subtitle={access.canWrite ? 'A jornada vigente alimenta todos os cálculos do ponto.' : 'Consulta da jornada de Vinícius, sem permissão de alteração.'} />
        {(state.loading || state.error || state.message) && <div className={`mt-4 rounded-xl border p-3 text-sm font-bold ${state.error ? 'border-red-200 bg-red-50 text-red-700' : state.message ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{state.loading ? 'Carregando jornada...' : state.error || state.message}</div>}
        <form className="mt-5" onSubmit={handleSchedule}>
          <fieldset disabled={disabled}>
            <legend className="field-label">Dias trabalhados</legend>
            <div className="flex flex-wrap gap-2">{weekdays.map(([day, label]) => <label key={day} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-bold ${schedule.weekdays.includes(day) ? 'border-luvig-blue bg-blue-50 text-luvig-blue' : 'border-slate-200 text-slate-500'}`}><input className="sr-only" type="checkbox" checked={schedule.weekdays.includes(day)} onChange={() => toggleWeekday(day)} />{label}</label>)}</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormInput label="Entrada prevista" type="time" value={schedule.expected_start_time} onChange={(event) => setField('expected_start_time', event.target.value)} required />
              <FormInput label="Saída prevista" type="time" value={schedule.expected_end_time} onChange={(event) => setField('expected_end_time', event.target.value)} required />
              <FormInput label="Meta diária (minutos)" type="number" min="1" max="1440" value={schedule.expected_daily_minutes} onChange={(event) => setField('expected_daily_minutes', event.target.value)} required />
              <FormInput label="Intervalo previsto (minutos)" type="number" min="0" max="720" value={schedule.expected_break_minutes} onChange={(event) => setField('expected_break_minutes', event.target.value)} required />
              <FormInput label="Início previsto do intervalo (opcional)" type="time" value={schedule.expected_break_start || ''} onChange={(event) => setField('expected_break_start', event.target.value)} />
              <FormInput label="Retorno previsto do intervalo (opcional)" type="time" value={schedule.expected_break_end || ''} onChange={(event) => setField('expected_break_end', event.target.value)} />
              <FormInput label="Tolerância de entrada (min)" type="number" min="0" max="180" value={schedule.entry_tolerance_minutes} onChange={(event) => setField('entry_tolerance_minutes', event.target.value)} required />
              <FormInput label="Tolerância de saída (min)" type="number" min="0" max="180" value={schedule.exit_tolerance_minutes} onChange={(event) => setField('exit_tolerance_minutes', event.target.value)} required />
              <FormInput label="Tolerância do intervalo (min)" type="number" min="0" max="180" value={schedule.break_tolerance_minutes} onChange={(event) => setField('break_tolerance_minutes', event.target.value)} required />
              <FormInput label="Válida a partir de" type="date" value={schedule.valid_from} onChange={(event) => setField('valid_from', event.target.value)} required />
              <FormInput label="Início do controle" type="date" value={schedule.tracking_start_date} onChange={(event) => setField('tracking_start_date', event.target.value)} required />
              {access.canWrite && <div className="md:col-span-2"><FormInput label="Motivo da alteração" value={schedule.reason || ''} onChange={(event) => setField('reason', event.target.value)} placeholder="Ex.: ajuste da jornada a partir deste mês" /></div>}
            </div>
          </fieldset>
          {access.canWrite && <button className="primary-button mt-5" type="submit" disabled={state.saving}><Save className="h-4 w-4" />{state.saving ? 'Salvando...' : 'Salvar jornada'}</button>}
        </form>
      </section>

      <section className="surface-card p-5">
        <Header icon={CalendarPlus} title="Feriados" subtitle="Cadastro manual usado para não gerar saldo negativo e considerar trabalho como extra." />
        {access.canWrite && <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleHoliday}>
          <FormInput label="Nome do feriado" name="name" required />
          <FormInput label="Data" name="holiday_date" type="date" required />
          <FormInput label="Tipo" name="holiday_type" as="select" options={[['nacional', 'Nacional'], ['estadual', 'Estadual'], ['municipal', 'Municipal'], ['interno', 'Interno']].map(([value, label]) => ({ value, label }))} />
          <FormInput label="Observação" name="notes" />
          <button className="primary-button self-end" type="submit" disabled={state.saving}><CalendarPlus className="h-4 w-4" />Adicionar</button>
        </form>}
        <div className="mt-5 grid gap-3 md:grid-cols-2">{holidays.map((holiday) => <article key={holiday.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-black text-luvig-ink">{holiday.name}</p><p className="text-sm font-semibold text-slate-500">{new Date(`${holiday.holiday_date}T12:00:00`).toLocaleDateString('pt-BR')} · {holiday.holiday_type}</p>{holiday.notes && <p className="mt-1 text-xs text-slate-500">{holiday.notes}</p>}</div>{access.canWrite && <button className="quiet-button px-2 text-red-700" type="button" onClick={() => handleDeleteHoliday(holiday.id)} aria-label={`Remover ${holiday.name}`}><Trash2 className="h-4 w-4" /></button>}</article>)}{!holidays.length && !state.loading && <p className="text-sm font-semibold text-slate-500">Nenhum feriado cadastrado.</p>}</div>
      </section>
    </>
  );
}

function Header({ icon: Icon, title, subtitle }) {
  return <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-luvig-light text-luvig-blue"><Icon className="h-5 w-5" /></div><div><h2 className="font-black text-luvig-ink">{title}</h2><p className="text-sm font-semibold text-slate-500">{subtitle}</p></div></div>;
}
