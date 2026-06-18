import { CheckCircle2, Eye, Plus, Save, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createRequest, listRequests, requestTypeOptions, updateRequestStatus } from '../services/requestService.js';
import { shortDate } from '../utils/formatters.js';

export default function Pedidos() {
  const { isAdmin, isLeader, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [message, setMessage] = useState({ text: '', error: false });
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', usingFallback: false });

  const loadRequests = useCallback(async () => {
    const result = await listRequests({ ownOnly: isLeader, profileId: profile?.id });
    setItems(result.data || []);
    setStatus((current) => ({ ...current, loading: false, error: result.error || '', usingFallback: Boolean(result.usingFallback) }));
  }, [isLeader, profile?.id]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleCreate(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true }));
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await createRequest({ ...data, requested_by: profile?.id, status: 'pendente' });
    setStatus((current) => ({ ...current, saving: false }));
    setMessage({ text: result.error || 'Pedido criado com sucesso.', error: Boolean(result.error) });
    if (!result.error) {
      event.currentTarget.reset();
      setShowForm(false);
      await loadRequests();
    }
  }

  async function handleStatus(id, nextStatus) {
    if (['aprovado', 'recusado', 'resolvido'].includes(nextStatus) && !window.confirm('Tem certeza que deseja continuar?')) return;
    const result = await updateRequestStatus(id, nextStatus);
    setMessage({ text: result.error || 'Status do pedido atualizado.', error: Boolean(result.error) });
    if (!result.error) await loadRequests();
  }

  return (
    <div className="page-shell">
      <PageTitle
        title={isLeader ? 'Meus pedidos' : 'Pedidos'}
        subtitle={isLeader ? 'Solicitações enviadas à administração.' : 'Solicitações internas e decisões administrativas.'}
        actions={<button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}><Plus className="h-5 w-5" /> Novo pedido</button>}
      />

      {message.text && <div className={`rounded-2xl border p-4 text-sm font-bold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
      {(status.loading || status.error) && <div className={`rounded-2xl border p-4 text-sm font-bold ${status.error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{status.loading ? 'Carregando pedidos...' : status.error}</div>}

      {showForm && (
        <form className="surface-card grid gap-4 p-5 md:grid-cols-2" onSubmit={handleCreate}>
          <FormInput label="Tipo" name="type" as="select" options={requestTypeOptions} />
          <FormInput label="Urgência" name="urgency" as="select" options={[{ value: 'baixa', label: 'Baixa' }, { value: 'normal', label: 'Normal' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }]} />
          <div className="md:col-span-2"><FormInput label="Título" name="title" required placeholder="Resumo do pedido" /></div>
          <div className="md:col-span-2"><FormInput label="Descrição" name="description" as="textarea" required /></div>
          <div className="md:col-span-2"><button className="primary-button" type="submit" disabled={status.saving}><Save className="h-5 w-5" /> {status.saving ? 'Salvando...' : 'Criar pedido'}</button></div>
        </form>
      )}

      <section className="surface-card divide-y divide-slate-200 overflow-hidden">
        {items.map((order) => (
          <article key={order.id} className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr,160px,150px,140px] md:items-center">
              <div><p className="text-xs font-bold uppercase text-slate-500">{order.requester}</p><p className="font-black text-luvig-ink">{order.title}</p></div>
              <p className="text-sm font-semibold text-slate-600">{shortDate(order.date)}</p>
              <StatusBadge status={order.status} />
              <button className="secondary-button px-3" type="button" onClick={() => setExpandedId((current) => current === order.id ? null : order.id)}><Eye className="h-4 w-4" /> Detalhes</button>
            </div>
            {expandedId === order.id && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-600">{order.description || 'Sem descrição.'}</p>
                {isAdmin && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="secondary-button" type="button" onClick={() => handleStatus(order.id, 'em_analise')}>Em análise</button>
                    <button className="primary-button" type="button" onClick={() => handleStatus(order.id, 'aprovado')}><CheckCircle2 className="h-4 w-4" /> Aprovar</button>
                    <button className="secondary-button text-red-700" type="button" onClick={() => handleStatus(order.id, 'recusado')}><XCircle className="h-4 w-4" /> Recusar</button>
                    <button className="secondary-button" type="button" onClick={() => handleStatus(order.id, 'resolvido')}>Resolver</button>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
        {!items.length && !status.loading && <div className="p-8 text-center text-sm font-bold text-slate-500">Nenhum pedido encontrado.</div>}
      </section>
    </div>
  );
}
