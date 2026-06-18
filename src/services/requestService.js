import { runQuery } from './serviceHelpers.js';

export const requestTypeOptions = [
  { value: 'uniforme', label: 'Uniforme' },
  { value: 'produto_limpeza', label: 'Produto de limpeza' },
  { value: 'produto_piscina', label: 'Produto de piscina' },
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'folga', label: 'Folga' },
  { value: 'ferias', label: 'Férias' },
  { value: 'documento', label: 'Documento' },
  { value: 'ajuda', label: 'Ajuda' },
  { value: 'outro', label: 'Outro' },
];

const statusLabels = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  resolvido: 'Resolvido',
};

function mapRequestFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    requester: row.profiles?.full_name || 'Usuário',
    requestedBy: row.requested_by,
    date: row.created_at,
    status: statusLabels[row.status] || row.status,
    statusValue: row.status,
    type: row.type,
    urgency: row.urgency,
    target: row.clients?.name || row.employees?.full_name || 'Administrativo',
    description: row.description || '',
  };
}

export async function listRequests({ ownOnly = false, profileId = null } = {}) {
  return runQuery(
    (client) => {
      let query = client
        .from('requests')
        .select('*, clients(name), employees(full_name), profiles!requests_requested_by_fkey(full_name)')
        .order('created_at', { ascending: false });
      if (ownOnly && profileId) query = query.eq('requested_by', profileId);
      return query;
    },
    [],
    'Erro ao carregar pedidos.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map(mapRequestFromDb),
  }));
}

export async function createRequest(formData) {
  return runQuery(
    (client) => client.from('requests').insert(formData).select().single(),
    null,
    'Erro ao criar pedido.',
  );
}

export async function updateRequestStatus(id, status) {
  return runQuery(
    (client) => client.from('requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single(),
    null,
    'Erro ao atualizar pedido.',
  );
}
