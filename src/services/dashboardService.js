import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { getFriendlyError } from './serviceHelpers.js';

const EMPTY_FINANCIAL = { entriesTotal: 0, expensesTotal: 0, balance: 0, pendingClients: 0 };

function monthBounds(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  const local = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: local(start), end: local(end) };
}

async function queryOrThrow(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data || [];
}

const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
const isInMonth = (value, start, end) => Boolean(value && value >= start && value <= end);

function normalizeEmployee(row) {
  return {
    id: row.id,
    name: row.full_name,
    role: row.role || 'Sem função definida',
    score: Number(row.score || 0),
    statusValue: row.status,
    admissionDate: row.admission_date,
    nextVacationDate: row.next_vacation_date,
    vacationReturnDate: row.vacation_return_date,
    medicalLeaveReturnDate: row.medical_leave_return_date,
    noticeEndDate: row.notice_end_date,
  };
}

function normalizeOccurrence(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title || row.type,
    date: row.occurrence_date,
    statusValue: row.status,
    employee: row.employees?.full_name || 'Sem funcionário vinculado',
    employeeId: row.employee_id,
    createdBy: row.created_by,
  };
}

function normalizeRequest(row) {
  return {
    id: row.id,
    title: row.title,
    statusValue: row.status,
    requestedBy: row.requested_by,
    date: row.created_at,
    target: row.clients?.name || row.employees?.full_name || 'Administrativo',
  };
}

export async function getDashboardData({ role, profileId } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Erro ao carregar dashboard.', usingFallback: false };
  }

  const isAdmin = role === 'Admin';
  const isLeader = role === 'Líder';
  const { start, end } = monthBounds();

  try {
    let occurrencesQuery = supabase
      .from('occurrences')
      .select('id, type, title, occurrence_date, status, employee_id, created_by, employees(full_name)')
      .order('occurrence_date', { ascending: false });
    let requestsQuery = supabase
      .from('requests')
      .select('id, title, status, requested_by, created_at, clients(name), employees(full_name)')
      .order('created_at', { ascending: false });

    if (isLeader && profileId) {
      occurrencesQuery = occurrencesQuery.eq('created_by', profileId);
      requestsQuery = requestsQuery.eq('requested_by', profileId);
    }

    const common = [queryOrThrow(occurrencesQuery), queryOrThrow(requestsQuery)];
    const privileged = isLeader
      ? [Promise.resolve([]), Promise.resolve([])]
      : [
          queryOrThrow(supabase.from('employees').select('id, full_name, role, score, status, admission_date, next_vacation_date, vacation_return_date, medical_leave_return_date, notice_end_date')),
          queryOrThrow(supabase.from('approval_requests').select('id, status, request_type, created_at')),
        ];
    const financial = isAdmin
      ? [
          queryOrThrow(supabase.from('financial_entries').select('id, client_id, amount, status, paid_date, due_date')),
          queryOrThrow(supabase.from('financial_expenses').select('id, amount, status, expense_date')),
        ]
      : [Promise.resolve([]), Promise.resolve([])];

    const [occurrences, requests, employees, approvals, entries, expenses] = await Promise.all([...common, ...privileged, ...financial]);
    const paidEntries = entries.filter((item) => item.status === 'pago' && isInMonth(item.paid_date || item.due_date, start, end));
    const paidExpenses = expenses.filter((item) => item.status === 'pago' && isInMonth(item.expense_date, start, end));
    const pendingClientIds = new Set(entries.filter((item) => ['pendente', 'atrasado'].includes(item.status)).map((item) => item.client_id).filter(Boolean));
    const entriesTotal = sum(paidEntries);
    const expensesTotal = sum(paidExpenses);

    return {
      data: {
        employees: employees.map(normalizeEmployee),
        occurrences: occurrences.map(normalizeOccurrence),
        requests: requests.map(normalizeRequest),
        approvals,
        financial: isAdmin ? { entriesTotal, expensesTotal, balance: entriesTotal - expensesTotal, pendingClients: pendingClientIds.size } : EMPTY_FINANCIAL,
      },
      error: null,
      usingFallback: false,
    };
  } catch (error) {
    return { data: null, error: getFriendlyError(error, 'Erro ao carregar dashboard.'), usingFallback: false };
  }
}

export function subscribeDashboard({ role, onChange } = {}) {
  if (!supabase || typeof onChange !== 'function') return () => {};
  const tables = role === 'Admin'
    ? ['employees', 'occurrences', 'requests', 'approval_requests', 'financial_entries', 'financial_expenses', 'clients', 'employee_history']
    : role === 'RH'
      ? ['employees', 'occurrences', 'requests', 'approval_requests', 'employee_history']
      : ['occurrences', 'requests'];

  let timer;
  const channel = supabase.channel(`dashboard-${role}-${Date.now()}`);
  tables.forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onChange, 250);
    });
  });
  channel.subscribe();

  return () => {
    window.clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
