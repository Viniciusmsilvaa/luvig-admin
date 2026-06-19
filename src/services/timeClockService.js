import { runQuery } from './serviceHelpers.js';
import {
  buildClockDays,
  calculateClockDay,
  dateKey,
  DEFAULT_WORK_SCHEDULE,
  formatMinutes,
  getPeriodBounds,
  groupClockRecords,
  scheduleForDate,
  summarizeClockDays,
} from '../utils/timeClock.js';

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
        .select('*, editor:profiles!time_clock_edited_by_fkey(full_name), manual_creator:profiles!time_clock_created_manually_by_fkey(full_name)')
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

export async function createManualClockRecords({ referenceDate, entries, reason, notes = '' }) {
  const selectedEntries = Object.entries(entries || {})
    .filter(([, value]) => Boolean(value))
    .map(([clockType, clockTime]) => ({ clock_type: clockType, clock_time: clockTime }));
  if (!referenceDate) return { data: null, error: 'Informe a data do registro.', usingFallback: false };
  if (!selectedEntries.length) return { data: null, error: 'Informe ao menos uma batida.', usingFallback: false };
  if (!reason?.trim()) return { data: null, error: 'Informe o motivo do registro retroativo.', usingFallback: false };
  return runQuery(
    (client) => client.rpc('create_manual_time_clock_records', {
      target_date: referenceDate,
      target_entries: selectedEntries,
      manual_reason: reason.trim(),
      manual_notes: notes?.trim() || null,
    }),
    [],
    'Falha ao adicionar o registro retroativo.',
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

export async function getWorkScheduleSettings(profileId) {
  return runQuery(
    (client) => client.from('work_schedule_settings').select('*').eq('profile_id', profileId).order('valid_from', { ascending: false }),
    [],
    'Falha ao carregar a configuração da jornada.',
  );
}

export async function saveWorkScheduleSettings(values) {
  return runQuery(
    (client) => client.rpc('save_work_schedule_settings', {
      target_weekdays: values.weekdays.map(Number),
      target_expected_start_time: values.expected_start_time,
      target_expected_end_time: values.expected_end_time,
      target_expected_daily_minutes: Number(values.expected_daily_minutes),
      target_expected_break_minutes: Number(values.expected_break_minutes),
      target_expected_break_start: values.expected_break_start || null,
      target_expected_break_end: values.expected_break_end || null,
      target_entry_tolerance_minutes: Number(values.entry_tolerance_minutes),
      target_exit_tolerance_minutes: Number(values.exit_tolerance_minutes),
      target_break_tolerance_minutes: Number(values.break_tolerance_minutes),
      target_valid_from: values.valid_from,
      target_tracking_start_date: values.tracking_start_date,
      change_reason: values.reason || 'Configuração da jornada atualizada',
    }),
    null,
    'Falha ao salvar a configuração da jornada.',
  );
}

export async function getDayStatuses(profileId, { dateFrom, dateTo } = {}) {
  return runQuery(
    (client) => {
      let query = client.from('time_clock_day_status').select('*').eq('profile_id', profileId).order('reference_date', { ascending: false });
      if (dateFrom) query = query.gte('reference_date', dateFrom);
      if (dateTo) query = query.lte('reference_date', dateTo);
      return query;
    },
    [],
    'Falha ao carregar as justificativas do ponto.',
  );
}

export async function saveDayStatus({ referenceDate, status, reason, attachmentUrl }) {
  return runQuery(
    (client) => client.rpc('save_time_clock_day_status', {
      target_date: referenceDate,
      target_status: status,
      target_reason: reason || null,
      target_attachment_url: attachmentUrl || null,
    }),
    null,
    'Falha ao salvar a situação do dia.',
  );
}

export async function removeDayStatus(referenceDate, reason) {
  return runQuery(
    (client) => client.rpc('remove_time_clock_day_status', { target_date: referenceDate, change_reason: reason }),
    null,
    'Falha ao remover a situação do dia.',
  );
}

export async function getHolidays({ dateFrom, dateTo } = {}) {
  return runQuery(
    (client) => {
      let query = client.from('time_clock_holidays').select('*').order('holiday_date', { ascending: true });
      if (dateFrom) query = query.gte('holiday_date', dateFrom);
      if (dateTo) query = query.lte('holiday_date', dateTo);
      return query;
    },
    [],
    'Falha ao carregar feriados.',
  );
}

export async function saveHoliday(values) {
  return runQuery(
    (client) => client.rpc('save_time_clock_holiday', {
      target_id: values.id || null,
      target_name: values.name,
      target_date: values.holiday_date,
      target_type: values.holiday_type,
      target_notes: values.notes || null,
    }),
    null,
    'Falha ao salvar o feriado.',
  );
}

export async function deleteHoliday(id) {
  return runQuery((client) => client.rpc('delete_time_clock_holiday', { target_id: id }), null, 'Falha ao remover o feriado.');
}

export async function ensureClockPeriod(targetDate = dateKey()) {
  return runQuery((client) => client.rpc('ensure_time_clock_period', { target_date: targetDate }), null, 'Falha ao iniciar o período do ponto.');
}

export async function updateClockPeriodTotals(periodId, summary) {
  return runQuery(
    (client) => client.rpc('update_time_clock_period_totals', {
      target_period_id: periodId,
      target_worked: summary.totalWorkedMinutes,
      target_expected: summary.totalExpectedMinutes,
      target_balance: summary.balanceMinutes,
    }),
    null,
    'Falha ao atualizar os totais do período.',
  );
}

export async function uploadDayStatusAttachment(profileId, file) {
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  const path = `${profileId}/${Date.now()}-${safeName}`;
  const result = await runQuery(
    (client) => client.storage.from('time-clock-attachments').upload(path, file, { upsert: false }),
    null,
    'Falha ao enviar o anexo.',
  );
  return { ...result, path: result.error ? null : path };
}

export async function getDayStatusAttachmentUrl(path) {
  return runQuery(
    (client) => client.storage.from('time-clock-attachments').createSignedUrl(path, 900),
    null,
    'Falha ao abrir o anexo.',
  );
}

function startOfWeekKey(now) {
  const current = new Date(`${dateKey(now)}T12:00:00-03:00`);
  const weekday = current.getDay() || 7;
  current.setDate(current.getDate() - weekday + 1);
  return dateKey(current);
}

function legacyPeriodSummary(records, startDate, now = new Date()) {
  const days = buildClockDays({ records, settings: [DEFAULT_WORK_SCHEDULE], startDate, endDate: dateKey(now), now });
  const summary = summarizeClockDays(days);
  return { totalMs: summary.totalWorkedMinutes * 60000, total: formatMinutes(summary.totalWorkedMinutes), daysRegistered: days.length, averageMs: summary.averageMinutes * 60000, average: formatMinutes(summary.averageMinutes) };
}

export function getTodayClock(records, now = new Date(), schedule = DEFAULT_WORK_SCHEDULE, options = {}) {
  const todayRecords = groupClockRecords(records).get(dateKey(now)) || [];
  return calculateClockDay(todayRecords, schedule, { ...options, now, referenceDate: dateKey(now), isToday: true });
}

export function getWeekClockSummary(records, now = new Date()) {
  return legacyPeriodSummary(records, startOfWeekKey(now), now);
}

export function getMonthClockSummary(records, now = new Date()) {
  return legacyPeriodSummary(records, `${dateKey(now).slice(0, 7)}-01`, now);
}

export function formatWorkedTime(milliseconds) {
  return formatMinutes(Math.max(0, Math.floor(Number(milliseconds || 0) / 60000)));
}

export function getTimeClockSummary(records, now = new Date()) {
  const today = getTodayClock(records, now);
  const week = getWeekClockSummary(records, now);
  const month = getMonthClockSummary(records, now);
  return { today: formatWorkedTime(today.workedMs), week: week.total, month: month.total };
}

export { buildClockDays, calculateClockDay, dateKey, DEFAULT_WORK_SCHEDULE, formatMinutes, getPeriodBounds, scheduleForDate, summarizeClockDays };
