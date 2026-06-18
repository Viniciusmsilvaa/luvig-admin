import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientForm from '../components/ClientForm.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createApprovalRequest } from '../services/approvalService.js';
import { createClient, serializeClientData, updateClient } from '../services/clientService.js';
import { uploadClientContract } from '../services/clientContractService.js';

export default function NovoCliente() {
  const navigate = useNavigate();
  const { isAdmin, isRH, profile } = useAuth();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(data, contractFile) {
    setSaving(true);
    setMessage('');
    const payload = serializeClientData(data);

    if (isRH) {
      if (contractFile) {
        const upload = await uploadClientContract(contractFile, crypto.randomUUID());
        if (upload.error) {
          setMessage(upload.error);
          setSaving(false);
          return;
        }
        payload.contract_url = upload.data.path;
      }
      const result = await createApprovalRequest({
        requested_by: profile?.id,
        request_type: 'outro',
        target_table: 'clients',
        payload,
        reason: 'Cadastro de condomínio solicitado pelo RH',
        status: 'pendente',
      });
      setSaving(false);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      navigate('/clientes', { state: { notice: 'Cadastro enviado para aprovação do administrativo.' } });
      return;
    }

    const result = await createClient(payload);
    if (result.error || !result.data) {
      setMessage(result.error || 'Não foi possível cadastrar o condomínio.');
      setSaving(false);
      return;
    }

    if (contractFile) {
      const upload = await uploadClientContract(contractFile, result.data.id);
      if (upload.error) {
        setMessage(`Cliente cadastrado, mas ${upload.error.toLocaleLowerCase('pt-BR')}`);
        setSaving(false);
        return;
      }
      const contractUpdate = await updateClient(result.data.id, { contract_url: upload.data.path });
      if (contractUpdate.error) {
        setMessage(contractUpdate.error);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    navigate('/clientes', { state: { notice: 'Cliente cadastrado com sucesso.' } });
  }

  return (
    <div className="page-shell">
      <PageTitle title="Adicionar condomínio" subtitle="Cadastre dados, serviços e contrato do cliente." />
      {message && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div>}
      <ClientForm
        showMonthlyValue={isAdmin}
        saving={saving}
        submitLabel={isRH ? 'Enviar para aprovação' : 'Salvar'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
