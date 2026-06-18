import { CheckCircle2, Edit3, Eye, FileText, Paperclip, Save, Search, Send, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getEmployeeOptions } from '../services/employeeService.js';
import { createDocumentFromOccurrence } from '../services/documentService.js';
import {
  confirmOccurrence,
  createOccurrence,
  getScoreRule,
  listOccurrences,
  occurrenceTypeOptions,
  recommendOccurrence,
  rejectOccurrence,
  scoreRuleOptions,
  setOccurrenceAttachment,
  uploadOccurrenceAttachment,
  updateOccurrence,
} from '../services/occurrenceService.js';
import { shortDate } from '../utils/formatters.js';

const statusFilters = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'confirmado', label: 'Confirmadas' },
  { value: 'recusado', label: 'Recusadas' },
];

export default function NovaOcorrencia() {
  const { isAdmin, isRH, isLeader, profile } = useAuth();
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState({ text: '', error: false });
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [occurrenceType, setOccurrenceType] = useState('falta');
  const [selectedRule, setSelectedRule] = useState('falta_justificada');
  const [attachment, setAttachment] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'todos', employeeId: '', type: '', dateFrom: '', dateTo: '' });
  const [loadState, setLoadState] = useState({ loading: true, error: '', usingFallback: false });

  const loadData = useCallback(async () => {
    setLoadState((current) => ({ ...current, loading: true, error: '' }));
    const [employeeResult, occurrenceResult] = await Promise.all([getEmployeeOptions(), listOccurrences()]);
    setEmployees(employeeResult.data || []);
    setOccurrences(occurrenceResult.data || []);
    setLoadState({
      loading: false,
      error: employeeResult.error || occurrenceResult.error || '',
      usingFallback: Boolean(employeeResult.usingFallback || occurrenceResult.usingFallback),
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const visibleOccurrences = useMemo(() => occurrences.filter((occurrence) => {
    const search = filters.search.trim().toLocaleLowerCase('pt-BR');
    const searchable = `${occurrence.employee} ${occurrence.type} ${occurrence.title} ${occurrence.description}`.toLocaleLowerCase('pt-BR');
    const statusMatch = filters.status === 'todos'
      || (filters.status === 'pendentes' && ['aguardando_conferencia', 'recomendado_pelo_rh'].includes(occurrence.statusValue))
      || occurrence.statusValue === filters.status;
    return (!search || searchable.includes(search))
      && statusMatch
      && (!filters.employeeId || occurrence.employeeId === filters.employeeId)
      && (!filters.type || occurrence.typeValue === filters.type)
      && (!filters.dateFrom || occurrence.date >= filters.dateFrom)
      && (!filters.dateTo || occurrence.date <= filters.dateTo);
  }), [filters, occurrences]);

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage({ text: '', error: false });
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await createOccurrence({
      ...formData,
      score_rule: selectedRule,
      created_by: profile?.id,
      source: isAdmin ? 'admin' : isRH ? 'rh' : 'lider',
      status: isAdmin ? formData.status : 'aguardando_conferencia',
    });

    if (result.error || !result.data) {
      setSaving(false);
      setMessage({ text: result.error || 'Não foi possível criar a ocorrência.', error: true });
      return;
    }

    if (attachment) {
      const upload = await uploadOccurrenceAttachment(attachment, result.data.id);
      if (upload.error) {
        setSaving(false);
        setMessage({ text: `Ocorrência criada, mas ${upload.error.toLocaleLowerCase('pt-BR')}`, error: true });
        await loadData();
        return;
      }
      const link = await setOccurrenceAttachment(result.data.id, upload.data.path);
      if (link.error) {
        setSaving(false);
        setMessage({ text: link.error, error: true });
        await loadData();
        return;
      }
      if (!isLeader) {
        const documentLink = await createDocumentFromOccurrence({ occurrence: result.data, attachmentPath: upload.data.path, attachmentFile: attachment, uploadedBy: profile?.id });
        if (documentLink.error) {
          setSaving(false);
          setMessage({ text: 'Ocorrência criada e anexo vinculado, mas não foi possível salvá-lo na Central de Documentos.', error: true });
          await loadData();
          return;
        }
      }
    }

    event.currentTarget.reset();
    setAttachment(null);
    setOccurrenceType('falta');
    setSelectedRule('falta_justificada');
    setSaving(false);
    setMessage({
      text: isLeader
        ? 'Ocorrência criada e enviada para conferência.'
        : isRH ? 'Ocorrência criada e enviada para decisão do Admin.' : 'Ocorrência criada com sucesso.',
      error: false,
    });
    await loadData();
  }

  async function handleReview(occurrence, action) {
    setMessage({ text: '', error: false });
    const result = action === 'confirmado'
      ? await confirmOccurrence(occurrence.id, profile?.id)
      : action === 'recusado'
        ? await rejectOccurrence(occurrence.id, profile?.id)
        : await recommendOccurrence(occurrence.id);
    if (result.error) {
      setMessage({ text: result.error, error: true });
      return;
    }
    setMessage({
      text: action === 'confirmado' ? 'Ocorrência aprovada. Nota atualizada.' : action === 'recusado' ? 'Ocorrência recusada.' : 'Ocorrência recomendada ao Admin.',
      error: false,
    });
    await loadData();
  }

  async function handleEdit(event, occurrence) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await updateOccurrence(occurrence.id, {
      ...data,
      client_id: occurrence.clientId,
      status: occurrence.statusValue,
      source: occurrence.source,
      attachment_url: occurrence.attachmentPath,
    });
    setMessage({ text: result.error || 'Ocorrência atualizada. Nota recalculada quando aplicável.', error: Boolean(result.error) });
    if (!result.error) {
      setEditingId(null);
      await loadData();
    }
  }

  const rule = getScoreRule(selectedRule);
  const availableScoreRules = [scoreRuleOptions[0], ...scoreRuleOptions.filter((item) => item.type === occurrenceType)];

  function handleTypeChange(event) {
    const nextType = event.target.value;
    const defaultRule = scoreRuleOptions.find((item) => item.type === nextType);
    setOccurrenceType(nextType);
    setSelectedRule(defaultRule?.value || 'sem_impacto');
  }

  return (
    <div className="page-shell">
      <PageTitle
        title="Ocorrências"
        subtitle={isLeader ? 'Registros da liderança aguardam conferência.' : isRH ? 'RH revisa e recomenda; Admin finaliza.' : 'Cadastro, análise e decisão das ocorrências.'}
      />

      {message.text && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {message.text}
        </div>
      )}

      {(loadState.loading || loadState.error) && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${loadState.error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>
          {loadState.loading ? 'Carregando dados...' : loadState.error}
        </div>
      )}

      <form className="surface-card grid gap-4 p-5 md:grid-cols-2" onSubmit={handleSubmit}>
        <FormInput
          label="Funcionário"
          name="employee_id"
          as="select"
          options={[{ label: 'Sem funcionário vinculado', value: '' }, ...employees.map((employee) => ({ label: employee.name, value: employee.id }))]}
        />
        <FormInput label="Tipo de ocorrência" name="type" as="select" options={occurrenceTypeOptions} value={occurrenceType} onChange={handleTypeChange} required />
        <FormInput label="Título" name="title" placeholder="Resumo curto da ocorrência" />
        <FormInput label="Data" name="occurrence_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        <FormInput
          label="Regra de pontuação"
          name="score_rule"
          as="select"
          options={availableScoreRules}
          value={selectedRule}
          onChange={(event) => setSelectedRule(event.target.value)}
        />
        <FormInput label="Impacto previsto" value={rule.value === 'demissao' ? 'Zera a nota' : rule.impact.toFixed(2).replace('.', ',')} disabled readOnly />
        {isAdmin ? (
          <FormInput label="Status" name="status" as="select" options={[
            { label: 'Aguardando conferência', value: 'aguardando_conferencia' },
            { label: 'Confirmado', value: 'confirmado' },
          ]} />
        ) : <input type="hidden" name="status" value="aguardando_conferencia" />}
        <label className="block">
          <span className="field-label">Anexo opcional</span>
          <input ref={fileInputRef} className="sr-only" type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
          <button className="secondary-button w-full justify-start" type="button" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-5 w-5" />
            {attachment?.name || 'Selecionar anexo'}
          </button>
        </label>
        <div className="md:col-span-2">
          <FormInput label="Descrição" name="description" as="textarea" placeholder="Detalhes da ocorrência" required />
        </div>
        <div className="md:col-span-2">
          <button className="primary-button" type="submit" disabled={saving}>
            <Save className="h-5 w-5" />
            {saving ? 'Salvando...' : 'Criar ocorrência'}
          </button>
        </div>
      </form>

      <section className="surface-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input className="input-base pl-12" placeholder="Pesquisar ocorrências" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} />
          </label>
          <FormInput label="Funcionário" as="select" options={[{ label: 'Todos os funcionários', value: '' }, ...employees.map((employee) => ({ label: employee.name, value: employee.id }))]} value={filters.employeeId} onChange={(event) => setFilter('employeeId', event.target.value)} />
          <FormInput label="Tipo" as="select" options={[{ label: 'Todos os tipos', value: '' }, ...occurrenceTypeOptions]} value={filters.type} onChange={(event) => setFilter('type', event.target.value)} />
          <FormInput label="De" type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} />
          <FormInput label="Até" type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((item) => (
            <button key={item.value} className={`touch-button whitespace-nowrap ${filters.status === item.value ? 'bg-luvig-blue text-white' : 'bg-slate-100 text-slate-600'}`} type="button" onClick={() => setFilter('status', item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {visibleOccurrences.map((occurrence) => (
          <article key={occurrence.id} className="surface-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-luvig-blue">{occurrence.type}</p>
                <h3 className="mt-1 font-black text-luvig-ink">{occurrence.title} · {occurrence.employee}</h3>
              </div>
              <StatusBadge status={occurrence.status} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-500">{occurrence.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              <span>{shortDate(occurrence.date)}</span>
              <span>Impacto {occurrence.impact > 0 ? '+' : ''}{occurrence.impact.toFixed(2).replace('.', ',')}</span>
              <span>Origem {occurrence.source}</span>
            </div>
            {expandedId === occurrence.id && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                <p>{occurrence.description}</p>
                {occurrence.attachmentUrl && <a className="mt-3 inline-flex items-center gap-2 font-black text-luvig-blue" href={occurrence.attachmentUrl} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> Abrir anexo</a>}
              </div>
            )}
            {editingId === occurrence.id && (
              <form className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2" onSubmit={(event) => handleEdit(event, occurrence)}>
                <FormInput label="Funcionário" name="employee_id" as="select" options={[{ label: 'Sem funcionário', value: '' }, ...employees.map((employee) => ({ label: employee.name, value: employee.id }))]} defaultValue={occurrence.employeeId || ''} />
                <FormInput label="Tipo" name="type" as="select" options={occurrenceTypeOptions} defaultValue={occurrence.typeValue} />
                <FormInput label="Data" name="occurrence_date" type="date" defaultValue={occurrence.date} required />
                <FormInput label="Impacto" name="score_impact" type="number" min="-10" max="10" step="0.01" defaultValue={occurrence.impact} required />
                <div className="sm:col-span-2"><FormInput label="Título" name="title" defaultValue={occurrence.title} /></div>
                <div className="sm:col-span-2"><FormInput label="Descrição" name="description" as="textarea" defaultValue={occurrence.description} required /></div>
                <div className="sm:col-span-2"><button className="primary-button" type="submit"><Save className="h-4 w-4" /> Salvar alterações</button></div>
              </form>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="secondary-button" type="button" onClick={() => setExpandedId((current) => current === occurrence.id ? null : occurrence.id)}>
                <Eye className="h-4 w-4" /> Detalhes
              </button>
              {(isAdmin || (isRH && ['aguardando_conferencia', 'recomendado_pelo_rh'].includes(occurrence.statusValue))) && (
                <button className="secondary-button" type="button" onClick={() => setEditingId((current) => current === occurrence.id ? null : occurrence.id)}><Edit3 className="h-4 w-4" /> Editar</button>
              )}
              {isAdmin && ['aguardando_conferencia', 'recomendado_pelo_rh'].includes(occurrence.statusValue) && (
                <>
                  <button className="primary-button" type="button" onClick={() => handleReview(occurrence, 'confirmado')}><CheckCircle2 className="h-4 w-4" /> Aprovar</button>
                  <button className="secondary-button text-red-700" type="button" onClick={() => handleReview(occurrence, 'recusado')}><XCircle className="h-4 w-4" /> Recusar</button>
                </>
              )}
              {isRH && occurrence.statusValue === 'aguardando_conferencia' && (
                <button className="primary-button" type="button" onClick={() => handleReview(occurrence, 'recomendado_pelo_rh')}><Send className="h-4 w-4" /> Recomendar</button>
              )}
            </div>
          </article>
        ))}
      </section>

      {!loadState.loading && visibleOccurrences.length === 0 && (
        <section className="surface-card p-8 text-center text-sm font-bold text-slate-500">Nenhuma ocorrência encontrada.</section>
      )}
    </div>
  );
}
