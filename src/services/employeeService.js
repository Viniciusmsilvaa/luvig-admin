import {
  differenceInDays,
  formatDate,
  formatNoticeCountdown,
  formatReturnCountdown,
  formatTenure,
  formatVacationCountdown,
} from '../utils/employeeDates.js';
import { runQuery, toNumber } from './serviceHelpers.js';

const PHOTO_BUCKET = 'employee-photos';

export const employeeStatusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'ferias', label: 'Férias' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'aviso_previo', label: 'Aviso prévio' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'desligado', label: 'Desligado' },
];

const statusLabels = Object.fromEntries(employeeStatusOptions.map(({ value, label }) => [value, label]));
const statusValues = Object.fromEntries(employeeStatusOptions.map(({ value, label }) => [label, value]));

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'LU';
}

function scoreDescription(score) {
  if (score >= 9) return 'Funcionário excelente';
  if (score >= 7) return 'Bom funcionário';
  if (score >= 5) return 'Atenção';
  if (score >= 3) return 'Risco';
  return 'Situação crítica';
}

function specialStatus(row) {
  if (row.status === 'ferias') {
    return `Em férias · ${formatReturnCountdown(row.vacation_return_date)} · ${formatDate(row.vacation_return_date)}`;
  }
  if (row.status === 'atestado') {
    return `Em atestado · ${formatReturnCountdown(row.medical_leave_return_date)} · ${formatDate(row.medical_leave_return_date)}`;
  }
  if (row.status === 'aviso_previo') {
    return `Em aviso prévio · ${formatNoticeCountdown(row.notice_end_date)} · ${formatDate(row.notice_end_date)}`;
  }
  return null;
}

export function mapEmployeeFromDb(row) {
  const score = Math.max(0, Math.min(10, toNumber(row.score, 10)));

  return {
    id: row.id,
    name: row.full_name,
    fullName: row.full_name,
    role: row.role || 'Sem função definida',
    phone: row.phone || '',
    score,
    scoreTrend: row._score_trend || 'Estável',
    scoreUpdatedAt: row._score_updated_at || row.updated_at,
    scoreLabel: scoreDescription(score),
    status: statusLabels[row.status] || row.status || 'Ativo',
    statusValue: row.status || 'ativo',
    tenure: formatTenure(row.admission_date),
    nextVacation: formatVacationCountdown(row.next_vacation_date),
    daysToVacation: differenceInDays(row.next_vacation_date),
    lastOccurrence: row._last_occurrence || 'Sem ocorrência recente',
    admissionDate: row.admission_date || '',
    salary: row.salary === null || row.salary === undefined ? null : toNumber(row.salary),
    avatar: initials(row.full_name),
    photoPath: row.photo_url || '',
    photoUrl: row._display_photo_url || (row.photo_url?.startsWith('http') ? row.photo_url : ''),
    nextVacationDate: row.next_vacation_date || '',
    vacationReturnDate: row.vacation_return_date || '',
    medicalLeaveReturnDate: row.medical_leave_return_date || '',
    noticeStartDate: row.notice_start_date || '',
    noticeEndDate: row.notice_end_date || '',
    dismissalDate: row.dismissal_date || '',
    notes: row.notes || '',
    notice: row.notice_end_date
      ? `${formatNoticeCountdown(row.notice_end_date)} · ${formatDate(row.notice_end_date)}`
      : 'Não possui',
    returnInfo: row.vacation_return_date
      ? `Férias: ${formatReturnCountdown(row.vacation_return_date)} · ${formatDate(row.vacation_return_date)}`
      : row.medical_leave_return_date
        ? `Atestado: ${formatReturnCountdown(row.medical_leave_return_date)} · ${formatDate(row.medical_leave_return_date)}`
        : 'Sem retorno previsto',
    specialStatus: specialStatus(row),
    isInactive: ['inativo', 'desligado'].includes(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function addField(target, key, value, transform = (item) => item) {
  if (value === undefined) return;
  target[key] = value === '' ? null : transform(value);
}

export function serializeEmployeeData(formData) {
  const data = formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData;
  const payload = {};

  addField(payload, 'photo_url', data.photo_url ?? data.photoPath);
  addField(payload, 'full_name', data.full_name ?? data.name);
  addField(payload, 'role', data.role);
  addField(payload, 'phone', data.phone);
  addField(payload, 'admission_date', data.admission_date ?? data.admissionDate);
  addField(payload, 'salary', data.salary, Number);
  addField(payload, 'status', statusValues[data.status] ?? data.status);
  addField(payload, 'score', data.score, Number);
  addField(payload, 'next_vacation_date', data.next_vacation_date ?? data.nextVacationDate);
  addField(payload, 'vacation_return_date', data.vacation_return_date ?? data.vacationReturnDate);
  addField(payload, 'medical_leave_return_date', data.medical_leave_return_date ?? data.medicalLeaveReturnDate);
  addField(payload, 'notice_start_date', data.notice_start_date ?? data.noticeStartDate);
  addField(payload, 'notice_end_date', data.notice_end_date ?? data.noticeEndDate);
  addField(payload, 'dismissal_date', data.dismissal_date ?? data.dismissalDate);
  addField(payload, 'notes', data.notes);

  return payload;
}

async function signedPhotoUrl(client, photoPath) {
  if (!photoPath || photoPath.startsWith('http')) return photoPath || '';
  const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(photoPath, 3600);
  return error ? '' : data?.signedUrl || '';
}

async function enrichRows(client, rows) {
  if (!rows.length) return rows;

  const ids = rows.map((row) => row.id);
  const { data: occurrences } = await client
    .from('occurrences')
    .select('employee_id, title, description, occurrence_date, score_impact, status, updated_at')
    .in('employee_id', ids)
    .order('occurrence_date', { ascending: false });

  const latestByEmployee = new Map();
  const latestConfirmedByEmployee = new Map();
  for (const occurrence of occurrences || []) {
    if (!latestByEmployee.has(occurrence.employee_id)) {
      latestByEmployee.set(
        occurrence.employee_id,
        occurrence.title || occurrence.description || 'Ocorrência registrada',
      );
    }
    if (occurrence.status === 'confirmado' && !latestConfirmedByEmployee.has(occurrence.employee_id)) {
      latestConfirmedByEmployee.set(occurrence.employee_id, occurrence);
    }
  }

  return Promise.all(
    rows.map(async (row) => {
      const latestConfirmed = latestConfirmedByEmployee.get(row.id);
      const impact = Number(latestConfirmed?.score_impact || 0);
      return {
        ...row,
        _display_photo_url: await signedPhotoUrl(client, row.photo_url),
        _last_occurrence: latestByEmployee.get(row.id),
        _score_trend: impact > 0 ? 'Melhorando' : impact < 0 ? 'Piorando' : 'Estável',
        _score_updated_at: latestConfirmed?.updated_at || row.updated_at,
      };
    }),
  );
}

export async function getEmployees() {
  return runQuery(
    async (client) => {
      const result = await client.rpc('list_employees_secure', { target_employee_id: null });
      if (result.error) return result;
      return { data: await enrichRows(client, result.data || []), error: null };
    },
    [],
    'Erro ao carregar funcionários.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map(mapEmployeeFromDb),
  }));
}

export const listEmployees = getEmployees;

export async function getEmployeeOptions() {
  return runQuery(
    (client) => client.rpc('list_employee_options'),
    [],
    'Erro ao carregar opções de funcionários.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map((item) => ({ id: item.id, name: item.full_name, role: item.role || '' })),
  }));
}

