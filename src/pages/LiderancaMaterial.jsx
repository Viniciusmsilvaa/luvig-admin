import { Send } from 'lucide-react';
import { useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createRequest } from '../services/requestService.js';

export default function LiderancaMaterial() {
  const { profile } = useAuth();
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ saving: true, message: '', error: '' });
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await createRequest({
      requested_by: profile?.id,
      type: formData.type,
      title: `Pedido de material - ${formData.type}`,
      description: `Quantidade: ${formData.quantity || 'não informada'}\n${formData.description || ''}`.trim(),
      urgency: formData.urgency,
      status: 'pendente',
    });

    setStatus({
      saving: false,
      error: result.error ?? '',
      message: result.error ? '' : 'Pedido enviado para conferência.',
    });
  }

  return (
    <div className="page-shell max-w-3xl">
      <PageTitle title="Pedido de material" subtitle="Solicitação simples para acompanhamento administrativo." />
      {status.message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{status.message}</div>}
      {status.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{status.error}</div>}
      <form className="surface-card grid gap-4 p-5" onSubmit={handleSubmit}>
        <FormInput
          label="Tipo"
          name="type"
          as="select"
          options={[
            { label: 'Produto de limpeza', value: 'produto_limpeza' },
            { label: 'Produto de piscina', value: 'produto_piscina' },
            { label: 'Equipamento', value: 'equipamento' },
            { label: 'Uniforme', value: 'uniforme' },
            { label: 'Ferramenta', value: 'ferramenta' },
            { label: 'Outro', value: 'outro' },
          ]}
        />
        <FormInput label="Quantidade" name="quantity" type="number" placeholder="0" />
        <FormInput label="Urgência" name="urgency" as="select" options={[{ label: 'Baixa', value: 'baixa' }, { label: 'Média', value: 'normal' }, { label: 'Alta', value: 'alta' }, { label: 'Urgente', value: 'urgente' }]} />
        <FormInput label="Observação" name="description" as="textarea" />
        <button className="primary-button w-full" type="submit" disabled={status.saving}>
          <Send className="h-5 w-5" />
          {status.saving ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
