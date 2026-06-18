import { FileUp, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { documentTypeOptions, getDocumentOptions, uploadDocument } from '../services/documentService.js';

export default function NovoDocumento() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef(null);
  const [options, setOptions] = useState({ employees: [], clients: [] });
  const [file, setFile] = useState(null);
  const [state, setState] = useState({ loading: true, saving: false, error: '' });

  useEffect(() => { getDocumentOptions().then((result) => { setOptions(result.data || { employees: [], clients: [] }); setState((current) => ({ ...current, loading: false, error: result.error || '' })); }); }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, saving: true, error: '' }));
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await uploadDocument({ file, type: data.type, employeeId: data.employee_id, clientId: data.client_id, title: data.title, observation: data.observation, uploadedBy: profile?.id });
    if (result.error) { setState((current) => ({ ...current, saving: false, error: result.error || 'Erro ao enviar documento.' })); return; }
    navigate('/documentos', { replace: true, state: { notice: 'Documento enviado com sucesso.' } });
  }

  return (
    <div className="page-shell">
      <PageTitle title="Novo documento" subtitle="Envie o arquivo e vincule-o a um funcionário, cliente ou à administração." />
      {state.error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{state.error}</div>}
      {state.loading ? <div className="surface-card p-6 text-sm font-bold text-slate-500">Carregando opções...</div> : <form className="surface-card grid gap-4 p-5 md:grid-cols-2" onSubmit={handleSubmit}>
        <FormInput label="Tipo" name="type" as="select" options={documentTypeOptions} required />
        <FormInput label="Título" name="title" placeholder="Nome do documento" required />
        <FormInput label="Funcionário (opcional)" name="employee_id" as="select" options={[{ value: '', label: 'Sem funcionário vinculado' }, ...options.employees.map((item) => ({ value: item.id, label: item.name }))]} defaultValue={searchParams.get('employeeId') || ''} />
        <FormInput label="Cliente (opcional)" name="client_id" as="select" options={[{ value: '', label: 'Sem cliente vinculado' }, ...options.clients.map((item) => ({ value: item.id, label: item.name }))]} defaultValue={searchParams.get('clientId') || ''} />
        <div className="md:col-span-2"><FormInput label="Observação" name="observation" as="textarea" placeholder="Informações adicionais sobre o arquivo" /></div>
        <label className="block md:col-span-2"><span className="field-label">Arquivo</span><input ref={fileRef} className="sr-only" type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} required /><button className="secondary-button w-full justify-start" type="button" onClick={() => fileRef.current?.click()}><FileUp className="h-5 w-5" />{file?.name || 'Selecionar arquivo'}</button><p className="mt-2 text-xs font-semibold text-slate-500">PDF, imagens e documentos de até 20 MB.</p></label>
        <div className="md:col-span-2"><button className="primary-button" type="submit" disabled={state.saving || !file}><Save className="h-5 w-5" />{state.saving ? 'Upload em andamento...' : 'Salvar documento'}</button></div>
      </form>}
    </div>
  );
}
