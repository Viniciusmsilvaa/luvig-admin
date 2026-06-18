import { runQuery, toNumber } from './serviceHelpers.js';

export const entryTypeOptions = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'servico_extra', label: 'Serviço extra' },
  { value: 'outro', label: 'Outro' },
];

export const entryStatusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export const expenseCategoryOptions = [
  { value: 'folha', label: 'Folha' },
  { value: 'rescisao', label: 'Rescisão' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'uniformes', label: 'Uniformes' },
  { value: 'produtos', label: 'Produtos' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'outros', label: 'Outros' },
];

export const expenseStatusOptions = [
  { value: 'pago', label: 'Pago' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'cancelado', label: 'Cancelado' },
];

const entryTypeLabels = Object.fromEntries(entryTypeOptions.map(({ value, label }) => [value, label]));
const entryStatusLabels = Object.fromEntries(entryStatusOptions.map(({ value, label }) => [value, label]));
const expenseCategoryLabels = Object.fromEntries(expenseCategoryOptions.map(({ value, label }) => [value, label]));
const expenseStatusLabels = Object.fromEntries(expenseStatusOptions.map(({ value, label }) => [value, label]));

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function dateInMonth(value, month) {
  return !month || Boolean(value && value.slice(0, 7) === month);
}

function entryEffectiveDate(entry) {
  return entry.statusValue === 'pago'
    ? entry.paidDate || entry.dueDate || entry.sentDate
    : entry.dueDate || entry.sentDate || entry.paidDate;
}

function daysLate(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - due) / 86400000));
}

function mapEntryFromDb(row) {
  return {
    id: row.id,
    client: row.clients?.name || 'Sem cliente vinculado',
    clientId: row.client_id || '',
    title: row.title,
    type: entryTypeLabels[row.type] || row.type,
    typeValue: row.type,
    amount: toNumber(row.amount),
    sentDate: row.sent_date || '',
    sentAt: row.sent_date || '',
    dueDate: row.due_date || '',
    due: row.due_date || '',
    paidDate: row.paid_date || '',
    status: entryStatusLabels[row.status] || row.status,
    statusValue: row.status,
    notes: row.notes || '',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    daysLate: ['pendente', 'atrasado'].includes(row.status) ? daysLate(row.due_date) : 0,
  };
}

function mapExpenseFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    category: expenseCategoryLabels[row.category] || row.category,
    categoryValue: row.category,
    description: row.notes || row.title,
    amount: toNumber(row.amount),
    expenseDate: row.expense_date || '',
    date: row.expense_date || '',
    status: expenseStatusLabels[row.status] || row.status,
    statusValue: row.status,
    notes: row.notes || '',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function addField(target, key, value, transform = (item) => item) {
  if (value === undefined) return;
  target[key] = value === '' ? null : transform(value);
}

function serializeEntry(data) {
  const payload = {};
  addField(payload, 'client_id', data.client_id ?? data.clientId);
  addField(payload, 'title', data.title);
  addField(payload, 'type', data.type);
  addField(payload, 'amount', data.amount, Number);
  addField(payload, 'sent_date', data.sent_date ?? data.sentDate);
  addField(payload, 'due_date', data.due_date ?? data.dueDate);
  addField(payload, 'paid_date', data.paid_date ?? data.paidDate);
  addField(payload, 'status', data.status);
  addField(payload, 'notes', data.notes);
  addField(payload, 'created_by', data.created_by ?? data.createdBy);
  return payload;
}

function serializeExpense(data) {
  const payload = {};
  addField(payload, 'title', data.title);
  addField(payload, 'category', data.category);
  addField(payload, 'amount', data.amount, Number);
  addField(payload, 'expense_date', data.expense_date ?? data.expenseDate);
  addField(payload, 'status', data.status);
  addField(payload, 'notes', data.notes);
  addField(payload, 'created_by', data.created_by ?? data.createdBy);
  return payload;
}

export async function getFinancialEntries(filters = {}) {
  const result = await runQuery(
    (client) => {
      let query = client.from('financial_entries').select('*, clients(name)').order('due_date', { ascending: false });
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.clientId) query = query.eq('client_id', filters.clientId);
      return query;
    },
    [],
    'Erro ao carregar entradas.',
  );
  const entries = (result.data || []).map(mapEntryFromDb);
  return { ...result, data: filters.month ? entries.filter((entry) => dateInMonth(entryEffectiveDate(entry), filters.month)) : entries };
}

export const listFinancialEntries = getFinancialEntries;

export async function getFinancialExpenses(filters = {}) {
  const result = await runQuery(
    (client) => {
      let query = client.from('financial_expenses').select('*').order('expense_date', { ascending: false });
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.category) query = query.eq('category', filters.category);
      return query;
    },
    [],
    'Erro ao carregar saídas.',
  );
  const expenses = (result.data || []).map(mapExpenseFromDb);
  return { ...result, data: filters.month ? expenses.filter((expense) => dateInMonth(expense.expenseDate, filters.month)) : expenses };
}

