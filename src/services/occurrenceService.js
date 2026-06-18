import { runQuery, toNumber } from './serviceHelpers.js';

const ATTACHMENT_BUCKET = 'documents';

export const occurrenceTypeOptions = [
  { value: 'falta', label: 'Falta' },
  { value: 'atraso', label: 'Atraso' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'advertencia', label: 'Advertência' },
  { value: 'suspensao', label: 'Suspensão' },
  { value: 'elogio', label: 'Elogio' },
  { value: 'deslize', label: 'Deslize' },
  { value: 'hora_extra', label: 'Hora extra' },
  { value: 'hora_faltante', label: 'Hora faltante' },
  { value: 'ferias', label: 'Férias' },
  { value: 'aviso_previo', label: 'Aviso prévio' },
  { value: 'demissao', label: 'Demissão' },
  { value: 'observacao', label: 'Observação' },
  { value: 'predio_sujo', label: 'Prédio sujo' },
  { value: 'servico_nao_realizado', label: 'Serviço não realizado' },
  { value: 'reclamacao_sindico', label: 'Reclamação do síndico' },
  { value: 'solicitacao_sindico', label: 'Solicitação do síndico' },
  { value: 'problema_condominio', label: 'Problema em condomínio' },
  { value: 'pedido_material', label: 'Pedido de material' },
  { value: 'ocorrencia_geral', label: 'Ocorrência geral' },
];

export const scoreRuleOptions = [
  { value: 'sem_impacto', label: 'Sem impacto', type: null, impact: 0 },
  { value: 'elogio', label: 'Elogio (+0,10)', type: 'elogio', impact: 0.1 },
  { value: 'elogio_importante', label: 'Elogio importante (+0,20)', type: 'elogio', impact: 0.2 },
  { value: 'hora_extra', label: 'Hora extra (+0,05)', type: 'hora_extra', impact: 0.05 },
  { value: 'atraso', label: 'Atraso (-0,05)', type: 'atraso', impact: -0.05 },
  { value: 'atraso_recorrente', label: 'Atraso recorrente (-0,10)', type: 'atraso', impact: -0.1 },
  { value: 'hora_faltante', label: 'Hora faltante (-0,10)', type: 'hora_faltante', impact: -0.1 },
  { value: 'falta_justificada', label: 'Falta justificada (-0,10)', type: 'falta', impact: -0.1 },
  { value: 'falta_injustificada', label: 'Falta injustificada (-0,50)', type: 'falta', impact: -0.5 },
  { value: 'deslize', label: 'Deslize (-0,15)', type: 'deslize', impact: -0.15 },
  { value: 'reclamacao_confirmada', label: 'Reclamação confirmada (-0,25)', type: 'reclamacao_sindico', impact: -0.25 },
  { value: 'advertencia', label: 'Advertência (-0,75)', type: 'advertencia', impact: -0.75 },
  { value: 'suspensao', label: 'Suspensão (-1,50)', type: 'suspensao', impact: -1.5 },
  { value: 'demissao', label: 'Demissão (zera nota)', type: 'demissao', impact: -10 },
];

const typeLabels = Object.fromEntries(occurrenceTypeOptions.map(({ value, label }) => [value, label]));
const statusLabels = {
  aguardando_conferencia: 'Aguardando conferência',
  recomendado_pelo_rh: 'Recomendado pelo RH',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
};

async function signedAttachmentUrl(client, path) {
  if (!path || path.startsWith('http')) return path || '';
  const { data, error } = await client.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 3600);
  return error ? '' : data?.signedUrl || '';
}

