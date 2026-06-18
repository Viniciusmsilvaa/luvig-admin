import { CalendarDays, ClipboardList, Edit, FileText, History, UserCheck, UserX, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';
import DocumentList from '../components/DocumentList.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createApprovalRequest } from '../services/approvalService.js';
import { getEmployeeById, inactivateEmployee, reactivateEmployee } from '../services/employeeService.js';
import { deleteDocument, getDocumentDownloadUrl, getEmployeeDocuments } from '../services/documentService.js';
import { getEmployeeHistory } from '../services/historyService.js';
import { currencyBRL, shortDate } from '../utils/formatters.js';
import { getScoreTheme } from '../utils/scoreColors.js';

const allTabs = [
  { label: 'Resumo', icon: ClipboardList, permission: null },
  { label: 'Histórico', icon: History, permission: 'employees:full-history' },
  { label: 'Documentos', icon: FileText, permission: null },
  { label: 'Financeiro', icon: Wallet, permission: 'employees:finance' },
  { label: 'Ocorrências', icon: CalendarDays, permission: 'employees:full-history' },
];

export default function FuncionarioDetalhe() {
  const { id } = useParams();
  const location = useLocation();
  const { can, isAdmin, isRH, profile } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [history, setHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadState, setLoadState] = useState({ loading: true, error: '', usingFallback: false });
  const [message, setMessage] = useState(location.state?.notice || '');
  const [messageIsError, setMessageIsError] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const tabs = useMemo(() => allTabs.filter((tab) => !tab.permission || can(tab.permission)), [can]);
  const [activeTab, setActiveTab] = useState('Resumo');
  const showSalary = can('employees:salaries');

  useEffect(() => {
    if (!tabs.some((tab) => tab.label === activeTab)) setActiveTab('Resumo');
  }, [activeTab, tabs]);

  useEffect(() => {
    let active = true;
    async function loadEmployee() {
      setLoadState({ loading: true, error: '', usingFallback: false });
      const result = await getEmployeeById(id);
      if (!active) return;
      setEmployee(result.data || null);
      const [historyResult, documentResult] = result.data
        ? await Promise.all([getEmployeeHistory(id), getEmployeeDocuments(id)])
        : [{ data: [], error: null, usingFallback: false }, { data: [], error: null, usingFallback: false }];
      if (!active) return;
      setHistory(historyResult.data || []);
      setDocuments(documentResult.data || []);
      setLoadState({
        loading: false,
        error: result.error || historyResult.error || documentResult.error || (!result.data ? 'Funcionário não encontrado.' : ''),
        usingFallback: Boolean(result.usingFallback || historyResult.usingFallback),
      });
    }
    loadEmployee();
    return () => { active = false; };
  }, [id]);

  async function handleStatusChange(nextStatus) {
    const action = nextStatus === 'ativo' ? 'reativar' : 'inativar';
    if (!window.confirm(`Deseja ${action} ${employee.name}?`)) return;

    setChangingStatus(true);
    setMessage('');
    setMessageIsError(false);
    let result;

    if (isAdmin) {
      result = nextStatus === 'ativo'
        ? await reactivateEmployee(employee.id)
        : await inactivateEmployee(employee.id);
    } else if (isRH) {
      result = await createApprovalRequest({
        requested_by: profile?.id,
        request_type: nextStatus === 'ativo' ? 'alterar_status_funcionario' : 'inativar_funcionario',
        target_table: 'employees',
        target_id: employee.id,
        payload: { status: nextStatus },
        reason: `${nextStatus === 'ativo' ? 'Reativação' : 'Inativação'} solicitada para ${employee.name}`,
        status: 'pendente',
      });
    }

    setChangingStatus(false);
    if (!result || result.error) {
      setMessage(result?.error || 'Não foi possível alterar o status.');
      setMessageIsError(true);
      return;
    }

    if (isAdmin && result.data) {
      setEmployee((current) => ({
        ...current,
        ...result.data,
        photoUrl: result.data.photoUrl || current.photoUrl,
      }));
    }
    setMessage(
      isRH
        ? 'Solicitação enviada para aprovação do administrativo.'
        : `Funcionário ${nextStatus === 'ativo' ? 'reativado' : 'inativado'} com sucesso.`,
    );
  }

  async function handleDocumentDownload(document) {
    const result = await getDocumentDownloadUrl(document);
    if (result.error) { setMessage('Erro ao baixar documento.'); setMessageIsError(true); return; }
    window.open(result.data, '_blank', 'noopener,noreferrer');
  }

  async function handleDocumentDelete(document) {
    if (!window.confirm(`Excluir definitivamente “${document.title}”?`)) return;
    const result = await deleteDocument(document.id);
    if (result.error) { setMessage(result.error); setMessageIsError(true); return; }
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setMessage('Documento excluído com sucesso.');
    setMessageIsError(false);
  }

  async function handleDocumentDeleteRequest(document) {
    const result = await createApprovalRequest({ requested_by: profile?.id, request_type: 'excluir_registro', target_table: 'documents', target_id: document.id, payload: { title: document.title, file_url: document.fileReference }, reason: `Exclusão solicitada para o documento ${document.title}`, status: 'pendente' });
    setMessage(result.error || 'Solicitação de exclusão enviada ao Admin.');
    setMessageIsError(Boolean(result.error));
  }

  if (loadState.loading) {
    return (
      <div className="page-shell">
        <div className="surface-card p-6 text-sm font-bold text-slate-600">Carregando funcionário...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-shell">
        <div className="surface-card p-6 text-sm font-bold text-red-700">{loadState.error || 'Funcionário não encontrado.'}</div>
      </div>
    );
  }

  const theme = getScoreTheme(employee.score);
  const canChangeStatus = isAdmin || isRH;
  const shouldReactivate = ['inativo', 'desligado'].includes(employee.statusValue);

  return (
    <div className="page-shell">
      <PageTitle
        title={employee.name}
        subtitle={employee.role}
        actions={
          <div className="flex flex-wrap gap-2">
            {canChangeStatus && (
              <button
                className={shouldReactivate ? 'secondary-button' : 'quiet-button'}
                type="button"
                disabled={changingStatus}
                onClick={() => handleStatusChange(shouldReactivate ? 'ativo' : 'inativo')}
              >
                {shouldReactivate ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
                {changingStatus
                  ? 'Processando...'
                  : isRH
                    ? `Solicitar ${shouldReactivate ? 'reativação' : 'inativação'}`
                    : shouldReactivate ? 'Reativar' : 'Inativar'}
              </button>
            )}
            <Link className="primary-button" to={`/funcionarios/${employee.id}/editar`}>
              <Edit className="h-5 w-5" />
              Editar
            </Link>
          </div>
        }
      />

      {message && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${
          messageIsError
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {message}
        </div>
      )}

      {isRH && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          RH pode editar e solicitar alterações, mas a aprovação final é exclusiva do Admin.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <aside className={`surface-card p-5 ${employee.isInactive ? 'grayscale-[35%] opacity-80' : ''}`}>
          <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-luvig-ink text-3xl font-black text-white">
            {employee.photoUrl ? (
              <img className="h-full w-full object-cover" src={employee.photoUrl} alt={`Foto de ${employee.name}`} />
            ) : (
              employee.avatar
            )}
          </div>
          <div className="mt-5 text-center">
            <StatusBadge status={employee.status} />
            <p className={`mt-4 text-4xl font-black ${theme.text}`}>{employee.score.toFixed(1)}</p>
            <p className="text-sm font-bold text-slate-500">Nota atual</p>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <Info label="Classificação" value={theme.label} />
            <Info label="Tendência" value={employee.scoreTrend} />
            <Info label="Nota atualizada" value={employee.scoreUpdatedAt ? new Date(employee.scoreUpdatedAt).toLocaleString('pt-BR') : 'Sem atualização'} />
            <Info label="Tempo de casa" value={employee.tenure} />
            <Info label="Próximas férias" value={employee.nextVacation} />
            <Info label="Aviso prévio" value={employee.notice} />
            <Info label="Retorno" value={employee.returnInfo} />
            {employee.specialStatus && <Info label="Situação atual" value={employee.specialStatus} />}
          </div>
        </aside>

        <div className="surface-card overflow-hidden">
          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                className={`touch-button whitespace-nowrap ${
                  activeTab === tab.label ? 'bg-luvig-blue text-white' : 'bg-slate-50 text-slate-600 hover:bg-luvig-light'
                }`}
                type="button"
                onClick={() => setActiveTab(tab.label)}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {activeTab === 'Resumo' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title="Contato" value={employee.phone || 'Não informado'} />
                <InfoCard title="Admissão" value={shortDate(employee.admissionDate)} />
                {showSalary ? (
                  <InfoCard title="Salário" value={employee.salary === null ? 'Não informado' : currencyBRL(employee.salary)} />
                ) : (
                  <InfoCard title="Salário" value="Restrito ao Admin" muted />
                )}
                <InfoCard title="Última ocorrência" value={employee.lastOccurrence} />
                <InfoCard title="Retorno de férias" value={shortDate(employee.vacationReturnDate)} />
                <InfoCard title="Retorno de atestado" value={shortDate(employee.medicalLeaveReturnDate)} />
                <InfoCard title="Início do aviso prévio" value={shortDate(employee.noticeStartDate)} />
                <InfoCard title="Final do aviso prévio" value={shortDate(employee.noticeEndDate)} />
                <InfoCard title="Observações" value={employee.notes || 'Sem observações.'} wide />
              </div>
            ) : activeTab === 'Histórico' || activeTab === 'Ocorrências' ? (
              <HistoryTimeline items={history} />
            ) : activeTab === 'Documentos' ? (
              <div className="space-y-4">
                <div className="flex justify-end"><Link className="secondary-button" to={`/documentos/novo?employeeId=${employee.id}`}><FileText className="h-4 w-4" />Enviar documento</Link></div>
                <DocumentList documents={documents} isAdmin={isAdmin} isRH={isRH} onDownload={handleDocumentDownload} onDelete={handleDocumentDelete} onRequestDelete={handleDocumentDeleteRequest} />
              </div>
            ) : (
              <ComingSoon label={activeTab} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black text-luvig-ink">{value}</p>
    </div>
  );
}

function InfoCard({ title, value, muted = false, wide = false }) {
  return (
    <div className={`compact-card p-4 ${muted ? 'bg-slate-50' : ''} ${wide ? 'md:col-span-2' : ''}`}>
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className={`mt-2 whitespace-pre-wrap text-base font-black ${muted ? 'text-slate-500' : 'text-luvig-ink'}`}>{value}</p>
    </div>
  );
}

function ComingSoon({ label }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
      <p className="text-lg font-black text-luvig-ink">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">Em breve</p>
    </div>
  );
}

function HistoryTimeline({ items }) {
  if (!items.length) {
    return <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">Nenhum registro confirmado no histórico.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-luvig-blue">{shortDate(item.date)}</p>
              <h3 className="mt-1 font-black text-luvig-ink">{item.type}</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${item.impact > 0 ? 'bg-emerald-100 text-emerald-700' : item.impact < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
              Impacto {item.impact > 0 ? '+' : ''}{item.impact.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-500">{item.description}</p>
        </article>
      ))}
    </div>
  );
}
