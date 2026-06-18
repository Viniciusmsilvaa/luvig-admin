import { runQuery } from './serviceHelpers.js';
import { deleteDocument } from './documentService.js';

const statusLabels = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

function mapApprovalFromDb(row) {
  return {
    id: row.id,
    title: row.reason || row.request_type,
    type: row.request_type,
    requester: row.profiles?.full_name || 'Usuário',
    requestedBy: row.requested_by,
    status: statusLabels[row.status] || row.status,
    statusValue: row.status,
    date: row.created_at,
    summary: row.target_table ? `${row.target_table} · ${row.target_id || 'novo registro'}` : 'Solicitação aguardando análise.',
    targetTable: row.target_table,
    targetId: row.target_id,
    payload: row.payload || {},
    raw: row,
  };
}

export async function listApprovalRequests() {
  return runQuery(
    (client) =>
      client
        .from('approval_requests')
        .select('*, profiles!approval_requests_requested_by_fkey(full_name)')
        .order('created_at', { ascending: false }),
    [],
    'Erro ao carregar solicitações de aprovação.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map(mapApprovalFromDb),
  }));
}

export async function createApprovalRequest(formData) {
  return runQuery(
    (client) => client.from('approval_requests').insert(formData).select().single(),
    null,
    'Erro ao enviar solicitação de aprovação.',
  );
}

export async function updateApprovalRequest(id, formData) {
  return runQuery(
    (client) => client.from('approval_requests').update(formData).eq('id', id).select().single(),
    null,
    'Erro ao atualizar solicitação.',
  );
}

export async function reviewApprovalRequest(request, decision, reviewerId) {
  return runQuery(
    async (client) => {
      if (decision === 'aprovado' && request.targetTable === 'employees') {
        const employeePayload = { ...(request.payload || {}) };
        delete employeePayload.salary;
        const employeeMutation = request.targetId
          ? await client.from('employees').update(employeePayload).eq('id', request.targetId)
          : await client.from('employees').insert(employeePayload);
        if (employeeMutation.error) return employeeMutation;
      }

      if (decision === 'aprovado' && request.targetTable === 'clients') {
        const clientPayload = { ...(request.payload || {}) };
        delete clientPayload.monthly_value;
        const clientMutation = request.targetId
          ? await client.from('clients').update(clientPayload).eq('id', request.targetId)
          : await client.from('clients').insert(clientPayload);
        if (clientMutation.error) return clientMutation;
      }

      if (decision === 'aprovado' && request.targetTable === 'documents' && request.type === 'excluir_registro') {
        const documentDeletion = await deleteDocument(request.targetId);
        if (documentDeletion.error) return documentDeletion;
      }

      return client
        .from('approval_requests')
        .update({
          status: decision,
          reviewed_by: reviewerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .select()
        .single();
    },
    null,
    decision === 'aprovado' ? 'Erro ao aprovar solicitação.' : 'Erro ao recusar solicitação.',
  );
}
