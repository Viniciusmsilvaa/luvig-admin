import { runQuery } from './serviceHelpers.js';

const CLOCK_TYPES = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida'];
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export const clockTypeOptions = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida_almoco', label: 'Saída almoço' },
  { value: 'retorno_almoco', label: 'Retorno almoço' },
  { value: 'saida', label: 'Saída' },
];

export async function getTimeClockOwnerId() {
  return runQuery(
    (client) => client.rpc('time_clock_owner_id'),
    null,
    'Falha ao localizar o perfil do Vinícius.',
  );
}

export async function getClockHistory(profileId, { includeDeleted = false, limit = 500 } = {}) {
  return runQuery(
    (client) => {
      let query = client
        .from('time_clock')
        .select('*, editor:profiles!time_clock_edited_by_fkey(full_name)')
        .eq('profile_id', profileId)
        .order('clock_time', { ascending: false })
        .limit(limit);
      if (!includeDeleted) query = query.is('deleted_at', null);
      return query;
    },
    [],
    'Falha ao carregar registros de ponto.',
  );
}

export const listTimeClock = (profileId, limit = 500) => getClockHistory(profileId, { limit });

export async function createClockRecord(clockType, notes = '') {
  return runQuery(
    (client) => client.rpc('create_time_clock_record', { target_clock_type: clockType, target_notes: notes || null }),
    null,
    'Falha ao registrar ponto.',
  );
}

export const createTimeClock = (_profileId, clockType) => createClockRecord(clockType);

export async function updateClockRecord(id, { clockType, clockTime, notes, reason }) {
  if (!reason?.trim()) return { data: null, error: 'Informe o motivo da alteração.', usingFallback: false };
  return runQuery(
    (client) => client.rpc('update_time_clock_record', {
      target_record_id: id,
      target_clock_type: clockType,
      target_clock_time: clockTime,
      target_notes: notes || null,
      change_reason: reason.trim(),
    }),
    null,
    'Falha ao alterar ponto.',
  );
}

export async function softDeleteClockRecord(id, reason) {
  if (!reason?.trim()) return { data: null, error: 'Informe o motivo da remoção.', usingFallback: false };
  return runQuery(
    (client) => client.rpc('soft_delete_time_clock_record', { target_record_id: id, change_reason: reason.trim() }),
    null,
    'Falha ao remover ponto.',
  );
}

export async function getClockAudit(limit = 200) {
  return runQuery(
    (client) => client
      .from('time_clock_audit')
      .select('*, changer:profiles!time_clock_audit_changed_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    [],
    'Falha ao carregar auditoria do ponto.',
  );
}

function dateKey(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

function startOfWeekKey(now) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return dateKey(date);
}

function groupByDay(records) {
  return records.reduce((days, record) => {
    if (record.deleted_at) return days;
    const key = dateKey(record.clock_time);
    days.set(key, [...(days.get(key) || []), record]);
    return days;
  }, new Map());
}

function firstAfter(records, type, after = -Infinity) {
  return records.find((record) => record.clock_type === type && new Date(record.clock_time).getTime() >= after) || null;
}

export function calculateClockDay(records, now = new Date(), isToday = false) {
  const ascending = [...records].sort((a, b) => new Date(a.clock_time) - new Date(b.clock_time));
  const entry = firstAfter(ascending, 'entrada');
  const lunchOut = entry ? firstAfter(ascending, 'saida_almoco', new Date(entry.clock_time).getTime()) : null;
  const lunchReturn = lunchOut ? firstAfter(ascending, 'retorno_almoco', new Date(lunchOut.clock_time).getTime()) : null;
  const exit = lunchReturn ? firstAfter(ascending, 'saida', new Date(lunchReturn.clock_time).getTime()) : null;
  const currentTime = new Date(now).getTime();
  let workedMs = 0;
  let intervalMs = 0;
  let inProgress = false;

  if (entry && lunchOut) workedMs += Math.max(0, new Date(lunchOut.clock_time) - new Date(entry.clock_time));
  else if (entry && isToday) { workedMs += Math.max(0, currentTime - new Date(entry.clock_time).getTime()); inProgress = true; }

  if (lunchOut && lunchReturn) intervalMs = Math.max(0, new Date(lunchReturn.clock_time) - new Date(lunchOut.clock_time));
  else if (lunchOut && isToday) intervalMs = Math.max(0, currentTime - new Date(lunchOut.clock_time).getTime());

  if (lunchReturn && exit) workedMs += Math.max(0, new Date(exit.clock_time) - new Date(lunchReturn.clock_time));
  else if (lunchReturn && isToday) { workedMs += Math.max(0, currentTime - new Date(lunchReturn.clock_time).getTime()); inProgress = true; }

  const actualTypes = ascending.map((record) => record.clock_type);
  const expectedPrefix = CLOCK_TYPES.slice(0, actualTypes.length);
  const invalidSequence = actualTypes.some((type, index) => type !== expectedPrefix[index]) || actualTypes.length > CLOCK_TYPES.length;
  const complete = Boolean(entry && lunchOut && lunchReturn && exit && !invalidSequence);
  const incomplete = Boolean(ascending.length && (invalidSequence || (!isToday && !complete)));

  return { records: ascending, entry, lunchOut, lunchReturn, exit, workedMs, intervalMs, inProgress, complete, incomplete };
}

function periodSummary(records, startKey, now = new Date()) {
  const todayKey = dateKey(now);
  const days = [...groupByDay(records)].filter(([key]) => key >= startKey && key <= todayKey);
  const summaries = days.map(([key, dayRecords]) => calculateClockDay(dayRecords, now, key === todayKey));
  const totalMs = summaries.reduce((total, item) => total + item.workedMs, 0);
  const daysRegistered = summaries.filter((item) => item.records.length > 0).length;
  return {
    totalMs,
    total: formatWorkedTime(totalMs),
    daysRegistered,
    averageMs: daysRegistered ? totalMs / daysRegistered : 0,
    average: formatWorkedTime(daysRegistered ? totalMs / daysRegistered : 0),
  };
}

export function getTodayClock(records, now = new Date()) {
  const todayRecords = groupByDay(records).get(dateKey(now)) || [];
  const summary = calculateClockDay(todayRecords, now, true);
  const nextType = summary.records.length < CLOCK_TYPES.length && !summary.incomplete
    ? CLOCK_TYPES[summary.records.length]
    : null;
  return { ...summary, nextType };
}

export function getWeekClockSummary(records, now = new Date()) {
  return periodSummary(records, startOfWeekKey(now), now);
}

export function getMonthClockSummary(records, now = new Date()) {
  const start = `${dateKey(now).slice(0, 7)}-01`;
  return periodSummary(records, start, now);
}

export function formatWorkedTime(milliseconds) {
  const minutes = Math.max(0, Math.floor(Number(milliseconds || 0) / 60000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
}

export function getTimeClockSummary(records, now = new Date()) {
  const today = getTodayClock(records, now);
  const week = getWeekClockSummary(records, now);
  const month = getMonthClockSummary(records, now);
  return { today: formatWorkedTime(today.workedMs), week: week.total, month: month.total };
}