export const listFinancialExpenses = getFinancialExpenses;

export async function createFinancialEntry(data) {
  const result = await runQuery(
    (client) => client.from('financial_entries').insert(serializeEntry(data)).select('*, clients(name)').single(),
    null,
    'Erro ao criar entrada.',
  );
  return result.data ? { ...result, data: mapEntryFromDb(result.data) } : result;
}

export async function updateFinancialEntry(id, data) {
  const result = await runQuery(
    (client) => client.from('financial_entries').update({ ...serializeEntry(data), updated_at: new Date().toISOString() }).eq('id', id).select('*, clients(name)').single(),
    null,
    'Erro ao atualizar entrada.',
  );
  return result.data ? { ...result, data: mapEntryFromDb(result.data) } : result;
}

export function deleteFinancialEntry(id) {
  return runQuery(
    (client) => client.from('financial_entries').delete().eq('id', id),
    null,
    'Erro ao remover entrada.',
  );
}

export function markEntryAsPaid(id) {
  return updateFinancialEntry(id, { status: 'pago', paid_date: new Date().toISOString().slice(0, 10) });
}

export function markEntryAsPending(id) {
  return updateFinancialEntry(id, { status: 'pendente', paid_date: null });
}

export async function createFinancialExpense(data) {
  const result = await runQuery(
    (client) => client.from('financial_expenses').insert(serializeExpense(data)).select().single(),
    null,
    'Erro ao criar saída.',
  );
  return result.data ? { ...result, data: mapExpenseFromDb(result.data) } : result;
}

export async function updateFinancialExpense(id, data) {
  const result = await runQuery(
    (client) => client.from('financial_expenses').update({ ...serializeExpense(data), updated_at: new Date().toISOString() }).eq('id', id).select().single(),
    null,
    'Erro ao atualizar saída.',
  );
  return result.data ? { ...result, data: mapExpenseFromDb(result.data) } : result;
}

export function deleteFinancialExpense(id) {
  return runQuery(
    (client) => client.from('financial_expenses').delete().eq('id', id),
    null,
    'Erro ao remover saída.',
  );
}

export async function getFinancialSummary(month = currentMonth()) {
  const [entryResult, expenseResult] = await Promise.all([getFinancialEntries(), getFinancialExpenses()]);
  const paidEntries = (entryResult.data || []).filter((item) => item.statusValue === 'pago' && dateInMonth(entryEffectiveDate(item), month));
  const paidExpenses = (expenseResult.data || []).filter((item) => item.statusValue === 'pago' && dateInMonth(item.expenseDate, month));
  const pendingEntries = (entryResult.data || []).filter((item) => ['pendente', 'atrasado'].includes(item.statusValue));
  const sum = (items) => items.reduce((total, item) => total + item.amount, 0);
  const entryByType = (type) => sum(paidEntries.filter((item) => item.typeValue === type));
  const expenseByCategory = (category) => sum(paidExpenses.filter((item) => item.categoryValue === category));
  const entriesTotal = sum(paidEntries);
  const expensesTotal = sum(paidExpenses);

  return {
    data: {
      month,
      entriesTotal,
      expensesTotal,
      balance: entriesTotal - expensesTotal,
      pendingClients: new Set(pendingEntries.map((item) => item.clientId).filter(Boolean)).size,
      pendingEntries,
      monthlyFees: entryByType('mensalidade'),
      extraServices: entryByType('servico_extra'),
      payroll: expenseByCategory('folha'),
      termination: expenseByCategory('rescisao'),
      fuel: expenseByCategory('combustivel'),
      equipment: expenseByCategory('equipamentos'),
      uniforms: expenseByCategory('uniformes'),
      products: expenseByCategory('produtos'),
    },
    error: entryResult.error || expenseResult.error || null,
    usingFallback: Boolean(entryResult.usingFallback || expenseResult.usingFallback),
  };
}

export async function getClientFinancialSummary(clientId) {
  const result = await getFinancialEntries({ clientId });
  const entries = result.data || [];
  const paid = entries.filter((item) => item.statusValue === 'pago');
  const pending = entries.filter((item) => ['pendente', 'atrasado'].includes(item.statusValue));
  const byNewest = [...entries].sort((a, b) => new Date(entryEffectiveDate(b) || 0) - new Date(entryEffectiveDate(a) || 0));
  const futurePending = pending
    .filter((item) => item.dueDate && new Date(`${item.dueDate}T00:00:00`) >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const sum = (items) => items.reduce((total, item) => total + item.amount, 0);
  return {
    ...result,
    data: {
      entries,
      totalPaid: sum(paid),
      totalPending: sum(pending),
      lastCharge: byNewest[0] || null,
      nextDue: futurePending[0] || pending.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))[0] || null,
      financialStatus: pending.some((item) => item.statusValue === 'atrasado' || item.daysLate > 0) ? 'Em atraso' : pending.length ? 'Pendente' : 'Em dia',
    },
  };
}
