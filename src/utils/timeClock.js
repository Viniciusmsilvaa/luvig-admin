export const CLOCK_TYPES = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida'];
export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export const DEFAULT_WORK_SCHEDULE = {
  weekdays: [1, 2, 3, 4, 5],
  expected_start_time: '10:00',
  expected_end_time: '17:30',
  expected_daily_minutes: 390,
  expected_break_minutes: 60,
  expected_break_start: null,
  expected_break_end: null,
  entry_tolerance_minutes: 5,
  exit_tolerance_minutes: 5,
  break_tolerance_minutes: 5,
  valid_from: '2026-06-17',
  tracking_start_date: '2026-06-17',
};

const DAY_STATUS_LABELS = {
  folga: 'Folga',
  atestado: 'Atestado',
  ferias: 'Férias',
  feriado: 'Feriado',
  outro_justificado: 'Outro justificado',
};

function zonedParts(value, options = {}) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    ...options,
  });
  return Object.fromEntries(formatter.formatToParts(new Date(value)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

export function dateKey(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = zonedParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function minutesOfDay(value) {
  const parts = zonedParts(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

export function weekdayForDate(key) {
  return new Date(`${key}T12:00:00-03:00`).getUTCDay();
}

export function formatMinutes(value, { signed = false } = {}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const rounded = Math.trunc(Number(value));
  const absolute = Math.abs(rounded);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const body = hours ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes}min`;
  if (!signed) return `${rounded < 0 ? '-' : ''}${body}`;
  return `${rounded > 0 ? '+' : rounded < 0 ? '-' : ''}${body}`;
}

export function getPeriodBounds(value = new Date()) {
  const key = dateKey(value);
  const [year, month, day] = key.split('-').map(Number);
  const start = day >= 2 ? new Date(Date.UTC(year, month - 1, 2)) : new Date(Date.UTC(year, month - 2, 2));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function enumerateDates(startDate, endDate) {
  const dates = [];
  const current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function scheduleForDate(settings = [], key = dateKey()) {
  if (!Array.isArray(settings)) return { ...DEFAULT_WORK_SCHEDULE, ...(settings || {}) };
  const applicable = settings
    .filter((item) => !item.valid_from || item.valid_from <= key)
    .sort((a, b) => String(b.valid_from || '').localeCompare(String(a.valid_from || '')))[0];
  return { ...DEFAULT_WORK_SCHEDULE, ...(applicable || {}) };
}

function firstAfter(records, type, after = -Infinity) {
  return records.find((record) => record.clock_type === type && new Date(record.clock_time).getTime() >= after) || null;
}

function durationMinutes(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((new Date(end.clock_time).getTime() - new Date(start.clock_time).getTime()) / 60000));
}

export function calculateClockDay(records = [], scheduleInput = DEFAULT_WORK_SCHEDULE, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const referenceDate = options.referenceDate || dateKey(records[0]?.clock_time || now);
  const schedule = { ...DEFAULT_WORK_SCHEDULE, ...(scheduleInput || {}) };
  const ascending = records.filter((record) => !record.deleted_at).sort((a, b) => new Date(a.clock_time) - new Date(b.clock_time));
  const entry = firstAfter(ascending, 'entrada');
  const lunchOut = entry ? firstAfter(ascending, 'saida_almoco', new Date(entry.clock_time).getTime()) : null;
  const lunchReturn = lunchOut ? firstAfter(ascending, 'retorno_almoco', new Date(lunchOut.clock_time).getTime()) : null;
  const exit = lunchReturn ? firstAfter(ascending, 'saida', new Date(lunchReturn.clock_time).getTime()) : null;
  const actualTypes = ascending.map((record) => record.clock_type);
  const invalidSequence = actualTypes.some((type, index) => type !== CLOCK_TYPES[index]) || actualTypes.length > CLOCK_TYPES.length;
  const isToday = options.isToday ?? referenceDate === dateKey(now);
  let workedMinutes = 0;
  let intervalMinutes = 0;
  let inProgress = false;

  if (entry && lunchOut) workedMinutes += durationMinutes(entry, lunchOut);
  else if (entry && isToday && !invalidSequence) {
    workedMinutes += Math.max(0, Math.floor((now.getTime() - new Date(entry.clock_time).getTime()) / 60000));
    inProgress = true;
  }
  if (lunchOut && lunchReturn) intervalMinutes = durationMinutes(lunchOut, lunchReturn);
  else if (lunchOut && isToday && !invalidSequence) intervalMinutes = Math.max(0, Math.floor((now.getTime() - new Date(lunchOut.clock_time).getTime()) / 60000));
  if (lunchReturn && exit) workedMinutes += durationMinutes(lunchReturn, exit);
  else if (lunchReturn && isToday && !invalidSequence) {
    workedMinutes += Math.max(0, Math.floor((now.getTime() - new Date(lunchReturn.clock_time).getTime()) / 60000));
    inProgress = true;
  }

  const dayStatus = options.dayStatus || null;
  const holiday = options.holiday || null;
  const justified = Boolean(dayStatus || holiday);
  const isScheduledDay = (schedule.weekdays || []).map(Number).includes(weekdayForDate(referenceDate));
  const beforeTrackingStart = referenceDate < (schedule.tracking_start_date || DEFAULT_WORK_SCHEDULE.tracking_start_date);
  const futureDay = referenceDate > dateKey(now);
  const expectedMinutes = justified || !isScheduledDay || beforeTrackingStart || futureDay ? 0 : Number(schedule.expected_daily_minutes || 0);
  const complete = Boolean(entry && lunchOut && lunchReturn && exit && !invalidSequence);
  const missingTypes = CLOCK_TYPES.filter((type) => !actualTypes.includes(type));
  const hasStarted = ascending.length > 0;
  const pastDay = referenceDate < dateKey(now);
  const afterExpectedEnd = isToday && minutesOfDay(now) >= timeToMinutes(schedule.expected_end_time);
  const closedDay = pastDay || afterExpectedEnd;
  const incomplete = !justified && expectedMinutes > 0 && ((hasStarted && !complete && !inProgress) || invalidSequence || (!hasStarted && closedDay));
  const beforeExpectedEnd = isToday && minutesOfDay(now) < timeToMinutes(schedule.expected_end_time);
  const provisionalDay = isToday && !exit && beforeExpectedEnd;
  const rawBalanceMinutes = justified && !hasStarted ? 0 : workedMinutes - expectedMinutes;
  const balanceMinutes = provisionalDay ? Math.max(0, rawBalanceMinutes) : rawBalanceMinutes;
  const entryDifference = entry ? minutesOfDay(entry.clock_time) - timeToMinutes(schedule.expected_start_time) : null;
  const exitDifference = exit ? minutesOfDay(exit.clock_time) - timeToMinutes(schedule.expected_end_time) : null;
  const entryIrregular = entryDifference !== null && Math.abs(entryDifference) > Number(schedule.entry_tolerance_minutes || 0);
  const exitIrregular = exitDifference !== null && Math.abs(exitDifference) > Number(schedule.exit_tolerance_minutes || 0);
  const breakIrregular = lunchOut && lunchReturn && intervalMinutes > Number(schedule.expected_break_minutes || 0) + Number(schedule.break_tolerance_minutes || 0);
  const scheduleAlerts = [
    entryIrregular ? (entryDifference > 0 ? 'Entrada atrasada' : 'Entrada antecipada fora da tolerância') : null,
    exitIrregular ? (exitDifference < 0 ? 'Saída antecipada' : 'Saída após o horário') : null,
    breakIrregular ? 'Intervalo acima do previsto' : null,
  ].filter(Boolean);
  if (incomplete) scheduleAlerts.push(`Ponto incompleto: faltando ${missingTypes.join(', ').replaceAll('_', ' ') || 'sequência válida'}`);

  const nextType = !invalidSequence && actualTypes.length < CLOCK_TYPES.length ? CLOCK_TYPES[actualTypes.length] : null;
  return {
    referenceDate, records: ascending, entry, lunchOut, lunchReturn, exit,
    workedMinutes, intervalMinutes, workedMs: workedMinutes * 60000, intervalMs: intervalMinutes * 60000,
    expectedMinutes, balanceMinutes, inProgress, complete, incomplete, invalidSequence, missingTypes, nextType,
    isScheduledDay, justified, dayStatus, holiday, beforeTrackingStart, provisionalDay,
    statusLabel: dayStatus ? DAY_STATUS_LABELS[dayStatus.status] || dayStatus.status : holiday ? `Feriado · ${holiday.name}` : complete ? 'Finalizada' : incomplete && !hasStarted ? 'Sem registros' : incomplete ? 'Incompleta' : lunchOut && !lunchReturn ? 'Em intervalo' : inProgress ? 'Em andamento' : 'Não iniciada',
    scheduleAlerts,
    hasScheduleIrregularity: scheduleAlerts.some((alert) => !alert.startsWith('Ponto incompleto')),
    journeyTone: balanceMinutes > 0 ? 'positive' : balanceMinutes < 0 ? 'negative' : 'neutral',
    scheduleTone: scheduleAlerts.length ? 'negative' : 'neutral',
    edited: ascending.some((record) => record.is_edited),
    manual: ascending.some((record) => record.is_manual),
  };
}

export function groupClockRecords(records = []) {
  return records.reduce((map, record) => {
    if (record.deleted_at) return map;
    const key = dateKey(record.clock_time);
    map.set(key, [...(map.get(key) || []), record]);
    return map;
  }, new Map());
}

export function buildClockDays({ records = [], settings = [], statuses = [], holidays = [], startDate, endDate, now = new Date(), includeEmpty = false }) {
  const grouped = groupClockRecords(records);
  const statusMap = new Map(statuses.map((item) => [item.reference_date, item]));
  const holidayMap = new Map(holidays.map((item) => [item.holiday_date, item]));
  let dates = [...new Set([...grouped.keys(), ...statusMap.keys(), ...holidayMap.keys()])].sort();
  if (startDate && endDate && includeEmpty) dates = enumerateDates(startDate, endDate);
  return dates
    .filter((key) => (!startDate || key >= startDate) && (!endDate || key <= endDate) && key <= dateKey(now))
    .map((key) => calculateClockDay(grouped.get(key) || [], scheduleForDate(settings, key), {
      referenceDate: key, dayStatus: statusMap.get(key), holiday: holidayMap.get(key), now, isToday: key === dateKey(now),
    }))
    .sort((a, b) => b.referenceDate.localeCompare(a.referenceDate));
}

export function summarizeClockDays(days = []) {
  const completed = days.filter((day) => day.complete);
  const totalWorkedMinutes = days.reduce((total, day) => total + day.workedMinutes, 0);
  const totalExpectedMinutes = days.reduce((total, day) => total + day.expectedMinutes, 0);
  const balances = days.map((day) => day.balanceMinutes);
  return {
    totalWorkedMinutes,
    totalExpectedMinutes,
    balanceMinutes: days.reduce((total, day) => total + day.balanceMinutes, 0),
    extraMinutes: balances.filter((value) => value > 0).reduce((total, value) => total + value, 0),
    negativeMinutes: Math.abs(balances.filter((value) => value < 0).reduce((total, value) => total + value, 0)),
    averageMinutes: completed.length ? Math.round(completed.reduce((total, day) => total + day.workedMinutes, 0) / completed.length) : 0,
    completeDays: completed.length,
    incompleteDays: days.filter((day) => day.incomplete).length,
    justifiedDays: days.filter((day) => day.justified).length,
    regularDays: days.filter((day) => day.complete && !day.scheduleAlerts.length && day.balanceMinutes >= 0).length,
    irregularDays: days.filter((day) => day.incomplete || day.scheduleAlerts.length || day.balanceMinutes < 0).length,
  };
}

export function dayStatusLabel(status) {
  return DAY_STATUS_LABELS[status] || status || '—';
}
