import { CheckCircle2, Eye, FileClock, FileText, Send, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { listApprovalRequests, reviewApprovalRequest } from '../services/approvalService.js';
import { confirmOccurrence, listOccurrences, recommendOccurrence, rejectOccurrence } from '../services/occurrenceService.js';
import { listRequests } from '../services/requestService.js';
import { shortDate } from '../utils/formatters.js';

export default function RH() {
  const { isAdmin, isRH, profile } = useAuth();
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState({ text: '', error: false });
  const [expandedId, setExpandedId] = useState(null);
  const [loadState, setLoadState] = useState({ loading: true, error: '', usingFallback: false });

  const loadCentral = useCallback(async () => {
    setLoadState((current) => ({ ...current, loading: true, error: '' }));
    const [approvalResult, occurrenceResult, requestResult] = await Promise.all([
      listApprovalRequests(),
      listOccurrences(),
      listRequests(),
    ]);
    setApprovalRequests((approvalResult.data || []).filter((item) => item.statusValue ? item.statusValue === 'pendente' : item.status === 'Pendente'));
    setOccurrences((occurrenceResult.data || []).filter((item) => ['aguardando_conferencia', 'recomendado_pelo_rh'].includes(item.statusValue)));
    setRequests((requestResult.data || []).filter((item) => item.statusValue ? ['pendente', 'em_analise'].includes(item.statusValue) : item.status !== 'Aprovado'));
    setLoadState({
      loading: false,
      error: approvalResult.error || occurrenceResult.error || requestResult.error || '',
      usingFallback: Boolean(approvalResult.usingFallback || occurrenceResult.usingFallback || requestResult.usingFallback),
    });
  }, []);

  useEffect(() => { loadCentral(); }, [loadCentral]);

  async function reviewOccurrenceItem(item, decision) {
    const action = decision === 'confirmado' ? 'aprovar' : decision === 'recusado' ? 'recusar' : 'recomendar';
    if (!window.confirm(`Tem certeza que deseja ${action} esta ocorrência?`)) return;
    const result = decision === 'confirmado'
      ? await confirmOccurrence(item.id, profile?.id)
      : decision === 'recusado'
        ? await rejectOccurrence(item.id, profile?.id)
        : await recommendOccurrence(item.id);
    setMessage({
      text: result.error || (decision === 'confirmado' ? 'Ocorrência aprovada. Nota atualizada.' : decision === 'recusado' ? 'Ocorrência recusada.' : 'Ocorrência recomendada ao Admin.'),
      error: Boolean(result.error),
    });
    if (!result.error) await loadCentral();
  }

  async function reviewRequestItem(item, decision) {
    if (!window.confirm(`Tem certeza que deseja ${decision === 'aprovado' ? 'aprovar' : 'recusar'} esta solicitação?`)) return;
    const result = await reviewApprovalRequest(item, decision, profile?.id);
    setMessage({
      text: result.error || `Solicitação ${decision === 'aprovado' ? 'aprovada' : 'recusada'}.`,
      error: Boolean(result.error),
    });
    if (!result.error) await loadCentral();
  }

  return (
    <div className="page-shell">
      <PageTitle
        title="Central RH/Admin"
        subtitle={isAdmin ? 'Decisões administrativas e solicitações aguardando análise.' : 'Conferência e recomendação de ocorrências para o Admin.'}
        actions={<Link className="primary-button" to="/ocorrencias/nova">Nova ocorrência</Link>}
      />

      {isRH && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          RH pode recomendar ocorrências. A confirmação final permanece exclusiva do Admin.
        </div>
      )}

      {message.text && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {message.text}
        </div>
      )}

      {(loadState.loading || loadState.error) && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${loadState.error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>
          {loadState.loading ? 'Carregando central...' : loadState.error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ocorrências aguardando decisão" value={occurrences.length} icon={FileClock} tone="amber" detail="Conferência pendente" />
        <StatCard label="Solicitações RH" value={approvalRequests.length} icon={Send} tone="blue" detail="Alterações administrativas" />
        <StatCard label="Pedidos pendentes" value={requests.length} icon={FileText} tone="cyan" detail="Solicitações internas" />
        <StatCard label="Documentos pendentes" value="0" icon={FileText} tone="slate" detail="Preparado para integração" />
      </section>

      <section className="surface-card p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-luvig-ink">Ocorrências aguardando decisão</h2>
            <p className="text-sm font-semibold text-slate-500">Aprovação atualiza histórico, nota e dashboard.</p>
          </div>
          <Link className="secondary-button" to="/ocorrencias/nova"><Eye className="h-4 w-4" /> Ver todas</Link>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {occurrences.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-luvig-blue">{item.type}</p>
                  <h3 className="mt-1 font-black text-luvig-ink">{item.title} · {item.employee}</h3>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{item.description}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">{shortDate(item.date)} · Impacto {item.impact > 0 ? '+' : ''}{item.impact.toFixed(2).replace('.', ',')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {isAdmin ? (
                  <>
                    <button className="primary-button" type="button" onClick={() => reviewOccurrenceItem(item, 'confirmado')}><CheckCircle2 className="h-4 w-4" /> Aprovar</button>
                    <button className="secondary-button text-red-700" type="button" onClick={() => reviewOccurrenceItem(item, 'recusado')}><XCircle className="h-4 w-4" /> Recusar</button>
                  </>
                ) : item.statusValue === 'aguardando_conferencia' ? (
                  <button className="primary-button" type="button" onClick={() => reviewOccurrenceItem(item, 'recomendado_pelo_rh')}><Send className="h-4 w-4" /> Recomendar</button>
                ) : null}
              </div>
            </article>
          ))}
          {!occurrences.length && !loadState.loading && <EmptyState text="Nenhuma ocorrência aguardando decisão." />}
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-xl font-black text-luvig-ink">Solicitações RH</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {approvalRequests.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-black uppercase text-luvig-blue">{item.requester}</p><h3 className="mt-1 font-black text-luvig-ink">{item.title}</h3></div>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{item.summary}</p>
              {expandedId === item.id && <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(item.payload, null, 2)}</pre>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}><Eye className="h-4 w-4" /> Detalhes</button>
                {isAdmin && (
                  <>
                    <button className="primary-button" type="button" onClick={() => reviewRequestItem(item, 'aprovado')}><CheckCircle2 className="h-4 w-4" /> Aprovar</button>
                    <button className="secondary-button text-red-700" type="button" onClick={() => reviewRequestItem(item, 'recusado')}><XCircle className="h-4 w-4" /> Recusar</button>
                  </>
                )}
              </div>
            </article>
          ))}
          {!approvalRequests.length && !loadState.loading && <EmptyState text="Nenhuma solicitação do RH pendente." />}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">{text}</div>;
}
