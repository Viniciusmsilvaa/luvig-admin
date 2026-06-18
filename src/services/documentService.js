import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { getFriendlyError } from './serviceHelpers.js';

export const documentTypeOptions = [
  { value: 'atestado', label: 'Atestado' },
  { value: 'advertencia', label: 'Advertência' },
  { value: 'suspensao', label: 'Suspensão' },
  { value: 'contrato', label: 'Contrato de funcionário' },
  { value: 'rescisao', label: 'Rescisão' },
  { value: 'documento_pessoal', label: 'Documento pessoal' },
  { value: 'contrato_condominio', label: 'Contrato de condomínio' },
  { value: 'outro', label: 'Outro' },
];

export const documentStatusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'arquivado', label: 'Arquivado' },
];

const typeLabels = Object.fromEntries(documentTypeOptions.map(({ value, label }) => [value, label]));
const statusLabels = Object.fromEntries(documentStatusOptions.map(({ value, label }) => [value, label]));
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function unavailable(message) {
  return { data: null, error: message, usingFallback: false };
}

function parseFileReference(reference = '') {
  if (reference.startsWith('http')) return { bucket: '', path: reference, external: true };
  const separator = reference.indexOf(':');
  if (separator > 0) return { bucket: reference.slice(0, separator), path: reference.slice(separator + 1), external: false };
  return { bucket: 'documents', path: reference, external: false };
}

async function signedUrl(reference, download = false) {
  if (!reference) return '';
  const file = parseFileReference(reference);
  if (file.external) return file.path;
  const options = download ? { download: file.path.split('/').pop() } : undefined;
  const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.path, 3600, options);
  return error ? '' : data?.signedUrl || '';
}

async function mapDocument(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name || '',
    clientId: row.client_id,
    clientName: row.clients?.name || '',
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploader?.full_name || 'Usuário',
    typeValue: row.type,
    type: typeLabels[row.type] || row.type,
    title: row.title || typeLabels[row.type] || 'Documento',
    fileReference: row.file_url,
    viewUrl: await signedUrl(row.file_url),
    statusValue: row.status,
    status: statusLabels[row.status] || row.status,
    createdAt: row.created_at,
  };
}

function baseQuery() {
  return supabase
    .from('documents')
    .select('*, employees(full_name), clients(name), uploader:profiles!documents_uploaded_by_fkey(full_name)');
}

export async function getDocuments(filters = {}) {
  if (!isSupabaseConfigured || !supabase) return unavailable('Erro ao carregar documentos.');
  try {
    let query = baseQuery().order('created_at', { ascending: false });
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.clientId) query = query.eq('client_id', filters.clientId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
    if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
    const result = await query;
    if (result.error) throw result.error;
    let data = await Promise.all((result.data || []).map(mapDocument));
    const search = filters.search?.trim().toLocaleLowerCase('pt-BR');
    if (search) data = data.filter((item) => `${item.title} ${item.type} ${item.employeeName} ${item.clientName}`.toLocaleLowerCase('pt-BR').includes(search));
    return { data, error: null, usingFallback: false };
  } catch (error) {
    return { data: [], error: getFriendlyError(error, 'Erro ao carregar documentos.'), usingFallback: false };
  }
}

export async function getDocumentById(id) {
  if (!isSupabaseConfigured || !supabase) return unavailable('Documento não encontrado.');
  try {
    const result = await baseQuery().eq('id', id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return unavailable('Documento não encontrado.');
    return { data: await mapDocument(result.data), error: null, usingFallback: false };
  } catch (error) {
    return unavailable(getFriendlyError(error, 'Documento não encontrado.'));
  }
}

export function getEmployeeDocuments(employeeId) {
  return getDocuments({ employeeId });
}

export function getClientDocuments(clientId) {
  return getDocuments({ clientId });
}

export async function getDocumentOptions() {
  if (!isSupabaseConfigured || !supabase) return { data: { employees: [], clients: [] }, error: 'Erro ao carregar opções.', usingFallback: false };
  try {
    const [employeeResult, clientResult] = await Promise.all([
      supabase.from('employees').select('id, full_name').order('full_name'),
      supabase.from('clients').select('id, name').order('name'),
    ]);
    if (employeeResult.error) throw employeeResult.error;
    if (clientResult.error) throw clientResult.error;
    return {
      data: {
        employees: (employeeResult.data || []).map((item) => ({ id: item.id, name: item.full_name })),
        clients: (clientResult.data || []).map((item) => ({ id: item.id, name: item.name })),
      },
      error: null,
      usingFallback: false,
    };
  } catch (error) {
    return { data: { employees: [], clients: [] }, error: getFriendlyError(error, 'Erro ao carregar opções.'), usingFallback: false };
  }
}

function safeName(name = 'arquivo') {
  return name.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]/g, '-');
}