export function mapOccurrenceFromDb(row) {
  return {
    id: row.id,
    employee: row.employees?.full_name || 'Sem funcionário vinculado',
    employeeId: row.employee_id,
    client: row.clients?.name || '',
    clientId: row.client_id,
    type: typeLabels[row.type] || row.type,
    typeValue: row.type,
    title: row.title || typeLabels[row.type] || 'Ocorrência',
    date: row.occurrence_date,
    status: statusLabels[row.status] || row.status,
    statusValue: row.status,
    impact: toNumber(row.score_impact, 0),
    source: row.source,
    description: row.description || '',
    attachmentPath: row.attachment_url || '',
    attachmentUrl: row._signed_attachment_url || (row.attachment_url?.startsWith('http') ? row.attachment_url : ''),
    createdBy: row.created_by,
    createdByName: row.created_by_profile?.full_name || (row.source === 'lider' ? 'Liderança' : row.source === 'rh' ? 'RH' : 'Admin'),
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getScoreRule(ruleValue) {
  return scoreRuleOptions.find((rule) => rule.value === ruleValue) || scoreRuleOptions[0];
}

function serializeOccurrenceData(formData) {
  const data = formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData;
  const rule = getScoreRule(data.score_rule);
  const type = rule.type || data.type;
  const explicitImpact = data.score_impact === '' || data.score_impact === undefined ? null : toNumber(data.score_impact);

  return {
    employee_id: data.employee_id || null,
    client_id: data.client_id || null,
    created_by: data.created_by,
    type,
    title: data.title || (rule.value !== 'sem_impacto' ? rule.label.replace(/ \(.+\)$/, '') : typeLabels[type]),
    description: data.description,
    occurrence_date: data.occurrence_date,
    status: data.status || 'aguardando_conferencia',
    score_impact: explicitImpact ?? rule.impact,
    attachment_url: data.attachment_url || null,
    source: data.source,
  };
}

async function enrichAttachments(client, rows) {
  return Promise.all(rows.map(async (row) => ({
    ...row,
    _signed_attachment_url: await signedAttachmentUrl(client, row.attachment_url),
  })));
}

export async function listOccurrences(filters = {}) {
  return runQuery(
    async (client) => {
      let query = client
        .from('occurrences')
        .select('*, employees(full_name), clients(name), created_by_profile:profiles!occurrences_created_by_fkey(full_name)')
        .order('occurrence_date', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.dateFrom) query = query.gte('occurrence_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('occurrence_date', filters.dateTo);

      const result = await query;
      if (result.error) return result;
      return { data: await enrichAttachments(client, result.data || []), error: null };
    },
    [],
    'Erro ao carregar ocorrências.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map(mapOccurrenceFromDb),
  }));
}

export async function createOccurrence(formData) {
  const payload = serializeOccurrenceData(formData);
  const requestedStatus = payload.status;
  if (requestedStatus === 'confirmado') payload.status = 'aguardando_conferencia';

  const result = await runQuery(
    (client) => client.from('occurrences').insert(payload).select().single(),
    null,
    'Erro ao salvar ocorrência.',
  );

  if (result.error || !result.data) return result;

  if (requestedStatus === 'confirmado') {
    const review = await reviewOccurrence(result.data.id, 'confirmado', formData.created_by);
    if (review.error) return review;
  }

  return { ...result, data: mapOccurrenceFromDb(result.data) };
}

export async function updateOccurrence(id, formData) {
  const payload = serializeOccurrenceData(formData);
  delete payload.created_by;
  payload.updated_at = new Date().toISOString();
  const result = await runQuery(
    (client) => client.from('occurrences').update(payload).eq('id', id).select().single(),
    null,
    'Erro ao atualizar ocorrência.',
  );
  return result.data && !result.usingFallback ? { ...result, data: mapOccurrenceFromDb(result.data) } : result;
}

export async function reviewOccurrence(occurrenceId, decision, reviewerId) {
  return runQuery(
    (client) => client.rpc('review_occurrence', {
      target_occurrence_id: occurrenceId,
      decision,
      reviewer_id: reviewerId,
    }),
    null,
    decision === 'confirmado' ? 'Erro ao aprovar ocorrência.' : 'Erro ao recusar ocorrência.',
  );
}

export function confirmOccurrence(occurrenceId, reviewerId) {
  return reviewOccurrence(occurrenceId, 'confirmado', reviewerId);
}

export function rejectOccurrence(occurrenceId, reviewerId) {
  return reviewOccurrence(occurrenceId, 'recusado', reviewerId);
}

export async function recommendOccurrence(occurrenceId) {
  return runQuery(
    (client) => client.rpc('recommend_occurrence', { target_occurrence_id: occurrenceId }),
    null,
    'Erro ao recomendar ocorrência.',
  );
}

export async function uploadOccurrenceAttachment(file, occurrenceId) {
  if (!file || !occurrenceId) return { data: null, error: 'Selecione um anexo válido.', usingFallback: false };
  if (file.size > 10 * 1024 * 1024) return { data: null, error: 'O anexo deve ter no máximo 10 MB.', usingFallback: false };

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const path = `occurrences/${occurrenceId}/${Date.now()}-${safeName}`;
  const result = await runQuery(
    async (client) => {
      const upload = await client.storage.from(ATTACHMENT_BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upload.error) return upload;
      return { data: { path: upload.data.path, signedUrl: await signedAttachmentUrl(client, upload.data.path) }, error: null };
    },
    null,
    'Não foi possível salvar o anexo.',
  );
  return result.error ? { ...result, error: 'Não foi possível salvar o anexo.' } : result;
}

export async function setOccurrenceAttachment(occurrenceId, attachmentPath) {
  return runQuery(
    (client) =>
      client
        .from('occurrences')
        .update({ attachment_url: attachmentPath, updated_at: new Date().toISOString() })
        .eq('id', occurrenceId),
    null,
    'Erro ao vincular anexo à ocorrência.',
  );
}
