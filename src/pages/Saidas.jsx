import { Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createFinancialExpense,
  currentMonth,
  deleteFinancialExpense,
  expenseCategoryOptions,
  expenseStatusOptions,
  getFinancialExpenses,
  updateFinancialExpense,
} from '../services/financeService.js';
import { currencyBRL, shortDate } from '../utils/formatters.js';

export default function Saidas() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });
  const [filters, setFilters] = useState({ category: '', status: '', month: currentMonth() });
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', usingFallback: false });

  const loadExpenses = useCallback(async () => {
    setStatus((current) => ({ ...current, loading: true, error: '' }));
    const result = await getFinancialExpenses(filters);
    setExpenses(result.data || []);
    setStatus((current) => ({ ...current, loading: false, error: result.error || '', usingFallback: Boolean(result.usingFallback) }));
  }, [filters]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  async function handleSave(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true }));
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = editing
      ? await updateFinancialExpense(editing.id, data)
      : await createFinancialExpense({ ...data, created_by: profile?.id });
    setStatus((current) => ({ ...current, saving: false }));
    setMessage({ text: result.error || (editing ? 'Saída atualizada com sucesso.' : 'Saída cadastrada com sucesso.'), error: Boolean(result.error) });
    if (!result.error) {
      setShowForm(false);
      setEditing(null);
      await loadExpenses();
    }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Remover a saída “${expense.title}”?`)) return;
    const result = await deleteFinancialExpense(expense.id);
    setMessage({ text: result.error || 'Registro removido com sucesso.', error: Boolean(result.error) });
    if (!result.error) await loadExpenses();
  }

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="page-shell">
      <PageTitle title="Saídas" subtitle="Despesas administrativas por categoria." actions={<button className="primary-button" type="button" onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-5 w-5" /> Adicionar saída</button>} />
      {message.text && <div className={`rounded-2xl border p-4 text-sm font-bold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
      {showForm && <ExpenseForm key={editing?.id || 'new'} expense={editing} saving={status.saving} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}

      <section className="surface-card grid gap-3 p-4 sm:grid-cols-3">
        <FormInput label="Categoria" as="select" options={[{ value: '', label: 'Todas' }, ...expenseCategoryOptions]} value={filters.category} onChange={(event) => setFilter('category', event.target.value)} />
        <FormInput label="Status" as="select" options={[{ value: '', label: 'Todos' }, ...expenseStatusOptions]} value={filters.status} onChange={(event) => setFilter('status', event.target.value)} />
        <FormInput label="Mês" type="month" value={filters.month} onChange={(event) => setFilter('month', event.target.value)} />
      </section>

      {(status.loading || status.error) && <div className={`rounded-2xl border p-4 text-sm font-bold ${status.error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{status.loading ? 'Carregando saídas...' : status.error}</div>}

      <section className="grid gap-3 lg:grid-cols-2">
        {expenses.map((expense) => (
          <article key={expense.id} className="surface-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase text-luvig-blue">{expense.category}</p><h2 className="mt-1 font-black text-luvig-ink">{expense.title}</h2></div><StatusBadge status={expense.status} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><p className="font-semibold text-slate-500">Valor</p><p className="font-black text-luvig-ink">{currencyBRL(expense.amount)}</p></div><div><p className="font-semibold text-slate-500">Data</p><p className="font-black text-luvig-ink">{shortDate(expense.expenseDate)}</p></div></div>
            {expense.notes && <p className="mt-3 text-sm font-semibold text-slate-500">{expense.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2"><button className="secondary-button" type="button" onClick={() => { setEditing(expense); setShowForm(true); }}><Edit className="h-4 w-4" /> Editar</button><button className="secondary-button text-red-700" type="button" onClick={() => handleDelete(expense)}><Trash2 className="h-4 w-4" /> Remover</button></div>
          </article>
        ))}
        {!expenses.length && !status.loading && <div className="surface-card p-8 text-center text-sm font-bold text-slate-500 lg:col-span-2">Nenhuma saída encontrada.</div>}
      </section>
    </div>
  );
}

function ExpenseForm({ expense, saving, onSubmit, onCancel }) {
  return (
    <form className="surface-card grid gap-4 p-5 md:grid-cols-2" onSubmit={onSubmit}>
      <FormInput label="Título" name="title" defaultValue={expense?.title || ''} required />
      <FormInput label="Categoria" name="category" as="select" options={expenseCategoryOptions} defaultValue={expense?.categoryValue || 'folha'} />
      <FormInput label="Valor" name="amount" type="number" min="0.01" step="0.01" defaultValue={expense?.amount ?? ''} required />
      <FormInput label="Data da saída" name="expense_date" type="date" defaultValue={expense?.expenseDate || new Date().toISOString().slice(0, 10)} required />
      <FormInput label="Status" name="status" as="select" options={expenseStatusOptions} defaultValue={expense?.statusValue || 'pago'} />
      <div className="md:col-span-2"><FormInput label="Observações" name="notes" as="textarea" defaultValue={expense?.notes || ''} /></div>
      <div className="flex flex-wrap gap-2 md:col-span-2"><button className="primary-button" type="submit" disabled={saving}><Save className="h-5 w-5" /> {saving ? 'Salvando...' : expense ? 'Atualizar saída' : 'Cadastrar saída'}</button><button className="secondary-button" type="button" onClick={onCancel}><X className="h-5 w-5" /> Cancelar</button></div>
    </form>
  );
}