export async function uploadDocument({ file, type, employeeId, clientId, title, observation, uploadedBy }) {
  if (!isSupabaseConfigured || !supabase) return unavailable('Erro ao enviar documento.');
  if (!file) return unavailable('Selecione um arquivo.');
  if (file.size > MAX_FILE_SIZE) return unavailable('O arquivo deve ter no máximo 20 MB.');
  const bucket = clientId && ['contrato', 'contrato_condominio'].includes(type) ? 'client-contracts' : 'documents';
  const folder = employeeId ? `employees/${employeeId}` : clientId ? `clients/${clientId}` : 'administration';
  const path = `${folder}/${Date.now()}-${safeName(file.name)}`;

  try {
    const upload = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
      metadata: observation ? { observation } : undefined,
    });
    if (upload.error) throw upload.error;
    const insert = await supabase.from('documents').insert({
      employee_id: employeeId || null,
      client_id: clientId || null,
      uploaded_by: uploadedBy,
      type,
      title: title || file.name,
      file_url: `${bucket}:${upload.data.path}`,
      status: 'ativo',
    }).select().single();
    if (insert.error) throw insert.error;
    const detail = await getDocumentById(insert.data.id);
    return detail.error ? { data: insert.data, error: null, usingFallback: false } : detail;
  } catch (error) {
    return unavailable(getFriendlyError(error, 'Erro ao enviar documento.'));
  }
}

export async function updateDocument(id, data) {
  if (!isSupabaseConfigured || !supabase) return unavailable('Erro ao atualizar documento.');
  try {
    const result = await supabase.from('documents').update({ title: data.title, status: data.status }).eq('id', id).select().single();
    if (result.error) throw result.error;
    return getDocumentById(id);
  } catch (error) {
    return unavailable(getFriendlyError(error, 'Erro ao atualizar documento.'));
  }
}

export async function deleteDocument(id) {
  const detail = await getDocumentById(id);
  if (detail.error || !detail.data) return unavailable(detail.error || 'Documento não encontrado.');
  try {
    const result = await supabase.from('documents').delete().eq('id', id);
    if (result.error) throw result.error;
    const file = parseFileReference(detail.data.fileReference);
    if (!file.external) await supabase.storage.from(file.bucket).remove([file.path]);
    return { data: true, error: null, usingFallback: false };
  } catch (error) {
    return unavailable(getFriendlyError(error, 'Erro ao excluir documento.'));
  }
}

export async function getDocumentDownloadUrl(document) {
  if (!supabase || !document?.fileReference) return unavailable('Erro ao baixar documento.');
  const url = await signedUrl(document.fileReference, true);
  return url ? { data: url, error: null, usingFallback: false } : unavailable('Erro ao baixar documento.');
}

export async function createDocumentFromOccurrence({ occurrence, attachmentPath, attachmentFile, uploadedBy }) {
  if (!attachmentPath || !occurrence || !supabase) return unavailable('Erro ao vincular anexo à Central de Documentos.');
  try {
    const occurrenceType = occurrence.typeValue || occurrence.type;
    const insert = await supabase.from('documents').insert({
      employee_id: occurrence.employeeId || null,
      client_id: occurrence.clientId || null,
      uploaded_by: uploadedBy,
      type: ['atestado', 'advertencia', 'suspensao'].includes(occurrenceType) ? occurrenceType : 'outro',
      title: occurrence.title || attachmentFile?.name || 'Anexo de ocorrência',
      file_url: `documents:${attachmentPath}`,
      status: 'ativo',
    }).select().single();
    if (insert.error) throw insert.error;
    return { data: insert.data, error: null, usingFallback: false };
  } catch (error) {
    return unavailable(getFriendlyError(error, 'Erro ao vincular anexo à Central de Documentos.'));
  }
}

export function subscribeDocuments(onChange) {
  if (!supabase || typeof onChange !== 'function') return () => {};
  const channel = supabase.channel(`documents-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, onChange).subscribe();
  return () => supabase.removeChannel(channel);
}
