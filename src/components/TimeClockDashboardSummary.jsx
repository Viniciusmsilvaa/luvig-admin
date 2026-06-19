import { AlertTriangle, CalendarCheck, Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTimeClockAccess } from '../auth/accessRules.js';
import { useAuth } from '../context/AuthContext.jsx';
import { buildClockDays, ensureClockPeriod, formatMinutes, getClockHistory, getDayStatuses, getHolidays, getTimeClockOwnerId, getWorkScheduleSettings, summarizeClockDays } from '../services/timeClockService.js';
import StatCard from './StatCard.jsx';

export default function TimeClockDashboardSummary() {
  const { profile, user } = useAuth();
  const access = getTimeClockAccess(profile, user);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!access.canWrite) return undefined;
    let active = true;
    (async () => {
      const owner = await getTimeClockOwnerId();
      const period = await ensureClockPeriod();
      if (owner.error || period.error || !period.data) { if (active) setError(owner.error || period.error || 'Período não encontrado.'); return; }
      const bounds = { dateFrom: period.data.start_date, dateTo: period.data.end_date };
      const [records, settings, statuses, holidays] = await Promise.all([getClockHistory(owner.data, { limit: 2000 }), getWorkScheduleSettings(owner.data), getDayStatuses(owner.data, bounds), getHolidays(bounds)]);
      const loadError = records.error || settings.error || statuses.error || holidays.error;
      if (loadError) { if (active) setError(loadError); return; }
      const days = buildClockDays({ records: records.data, settings: settings.data, statuses: statuses.data, holidays: holidays.data, startDate: bounds.dateFrom, endDate: bounds.dateTo, includeEmpty: true });
      if (active) setSummary(summarizeClockDays(days));
    })();
    return () => { active = false; };
  }, [access.canWrite]);

  if (!access.canWrite) return null;
  if (error) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Resumo do ponto indisponível: {error}</div>;
  if (!summary) return <div className="surface-card p-5 text-sm font-bold text-slate-500">Carregando resumo mensal do ponto...</div>;
  return <section><h2 className="mb-3 text-lg font-black text-luvig-ink">Meu Ponto · período atual</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><StatCard label="Esperado" value={formatMinutes(summary.totalExpectedMinutes)} icon={Timer} /><StatCard label="Trabalhado" value={formatMinutes(summary.totalWorkedMinutes)} icon={Timer} tone="green" /><StatCard label="Saldo" value={formatMinutes(summary.balanceMinutes, { signed: true })} icon={summary.balanceMinutes < 0 ? TrendingDown : TrendingUp} tone={summary.balanceMinutes < 0 ? 'red' : 'green'} /><StatCard label="Dias regulares" value={summary.regularDays} icon={CalendarCheck} tone="green" /><StatCard label="Dias irregulares" value={summary.irregularDays} icon={AlertTriangle} tone="red" /><StatCard label="Horas extras" value={formatMinutes(summary.extraMinutes)} icon={TrendingUp} tone="green" /><StatCard label="Horas negativas" value={formatMinutes(summary.negativeMinutes)} icon={TrendingDown} tone="red" /></div></section>;
}
