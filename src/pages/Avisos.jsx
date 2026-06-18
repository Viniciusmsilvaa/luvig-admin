import { Plus, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createNotice, listNotices } from '../services/noticeService.js';
import { shortDate } from '../utils/formatters.js';

export default function Avisos() {
  const { isLeader, profile } = useAuth();
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [state, setState] = useState({ loading: true, saving: false, message: '', error: '' });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    const result = await listNotices();
    setNotices(result.data || []);
    setState((current) => ({ ...current, loading: false, error: result.error || '' }));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState((current) => ({ ...current, saving: true, message: '', error: '' }));
    const result = await createNotice({
      title: form.get('title'),
      message: form.get('message') || null,
      audience: form.get('audience'),
      publish_date: form.get('publish_date'),
      expires_at: form.get('expires_at') || null,
      status: form.get('status'),
      created_by: profile?.id,
    });
    if (result.error) {
      setState((current) => ({ ...current, saving: false, error: result.error }));
      return;
    }
    event.currentTarget.reset();
    setShowForm(false);
    setState((current) => ({ ...current, saving: false, message: 'Aviso salvo.' }));
    await load();
  }

  return (
    <div className="page-shell">
      <PageTitle
        title="Avisos"
        subtitle="Comunicados internos ativos e programados."
        actions={!isLeader && <button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}><Plus className="h-5 w-5" />Criar aviso</button>}
      />

      {showForm && (
        <form className="surface-card grid gap-4 p-5 md:grid-cols-2" onSubmit={handleSubmit}>
          <FormInput label="Título" name="title" required />
          <FormInput label="Público-alvo" name="audience" defaultValue="Todos" required />
          <FormInput label="Publicação" name="publish_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          <FormInput label="Expira em" name="expires_at" type="date" />
          <FormInput label="Status" name="status" as="select" defaultValue="ativo" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'programado', label: 'Programado' }, { value: 'encerrado', label: 'Encerrado' }]} />
          <div className="md:col-span-2"><FormInput label="Mensagem" name="message" as="textarea" rows="4" /></div>
          <div className="md:col-span-2"><button className="primary-button" type="submit" disabled={state.saving}><Send className="h-4 w-4" />{state.saving ? 'Salvando...' : 'Salvar aviso'}</button></div>
        </form>
      )}

      {(state.loading || state.error || state.message) && <div className={`rounded-2xl border p-4 text-sm font-bold ${state.error ? 'border-red-200 bg-red-50 text-red-700' : state.message ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-luvig-blue'}`}>{state.loading ? 'Carregando avisos...' : state.error || state.message}</div>}

      <section className="grid gap-4 lg:grid-cols-3">
        {notices.map((notice) => (
          <article key={notice.id} className="surface-card p-5">
            <StatusBadge status={notice.status} />
            <h2 className="mt-4 text-lg font-black text-luvig-ink">{notice.title}</h2>
            {notice.message && <p className="mt-2 text-sm font-semibold text-slate-600">{notice.message}</p>}
            <p className="mt-3 text-sm font-semibold text-slate-500">Público-alvo: {notice.audience}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Publicação: {shortDate(notice.publishDate)}</p>
          </article>
        ))}
        {!state.loading && !state.error && !notices.length && <div className="surface-card p-8 text-center text-sm font-semibold text-slate-500 lg:col-span-3">Nenhum aviso cadastrado.</div>}
      </section>
    </div>
  );
}
