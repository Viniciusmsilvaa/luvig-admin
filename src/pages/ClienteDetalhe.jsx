import { Building2, ClipboardList, Edit, FileText, History, Receipt, UserCheck, UserX, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';
import DocumentList from '../components/DocumentList.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createApprovalRequest } from '../services/approvalService.js';
import { getClientById, inactivateClient, reactivateClient } from '../services/clientService.js';
import { deleteDocument, getClientDocuments, getDocumentDownloadUrl } from '../services/documentService.js';
import { getClientFinancialSummary } from '../services/financeService.js';
import { listOccurrences } from '../services/occurrenceService.js';
import { currencyBRL, shortDate } from '../utils/formatters.js';

const tabs = [
  { label: 'Resumo', icon: ClipboardList },
  { label: 'Contrato', icon: FileText },
  { label: 'Documentos', icon: FileText },
  { label: 'Financeiro', icon: Wallet, adminOnly: true },
  { label: 'Ocorrências', icon: Receipt },
  { label: 'Histórico', icon: History },
];

export default function ClienteDetalhe() {
  const { id } = useParams();
  const location = useLocation();
  const { isAdmin, isRH, profile } = useAuth();
  const [client, setClient] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [financial, setFinancial] = useState({ entries: [], totalPaid: 0, totalPending: 0, lastCharge: null, nextDue: null, financialStatus: 'Em dia' });
  const [activeTab, setActiveTab] = useState('Resumo');
  const [message, setMessage] = useState({ text: location.state?.notice || '', error: false });
  const [changingStatus, setChangingStatus] = useState(false);
  const [loadState, setLoadState] = useState({ loading: true, error: '', usingFallback: false });
  const visibleTabs = useMemo(() => tabs.filter((tab) => isAdmin || !tab.adminOnly), [isAdmin]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.label === activeTab)) setActiveTab('Resumo');
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    let active = true;
    async function loadClient() {
      const [clientResult, occurrenceResult, financialResult, documentResult] = await Promise.all([
        getClientById(id),
        listOccurrences({ clientId: id }),
        isAdmin ? getClientFinancialSummary(id) : Promise.resolve({ data: null, error: null, usingFallback: false }),
        getClientDocuments(id),
      ]);
      if (!active) return;
      setClient(clientResult.data || null);
      setOccurrences(occurrenceResult.data || []);
      setDocuments(documentResult.data || []);
      if (financialResult.data) setFinancial(financialResult.data);
      setLoadState({
        loading: false,
        error: clientResult.error || clientResult.contractError || occurrenceResult.error || financialResult.error || documentResult.error || (!clientResult.data ? 'Condomínio não encontrado.' : ''),
        usingFallback: Boolean(clientResult.usingFallback || occurrenceResult.usingFallback || financialResult.usingFallback),
      });
    }
    loadClient();
    return () => { active = false; };
  }, [id, isAdmin]);

  async function handleStatusChange(nextStatus) {
    const action = nextStatus === 'ativo' ? 'reativar' : 'inativar';
    if (!window.confirm(`Deseja ${action} ${client.name}?`)) return;
    setChangingStatus(true);
    setMessage({ text: '', error: false });

    const result = isAdmin
      ? nextStatus === 'ativo' ? await reactivateClient(client.id) : await inactivateClient(client.id)
      : await createApprovalRequest({
          requested_by: profile?.id,
          request_type: 'outro',
          target_table: 'clients',
          target_id: client.id,
          payload: { status: nextStatus },
          reason: `${nextStatus === 'ativo' ? 'Reativação' : 'Inativação'} solicitada para ${client.name}`,
          status: 'pendente',
        });

    setChangingStatus(false);
    if (result.error) {
      setMessage({ text: result.error, error: true });
      return;
    }
    if (isAdmin && result.data) {
      setClient((current) => ({ ...current, ...result.data, contractUrl: current.contractUrl, contractPath: current.contractPath }));
    }
    setMessage({
      text: isRH ? 'Solicitação enviada para aprovação do administrativo.' : `Cliente ${nextStatus === 'ativo' ? 'reativado' : 'inativado'} com sucesso.`,
      error: false,
    });
  }

  async function handleDocumentDownload(document) {
    const result = await getDocumentDownloadUrl(document);
    if (result.error) { setMessage({ text: 'Erro ao baixar documento.', error: true }); return; }
    window.open(result.data, '_blank', 'noopener,noreferrer');
  }

  async function handleDocumentDelete(document) {
    if (!window.confirm(`Excluir definitivamente “${document.title}”?`)) return;
    const result = await deleteDocument(document.id);
    if (result.error) { setMessage({ text: result.error, error: true }); return; }
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setMessage({ text: 'Documento excluído com sucesso.', error: false });
  }

  async function handleDocumentDeleteRequest(document) {
    const result = await createApprovalRequest({ requested_by: profile?.id, request_type: 'excluir_registro', target_table: 'documents', target_id: document.id, payload: { title: document.title, file_url: document.fileReference }, reason: `Exclusão solicitada para o documento ${document.title}`, status: 'pendente' });
    setMessage({ text: result.error || 'Solicitação de exclusão enviada ao Admin.', error: Boolean(result.error) });
  }

  if (loadState.loading) return <div className="page-shell"><div className="surface-card p-6 text-sm font-bold text-slate-600">Carregando condomínio...</div></div>;
  if (!client) return <div className="page-shell"><div className="surface-card p-6 text-sm font-bold text-red-700">{loadState.error || 'Condomínio não encontrado.'}</div></div>;

  const shouldReactivate = ['inativo', 'encerrado'].includes(client.statusValue);
  const history = buildClientHistory(client, occurrences);

  return (
    <div className="page-shell">
      <PageTitle
        title={client.name}
        subtitle={client.address || 'Endereço não informado'}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className={shouldReactivate ? 'secondary-button' : 'quiet-button'} type="button" disabled={changingStatus} onClick={() => handleStatusChange(shouldReactivate ? 'ativo' : 'inativo')}>
              {shouldReactivate ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
              {changingStatus ? 'Processando...' : isRH ? `Solicitar ${shouldReactivate ? 'reativação' : 'inativação'}` : shouldReactivate ? 'Reativar' : 'Inativar'}
            </button>
            <Link className="primary-button" to={`/clientes/${client.id}/editar`}><Edit className="h-5 w-5" /> Editar condomínio</Link>
          </div>
        }
      />

      {message.text && <div className={`rounded-2xl border p-4 text-sm font-bold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
      {isRH && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Alterações do RH são enviadas para aprovação final do Admin.</div>}
      {loadState.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{loadState.error}</div>}

      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div><p className="text-sm font-bold text-slate-500">Responsável</p><p className="font-black text-luvig-ink">{client.manager || 'Não informado'}</p></div>
          <StatusBadge status={client.status} />
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3">
          {visibleTabs.map((tab) => (
            <button key={tab.label} className={`touch-button whitespace-nowrap ${activeTab === tab.label ? 'bg-luvig-blue text-white' : 'bg-slate-50 text-slate-600 hover:bg-luvig-light'}`} onClick={() => setActiveTab(tab.label)} type="button">
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === 'Resumo' && <Summary client={client} isAdmin={isAdmin} />}
          {activeTab === 'Contrato' && <Contract client={client} />}
          {activeTab === 'Documentos' && <div className="space-y-4"><div className="flex justify-end"><Link className="secondary-button" to={`/documentos/novo?clientId=${client.id}`}><FileText className="h-4 w-4" />Enviar documento</Link></div><DocumentList documents={documents} isAdmin={isAdmin} isRH={isRH} onDownload={handleDocumentDownload} onDelete={handleDocumentDelete} onRequestDelete={handleDocumentDeleteRequest} /></div>}
          {activeTab === 'Financeiro' && <ClientFinance summary={financial} />}
          {activeTab === 'Ocorrências' && <OccurrenceList items={occurrences} />}
          {activeTab === 'Histórico' && <HistoryList items={history} />}
        </div>
      </section>
    </div>
  );
}

function Summary({ client, isAdmin }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Info title="Telefone" value={client.phone || 'Não informado'} />
      <Info title="Bairro" value={client.neighborhood || 'Não informado'} />
      <Info title="Valor mensal" value={isAdmin ? client.monthlyValue === null ? 'Não informado' : currencyBRL(client.monthlyValue) : 'Restrito ao Admin'} />
      <Info title="Vencimento" value={client.dueDay ? `Dia ${client.dueDay}` : 'Não informado'} />
      <Info title="Endereço" value={client.address || 'Não informado'} wide />
      <Info title="Serviços contratados" value={client.services || 'Nenhum serviço informado'} wide />
      <Info title="Observações" value={client.notes || 'Sem observações.'} wide />
    </div>
  );
}

function Contract({ client }) {
  return client.contractPath ? (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
      <FileText className="h-10 w-10 text-luvig-blue" />
      <h3 className="mt-3 font-black text-luvig-ink">Contrato anexado</h3>
      {client.contractUrl ? <a className="primary-button mt-4" href={client.contractUrl} target="_blank" rel="noreferrer">Abrir contrato</a> : <p className="mt-2 text-sm font-semibold text-slate-500">Não foi possível gerar o link do contrato.</p>}
    </div>
  ) : <Prepared title="Nenhum contrato anexado" />;
}

function ClientFinance({ summary }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info title="Total pago" value={currencyBRL(summary.totalPaid)} />
        <Info title="Total pendente" value={currencyBRL(summary.totalPending)} />
        <Info title="Última cobrança" value={summary.lastCharge ? shortDate(summary.lastCharge.dueDate || summary.lastCharge.sentDate) : 'Nenhuma'} />
        <Info title="Próximo vencimento" value={summary.nextDue ? shortDate(summary.nextDue.dueDate) : 'Nenhum'} />
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
        <span className="text-sm font-bold text-slate-500">Status financeiro</span>
        <StatusBadge status={summary.financialStatus} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {summary.entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-luvig-blue">{entry.type}</p><h3 className="mt-1 font-black text-luvig-ink">{entry.title}</h3></div><StatusBadge status={entry.status} /></div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-500"><span>{currencyBRL(entry.amount)}</span><span>Vencimento: {shortDate(entry.dueDate)}</span></div>
          </article>
        ))}
        {!summary.entries.length && <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500 lg:col-span-2">Nenhuma entrada vinculada a este cliente.</div>}
      </div>
    </div>
  );
}

function OccurrenceList({ items }) {
  if (!items.length) return <Prepared title="Nenhuma ocorrência vinculada" />;
  return <div className="grid gap-3 lg:grid-cols-2">{items.map((item) => (
    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-luvig-blue">{item.type}</p><h3 className="mt-1 font-black text-luvig-ink">{item.title}</h3></div><StatusBadge status={item.status} /></div>
      <p className="mt-2 text-sm font-semibold text-slate-500">{item.description}</p>
      <p className="mt-3 text-xs font-bold text-slate-500">{shortDate(item.date)} · Registrado por {item.createdByName}</p>
    </article>
  ))}</div>;
}

function buildClientHistory(client, occurrences) {
  const items = [];
  if (client.createdAt) items.push({ id: 'created', date: client.createdAt, title: 'Condomínio cadastrado', description: 'Registro criado no sistema.' });
  if (client.contractPath) items.push({ id: 'contract', date: client.updatedAt || client.createdAt, title: 'Contrato anexado', description: 'Arquivo de contrato disponível.' });
  if (client.updatedAt && client.updatedAt !== client.createdAt) items.push({ id: 'updated', date: client.updatedAt, title: 'Cadastro atualizado', description: `Status atual: ${client.status}.` });
  occurrences.filter((item) => item.statusValue === 'confirmado').forEach((item) => items.push({ id: item.id, date: item.date, title: item.title, description: item.description }));
  return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function HistoryList({ items }) {
  if (!items.length) return <Prepared title="Nenhum evento no histórico" />;
  return <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-luvig-blue">{shortDate(item.date)}</p><h3 className="mt-1 font-black text-luvig-ink">{item.title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{item.description}</p></article>)}</div>;
}

function Info({ title, value, wide = false }) {
  return <div className={`rounded-xl bg-slate-50 p-4 ${wide ? 'md:col-span-2' : ''}`}><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-2 whitespace-pre-wrap font-black text-luvig-ink">{value}</p></div>;
}

function Prepared({ title }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center"><Building2 className="h-9 w-9 text-slate-400" /><p className="mt-3 font-black text-luvig-ink">{title}</p></div>;
}
