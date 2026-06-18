import { CheckCircle2, Edit, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getClients } from '../services/clientService.js';
import {
  createFinancialEntry,
  currentMonth,
  deleteFinancialEntry,
  entryStatusOptions,
  entryTypeOptions,
  getFinancialEntries,
  markEntryAsPaid,
  markEntryAsPending,
  updateFinancialEntry,
} from '../services/financeService.js';
import { currencyBRL, shortDate } from '../utils/formatters.js';

export default function Entradas() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState([]);
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });
  const [filters, setFilters] = useState({ status: '', type: '', clientId: '', month: currentMonth() });
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', usingFallback: false });

  const loadEntries = useCallback(async () => {
    setStatus((current) => ({ ...current, loading: true, error: '' }));
    const result = await getFinancialEntries(filters);
    setEntries(result.data || []);
    setStatus((current) => ({ ...current, loading: false, error: result.error || '', usingFallback: Boolean(result.usingFallback) }));
  }, [filters]);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => {
    getClients().then((result) => setClients(result.data || []));
  }, []);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(entry) {
    setEditing(entry);
    setShowForm(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true }));
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = editing
      ? await updateFinancialEntry(editing.id, data)
      : await createFinancialEntry({ ...data, created_by: profile?.id });
    setStatus((current) => ({ ...current, saving: false }));
    setMessage({ text: result.error || (editing ? 'Entrada atualizada com sucesso.' : 'Entrada cadastrada com sucesso.'), error: Boolean(result.error) });
    if (!result.error) {
      setShowForm(false);
      setEditing(null);
      await loadEntries();
    }
  }

  async function handlePayment(entry, paid) {
    const result = paid ? await markEntryAsPaid(entry.id) : await markEntryAsPending(entry.id);
    setMessage({ text: result.error || (paid ? 'Pagamento marcado como recebido.' : 'Entrada marcada como pendente.'), error: Boolean(result.error) });
    if (!result.error) await loadEntries();
  }

  async function handleDelete(entry) {
    if (!window.confirm(`Remover a entrada “${entry.title}”?`)) return;
    const result = await deleteFinancialEntry(entry.id);
    setMessage({ text: result.error || 'Registro removido com sucesso.', error: Boolean(result.error) });
    if (!result.error) await loadEntries();
  }

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="page-shell">
      <PageTitle title="Entradas" subtitle="Mensalidades, serviços extras e outras receitas." actions={<button className="primary-button" type="button" onClick={openCreate}><Plus className="h-5 w-5" /> Adicionar entrada</button>} />

      {message.text && <div className={`rounded-2xl border p-4 text-sm font-bold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}

      {showForm && <EntryForm key={editing?.id || 'new'} entry={editing} clients={clients} saving={status.saving} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}

      <section className="surface-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormInput label="Status" as="select" options={[{ value: '', label: 'Todos' }, ...entryStatusOptions]} value={filters.status} onChange={(event) => setFilter('status', event.target.value)} />
        <FormInput label="Tipo" as="select" options={[{ value: '', label: 'Todos' }, ...entryTypeOptions]} value={filters.type} onChange={(event) => setFilter('type', event.target.value)} />
        <FormInput label="Cliente" as="select" options={[{ value: '', label: 'Todos' }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} value={filters.clientId} onChange={(event) => setFilter('clientId', event.target.value)} />
        <FormInput label="Mês" type="month" value={filters.month} onChange={(event) => setFilter('month', event.target.value)} />
      </section>

      {(status.loading || status.error) && <div className={`rounded-2xl border p-4 text-sm font-bold ${status.error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{status.loading ? 'Carregando entradas...' : status.error}</div>}

      <section className="grid gap-3 lg:grid-cols-2">
        {entries.map((entry) => (
          <article key={entry.id} className="surface-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-xs font-black uppercase text-luvig-blue">{entry.type}</p><h2 className="mt-1 font-black text-luvig-ink">{entry.title}</h2><p className="text-sm font-semibold text-slate-500">{entry.client}</p></div>
              <StatusBadge status={entry.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
              <div><p className="font-semibold text-slate-500">Valor</p><p className="font-black text-luvig-ink">{currencyBRL(entry.amount)}</p></div>
              <div><p className="font-semibold text-slate-500">Vencimento</p><p className="font-black text-luvig-ink">{shortDate(entry.dueDate)}</p></div>
              <div><p className="font-semibold text-slate-500">Enviada</p><p className="font-black text-luvig-ink">{shortDate(entry.sentDate)}</p></div>
              <div><p className="font-semibold text-slate-500">Pagamento</p><p className="font-black text-luvig-ink">{shortDate(entry.paidDate)}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="secondary-button" type="button" onClick={() => openEdit(entry)}><Edit className="h-4 w-4" /> Editar</button>
              <button className="secondary-button text-red-700" type="button" onClick={() => handleDelete(entry)}><Trash2 className="h-4 w-4" /> Remover</button>
              {entry.statusValue === 'pago'
                ? <button className="secondary-button" type="button" onClick={() => handlePayment(entry, false)}><RotateCcw className="h-4 w-4" /> Pendente</button>
                : <button className="primary-button" type="button" onClick={() => handlePayment(entry, true)}><CheckCircle2 className="h-4 w-4" /> Marcar pago</button>}
            </div>
          </article>
        ))}
        {!entries.length && !status.loading && <div className="surface-card p-8 text-center text-sm font-bold text-slate-500 lg:col-span-2">Nenhuma entrada encontrada.</div>}
      </section>
    </div>
  );
}

function EntryForm({ entry, clients, saving, onSubmit, onCancel }) {
  return (
    <form className="surface-card grid gap-4 p-5 md:grid-cols-2" onSubmit={onSubmit}>
      <FormInput label="Cliente/condomínio" name="client_id" as="select" options={[{ value: '', label: 'Sem cliente vinculado' }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} defaultValue={entry?.clientId || ''} />
      <FormInput label="Título" name="title" defaultValue={entry?.title || ''} required />
      <FormInput label="Tipo" name="type" as="select" options={entryTypeOptions} defaultValue={entry?.typeValue || 'mensalidade'} />
      <FormInput label="Valor" name="amount" type="number" min="0.01" step="0.01" defaultValue={entry?.amount ?? ''} required />
      <FormInput label="Data enviada" name="sent_date" type="date" defaultValue={entry?.sentDate || ''} />
      <FormInput label="Vencimento" name="due_date" type="date" defaultValue={entry?.dueDate || ''} />
      <FormInput label="Data de pagamento" name="paid_date" type="date" defaultValue={entry?.paidDate || ''} />
      <FormInput label="Status" name="status" as="select" options={entryStatusOptions} defaultValue={entry?.statusValue || 'pendente'} />
      <div className="md:col-span-2"><FormInput label="Observações" name="notes" as="textarea" defaultValue={entry?.notes || ''} /></div>
      <div className="flex flex-wrap gap-2 md:col-span-2"><button className="primary-button" type="submit" disabled={saving}><Save className="h-5 w-5" /> {saving ? 'Salvando...' : entry ? 'Atualizar entrada' : 'Cadastrar entrada'}</button><button className="secondary-button" type="button" onClick={onCancel}><X className="h-5 w-5" /> Cancelar</button></div>
    </form>
  );
}
