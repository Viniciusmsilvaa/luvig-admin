import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ClientForm from '../components/ClientForm.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createApprovalRequest } from '../services/approvalService.js';
import { getClientById, serializeClientData, updateClient } from '../services/clientService.js';
import { uploadClientContract } from '../services/clientContractService.js';

export default function EditarCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isRH, profile } = useAuth();
  const [client, setClient] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadClient() {
      const result = await getClientById(id);
      if (!active) return;
      setClient(result.data || null);
      setMessage(result.error || (!result.data ? 'Condomínio não encontrado.' : ''));
      setLoading(false);
    }
    loadClient();
    return () => { active = false; };
  }, [id]);

  async function handleSubmit(data, contractFile) {
    setSaving(true);
    setMessage('');
    const payload = serializeClientData(data);

    if (contractFile) {
      const upload = await uploadClientContract(contractFile, client.id);
      if (upload.error) {
        setMessage(upload.error);
        setSaving(false);
        return;
      }
      payload.contract_url = upload.data.path;
    }

    const result = isRH
      ? await createApprovalRequest({
          requested_by: profile?.id,
          request_type: 'outro',
          target_table: 'clients',
          target_id: client.id,
          payload,
          reason: `Edição solicitada para ${client.name}`,
          status: 'pendente',
        })
      : await updateClient(client.id, payload);

    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    navigate(`/clientes/${client.id}`, {
      state: { notice: isRH ? 'Alteração enviada para aprovação do administrativo.' : 'Cliente atualizado com sucesso.' },
    });
  }

  return (
    <div className="page-shell">
      <PageTitle title="Editar condomínio" subtitle={client?.name || 'Carregando dados...'} />
      {loading && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-luvig-blue">Carregando condomínio...</div>}
      {message && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div>}
      {!loading && client && (
        <ClientForm
          key={client.id}
          client={client}
          showMonthlyValue={isAdmin}
          saving={saving}
          submitLabel={isRH ? 'Enviar para aprovação' : 'Salvar'}
          cancelTo={`/clientes/${client.id}`}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
