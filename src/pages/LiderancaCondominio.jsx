import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getClientOptions } from '../services/clientService.js';
import { createOccurrence } from '../services/occurrenceService.js';

export default function LiderancaCondominio() {
  const { profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [status, setStatus] = useState({ loading: true, saving: false, message: '', error: '' });

  useEffect(() => {
    let active = true;

    async function loadClients() {
      const result = await getClientOptions();
      if (!active) return;
      setClients(result.data ?? []);
      setStatus((current) => ({ ...current, loading: false, error: result.error ?? '' }));
    }

    loadClients();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, message: '', error: '' }));
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await createOccurrence({
      ...formData,
      created_by: profile?.id,
      source: 'lider',
      status: 'aguardando_conferencia',
      title: 'Ocorrência de condomínio',
      score_impact: 0,
    });

    setStatus((current) => ({
      ...current,
      saving: false,
      error: result.error ?? '',
      message: result.error ? '' : 'Registro enviado para conferência do RH/Admin.',
    }));
  }

  return (
    <div className="page-shell max-w-3xl">
      <PageTitle title="Ocorrência de condomínio" subtitle="Registro administrativo do prédio ou solicitação recebida." />
      {status.message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{status.message}</div>}
      {status.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{status.error}</div>}
      <form className="surface-card grid gap-4 p-5" onSubmit={handleSubmit}>
        <FormInput label="Condomínio" name="client_id" as="select" options={clients.map((client) => ({ label: client.name, value: client.id }))} />
        <FormInput
          label="Tipo"
          name="type"
          as="select"
          options={[
            { label: 'Prédio sujo', value: 'predio_sujo' },
            { label: 'Serviço não realizado', value: 'servico_nao_realizado' },
            { label: 'Reclamação do síndico', value: 'reclamacao_sindico' },
            { label: 'Solicitação do síndico', value: 'solicitacao_sindico' },
            { label: 'Problema encontrado', value: 'problema_condominio' },
          ]}
        />
        <FormInput label="Data" name="occurrence_date" type="date" />
        <FormInput label="Observação" name="description" as="textarea" />
        <button className="primary-button w-full" type="submit" disabled={status.saving}>
          <Send className="h-5 w-5" />
          {status.saving ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
