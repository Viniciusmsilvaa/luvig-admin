import { runQuery } from './serviceHelpers.js';

const statusLabels = { ativo: 'Ativo', programado: 'Programado', encerrado: 'Encerrado' };

function mapNotice(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message || '',
    audience: row.audience || 'Todos',
    publishDate: row.publish_date,
    expiresAt: row.expires_at,
    status: statusLabels[row.status] || row.status,
    statusValue: row.status,
  };
}

export async function listNotices() {
  return runQuery(
    (client) => client.from('notices').select('*').order('publish_date', { ascending: false }),
    [],
    'Falha ao carregar avisos.',
  ).then((result) => ({ ...result, data: (result.data || []).map(mapNotice) }));
}

export async function createNotice(data) {
  return runQuery(
    (client) => client.from('notices').insert(data).select().single(),
    null,
    'Falha ao salvar aviso.',
  ).then((result) => ({ ...result, data: result.data ? mapNotice(result.data) : null }));
}
