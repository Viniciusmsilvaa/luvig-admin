import { History, Pencil, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getTimeClockAccess } from '../auth/accessRules.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  clockTypeOptions,
  getClockAudit,
  getClockHistory,
  getTimeClockOwnerId,
  softDeleteClockRecord,
  updateClockRecord,
} from '../services/timeClockService.js';
import FormInput from './FormInput.jsx';

function inputParts(value) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

export default function TimeClockManagement() {
  const { profile, user } = useAuth();
  const access = getTimeClockAccess(profile, user);
  const [records, setRecords] = useState([]);
  const [audit, setAudit] = useState([]);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [state, setState] = useState({ loading: true, saving: false, message: '', error: '' });

  const load = useCallback(async () => {
    if (!access.canView) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    const owner = await getTimeClockOwnerId();
    if (owner.error || !owner.data) {
      setState((current) => ({ ...current, loading: false, error: owner.error || 'Perfil do Vinícius não encontrado.' }));
      return;
    }
    const [historyResult, auditResult] = await Promise.all([getClockHistory(owner.data), getClockAudit()]);
    setRecords(historyResult.data || []);
    setAudit(auditResult.data || []);
    setState((current) => ({ ...current, loading: false, error: historyResult.error || auditResult.error || '' }));
  }, [access.canView]);

  useEffect(() => { load(); }, [load]);

  if (!access.canView) return null;

  async function handleEdit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!data.reason?.trim()) { setState((current) => ({ ...current, error: 'Informe o motivo da alteração.' })); return; }
    setState((current) => ({ ...current, saving: true, message: '', error: '' }));
    const clockTime = new Date(`${data.date}T${data.time}:00`).toISOString();
    const result = await updateClockRecord(editing.id, { clockType: data.clock_type, clockTime, notes: data.notes, reason: data.reason });
    if (result.error) { setState((current) => ({ ...current, saving: false, error: result.error })); return; }
    setEditing(null);
    setState((current) => ({ ...current, saving: false, message: 'Ponto alterado com sucesso.' }));
    await load();
  }

  async function handleRemove(event) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get('reason');
    if (!reason?.trim()) { setState((current) => ({ ...current, error: 'Informe o motivo da remoção.' })); return; }
    setState((current) => ({ ...current, saving: true, message: '', error: '' }));
    const result = await softDeleteClockRecord(removing.id, reason);
    if (result.error) { setState((current) => ({ ...current, saving: false, error: result.error })); return; }
    setRemoving(null);
    setState((current) => ({ ...current, saving: false, message: 'Ponto removido com sucesso.' }));
    await load();
  }

  return (
    <section className="surface-card p-5">
      <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-luvig-light text-luvig-blue"><History className="h-5 w-5" /></div><div><h2 className="font-black text-luvig-ink">Gestão do Meu Ponto</h2><p className="text-sm font-semibold text-slate-500">{access.canWrite ? 'Edite ou remova registros com motivo obrigatório.' : 'Visualização de registros e auditoria, sem permissão de alteração.'}</p></div></div>

      {(state.loading || state.error || state.message) && <div className={`mt-4 rounded-xl border p-3 text-sm font-bold ${state.error ? 'border-red-200 bg-red-50 text-red-700' : state.message ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{state.loading ? 'Carregando gestão do ponto...' : state.error || state.message}</div>}

      <div className="mt-5 space-y-3">
        {records.slice(0, 60).map((record) => (
          <article key={record.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-black text-luvig-ink">{new Date(record.clock_time).toLocaleDateString('pt-BR')} · {clockTypeOptions.find((item) => item.value === record.clock_type)?.label}</p><p className="mt-1 text-sm font-semibold text-slate-500">{new Date(record.clock_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{record.notes ? ` · ${record.notes}` : ''}</p></div>
              {access.canWrite && <div className="flex gap-2"><button className="secondary-button px-3" type="button" onClick={() => { setEditing(record); setRemoving(null); }}><Pencil className="h-4 w-4" />Editar</button><button className="secondary-button px-3 text-red-700" type="button" onClick={() => { setRemoving(record); setEditing(null); }}><Trash2 className="h-4 w-4" />Remover</button></div>}
            </div>
          </article>
        ))}
        {!state.loading && !records.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhum registro de ponto.</p>}
      </div>

      {editing && <EditForm record={editing} saving={state.saving} onSubmit={handleEdit} onCancel={() => setEditing(null)} />}
      {removing && <RemoveForm record={removing} saving={state.saving} onSubmit={handleRemove} onCancel={() => setRemoving(null)} />}

      <details className="mt-6 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-black text-luvig-ink">Histórico de alterações ({audit.length})</summary>
        <div className="mt-4 space-y-2">{audit.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600"><strong className="text-luvig-ink">{item.action === 'edit' ? 'Edição' : item.action === 'delete' ? 'Remoção' : 'Restauração'}</strong> · {item.reason}<br /><span className="text-xs">{item.changer?.full_name || 'Vinícius Miranda'} · {new Date(item.created_at).toLocaleString('pt-BR')}</span></div>)}{!audit.length && <p className="text-sm font-semibold text-slate-500">Nenhuma alteração registrada.</p>}</div>
      </details>
    </section>
  );
}

function EditForm({ record, saving, onSubmit, onCancel }) {
  const parts = inputParts(record.clock_time);
  return <form className="mt-5 grid gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-2" onSubmit={onSubmit}><div className="md:col-span-2 flex items-center justify-between"><h3 className="font-black text-luvig-ink">Alterar ponto</h3><button className="quiet-button px-2" type="button" onClick={onCancel} aria-label="Fechar edição"><X className="h-4 w-4" /></button></div><FormInput label="Tipo" name="clock_type" as="select" defaultValue={record.clock_type} options={clockTypeOptions} /><FormInput label="Data" name="date" type="date" defaultValue={parts.date} required /><FormInput label="Horário" name="time" type="time" defaultValue={parts.time} required /><FormInput label="Observação" name="notes" defaultValue={record.notes || ''} /><div className="md:col-span-2"><FormInput label="Motivo da alteração" name="reason" as="textarea" required placeholder="Ex.: Corrigido horário lançado errado." /></div><div className="md:col-span-2"><button className="primary-button" type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar alteração'}</button></div></form>;
}

function RemoveForm({ record, saving, onSubmit, onCancel }) {
  return <form className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4" onSubmit={onSubmit}><div className="flex items-center justify-between"><div><h3 className="font-black text-red-900">Remover ponto</h3><p className="text-sm font-semibold text-red-700">O registro de {new Date(record.clock_time).toLocaleString('pt-BR')} será ocultado, mas preservado na auditoria.</p></div><button className="quiet-button px-2" type="button" onClick={onCancel} aria-label="Cancelar remoção"><X className="h-4 w-4" /></button></div><div className="mt-4"><FormInput label="Motivo da remoção" name="reason" as="textarea" required /></div><button className="touch-button mt-4 bg-red-700 text-white hover:bg-red-800" type="submit" disabled={saving}><Trash2 className="h-4 w-4" />{saving ? 'Removendo...' : 'Confirmar remoção'}</button></form>;
}