export async function getEmployeeById(id) {
  return runQuery(
    async (client) => {
      const result = await client.rpc('list_employees_secure', { target_employee_id: id });
      const employee = result.data?.[0] || null;
      if (result.error || !employee) return { data: null, error: result.error };
      const [row] = await enrichRows(client, [employee]);
      return { data: row, error: null };
    },
    null,
    'Erro ao carregar funcionário.',
  ).then((result) => ({
    ...result,
    data: result.data ? mapEmployeeFromDb(result.data) : null,
  }));
}

export const getEmployee = getEmployeeById;

export async function createEmployee(data) {
  const result = await runQuery(
    (client) => client.from('employees').insert(serializeEmployeeData(data)).select('id').single(),
    null,
    'Erro ao salvar funcionário.',
  );
  return result.data?.id ? getEmployeeById(result.data.id) : result;
}

export async function updateEmployee(id, data) {
  const payload = { ...serializeEmployeeData(data), updated_at: new Date().toISOString() };
  const result = await runQuery(
    (client) => client.from('employees').update(payload).eq('id', id).select('id').single(),
    null,
    'Erro ao atualizar funcionário.',
  );
  return result.data?.id ? getEmployeeById(result.data.id) : result;
}

export async function inactivateEmployee(id) {
  return updateEmployee(id, { status: 'inativo' });
}

export async function reactivateEmployee(id) {
  return updateEmployee(id, { status: 'ativo', dismissal_date: null });
}

export async function uploadEmployeePhoto(file, employeeId) {
  if (!file || !employeeId) {
    return { data: null, error: 'Selecione uma foto válida.', usingFallback: false };
  }
  if (!file.type?.startsWith('image/')) {
    return { data: null, error: 'O arquivo selecionado precisa ser uma imagem.', usingFallback: false };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { data: null, error: 'A foto deve ter no máximo 5 MB.', usingFallback: false };
  }

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${employeeId}/${Date.now()}.${extension}`;
  const result = await runQuery(
    async (client) => {
      const upload = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (upload.error) return upload;
      return {
        data: {
          path: upload.data.path,
          photo_url: upload.data.path,
          signedUrl: await signedPhotoUrl(client, upload.data.path),
        },
        error: null,
      };
    },
    null,
    'Não foi possível salvar a foto.',
  );

  return result.error ? { ...result, error: 'Não foi possível salvar a foto.' } : result;
}

export async function listEmployeeHistory(employeeId) {
  return runQuery(
    (client) =>
      client
        .from('employee_history')
        .select('*')
        .eq('employee_id', employeeId)
        .order('history_date', { ascending: false }),
    [],
    'Erro ao carregar histórico.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map((item) => ({
          type: item.type,
          date: item.history_date,
          description: item.description,
          impact: '0,0',
          title: item.title,
        })),
  }));
}
