import { AlertTriangle, FileCheck2, FileText, Plus, Search, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DocumentList from '../components/DocumentList.jsx';
import PageTitle from '../components/PageTitle.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createApprovalRequest } from '../services/approvalService.js';
import { deleteDocument, documentStatusOptions, documentTypeOptions, getDocumentDownloadUrl, getDocumentOptions, getDocuments, subscribeDocuments, updateDocument } from '../services/documentService.js';

export default function Documentos() {
  const location = useLocation();
  const { isAdmin, isRH, profile } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [options, setOptions] = useState({ employees: [], clients: [] });
  const [filters, setFilters] = useState({ search: '', type: '', employeeId: '', clientId: '', dateFrom: '', dateTo: '', status: '' });
  const [state, setState] = useState({ loading: true, error: '', message: location.state?.notice || '' });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    const result = await getDocuments(filters);
    setDocuments(result.data || []);
    setState((current) => ({ ...current, loading: false, error: result.error || '' }));
  }, [filters]);

  useEffect(() => { getDocumentOptions().then((result) => setOptions(result.data || { employees: [], clients: [] })); }, []);
  useEffect(() => { const timer = window.setTimeout(load, 250); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => subscribeDocuments(load), [load]);

  const stats = useMemo(() => ({
    total: documents.length,
    atestado: documents.filter((item) => item.typeValue === 'atestado').length,
    advertencia: documents.filter((item) => item.typeValue === 'advertencia').length,
    suspensao: documents.filter((item) => item.typeValue === 'suspensao').length,
    contrato: documents.filter((item) => ['contrato', 'contrato_condominio'].includes(item.typeValue)).length,
    rescisao: documents.filter((item) => item.typeValue === 'rescisao').length,
  }), [documents]);

  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const feedback = (message, error = false) => setState((current) => ({ ...current, message, error: error ? message : current.error }));

  async function handleDownload(document) {
    const result = await getDocumentDownloadUrl(document);
    if (result.error) return feedback('Erro ao baixar documento.', true);
    window.open(result.data, '_blank', 'noopener,noreferrer');
  }

  async function handleDelete(document) {
    if (!window.confirm(`Excluir definitivamente “${document.title}”?`)) return;
    const result = await deleteDocument(document.id);
    if (result.error) return feedback(result.error, true);
    feedback('Documento excluído com sucesso.');
    await load();
  }

  async function handleRequestDelete(document) {
    const result = await createApprovalRequest({ requested_by: profile?.id, request_type: 'excluir_registro', target_table: 'documents', target_id: document.id, payload: { title: document.title, file_url: document.fileReference }, reason: `Exclusão solicitada para o documento ${document.title}`, status: 'pendente' });
    feedback(result.error || 'Solicitação de exclusão enviada ao Admin.', Boolean(result.error));
  }

  async function handleEdit(document) {
    const title = window.prompt('Título do documento:', document.title);
    if (title === null || !title.trim()) return;
    const archive = window.confirm('Deseja arquivar este documento? Clique em Cancelar para mantê-lo ativo.');
    const result = await updateDocument(document.id, { title: title.trim(), status: archive ? 'arquivado' : 'ativo' });
    if (result.error) return feedback(result.error, true);
    feedback('Documento atualizado com sucesso.');
    await load();
  }

  return (
    <div className="page-shell">
      <PageTitle title="Central de Documentos" subtitle="Arquivos de funcionários, condomínios e administração em um só lugar." actions={<Link className="primary-button" to="/documentos/novo"><Plus className="h-5 w-5" />Novo documento</Link>} />
      {state.message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{state.message}</div>}
      {state.error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{state.error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total de documentos" value={stats.total} icon={FileText} /><StatCard label="Atestados" value={stats.atestado} icon={FileCheck2} tone="cyan" /><StatCard label="Advertências" value={stats.advertencia} icon={AlertTriangle} tone="amber" /><StatCard label="Suspensões" value={stats.suspensao} icon={ShieldAlert} tone="red" /><StatCard label="Contratos" value={stats.contrato} icon={FileCheck2} tone="green" /><StatCard label="Rescisões" value={stats.rescisao} icon={FileText} tone="slate" />
      </section>
      <section className="surface-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input className="input-base pl-12" placeholder="Buscar por título, funcionário, condomínio ou tipo" value={filters.search} onChange={setFilter('search')} /></label>
          <Filter label="Tipo"><select className="input-base" value={filters.type} onChange={setFilter('type')}><option value="">Todos</option>{documentTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Filter>
          <Filter label="Status"><select className="input-base" value={filters.status} onChange={setFilter('status')}><option value="">Todos</option>{documentStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Filter>
          <Filter label="Funcionário"><select className="input-base" value={filters.employeeId} onChange={setFilter('employeeId')}><option value="">Todos</option>{options.employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Filter>
          <Filter label="Cliente"><select className="input-base" value={filters.clientId} onChange={setFilter('clientId')}><option value="">Todos</option>{options.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Filter>
          <Filter label="De"><input className="input-base" type="date" value={filters.dateFrom} onChange={setFilter('dateFrom')} /></Filter>
          <Filter label="Até"><input className="input-base" type="date" value={filters.dateTo} onChange={setFilter('dateTo')} /></Filter>
        </div>
      </section>
      <section className="surface-card overflow-hidden p-4">
        {state.loading ? <DocumentSkeleton /> : <DocumentList documents={documents} isAdmin={isAdmin} isRH={isRH} onDownload={handleDownload} onDelete={handleDelete} onRequestDelete={handleRequestDelete} onEdit={handleEdit} />}
      </section>
    </div>
  );
}

function Filter({ label, children }) { return <label><span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>{children}</label>; }
function DocumentSkeleton() { return <div className="space-y-3 animate-pulse">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 rounded-xl bg-slate-100" />)}</div>; }
