import { getClientContractUrl } from './clientContractService.js';
import { runQuery, toNumber } from './serviceHelpers.js';

export const clientStatusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'encerrado', label: 'Encerrado' },
];

export const contractedServiceOptions = [
  'Limpeza predial',
  'Zeladoria',
  'Piscina',
  'Jardinagem',
  'Corte de grama',
  'Limpeza de garagem',
  'Limpeza de vidros',
  'Caixa d’água',
  'Calhas',
  'Serviços extras',
  'Pequenas manutenções',
  'Outros',
];

const statusLabels = Object.fromEntries(clientStatusOptions.map(({ value, label }) => [value, label]));
const statusValues = Object.fromEntries(clientStatusOptions.map(({ value, label }) => [label, value]));

function normalizeServices(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function mapClientFromDb(row) {
  const servicesArray = normalizeServices(row.contracted_services);
  return {
    id: row.id,
    name: row.name,
    manager: row.responsible_name || '',
    phone: row.phone || '',
    neighborhood: row.neighborhood || '',
    address: row.address || '',
    monthlyValue: row.monthly_value === null || row.monthly_value === undefined ? null : toNumber(row.monthly_value),
    status: statusLabels[row.status] || row.status || 'Ativo',
    statusValue: row.status || 'ativo',
    dueDay: row.due_day || '',
    servicesArray,
    services: servicesArray.join(', '),
    contractPath: row.contract_url || '',
    contractUrl: row._signed_contract_url || (row.contract_url?.startsWith('http') ? row.contract_url : ''),
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isInactive: ['inativo', 'encerrado'].includes(row.status),
  };
}

function addField(target, key, value, transform = (item) => item) {
  if (value === undefined) return;
  target[key] = value === '' ? null : transform(value);
}

export function serializeClientData(formData) {
  const data = formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData;
  const payload = {};
  addField(payload, 'name', data.name);
  addField(payload, 'responsible_name', data.responsible_name ?? data.manager);
  addField(payload, 'phone', data.phone);
  addField(payload, 'address', data.address);
  addField(payload, 'neighborhood', data.neighborhood);
  addField(payload, 'monthly_value', data.monthly_value ?? data.monthlyValue, Number);
  addField(payload, 'due_day', data.due_day ?? data.dueDay, Number);
  addField(payload, 'contracted_services', data.contracted_services ?? data.servicesArray, normalizeServices);
  addField(payload, 'status', statusValues[data.status] || data.status);
  addField(payload, 'notes', data.notes);
  addField(payload, 'contract_url', data.contract_url ?? data.contractPath);
  return payload;
}

export async function getClients() {
  return runQuery(
    (client) => client.rpc('list_clients_secure', { target_client_id: null }),
    [],
    'Erro ao carregar clientes.',
  ).then((result) => ({
    ...result,
    data: (result.data || []).map(mapClientFromDb),
  }));
}

export const listClients = getClients;

export async function getClientOptions() {
  return runQuery(
    (client) => client.rpc('list_client_options'),
    [],
    'Erro ao carregar opções de condomínios.',
  );
}

export async function getClientById(id) {
  const result = await runQuery(
    async (client) => {
      const result = await client.rpc('list_clients_secure', { target_client_id: id });
      return { data: result.data?.[0] || null, error: result.error };
    },
    null,
    'Erro ao carregar cliente.',
  );
  if (!result.data) return result;
  const contractResult = await getClientContractUrl(result.data.contract_url);
  return {
    ...result,
    contractError: contractResult.error,
    data: mapClientFromDb({ ...result.data, _signed_contract_url: contractResult.data?.signedUrl || '' }),
  };
}

export const getClient = getClientById;

export async function createClient(data) {
  const result = await runQuery(
    (client) => client.from('clients').insert(serializeClientData(data)).select('id').single(),
    null,
    'Erro ao salvar condomínio.',
  );
  return result.data?.id ? getClientById(result.data.id) : result;
}

export const createClientRecord = createClient;

export async function updateClient(id, data) {
  const payload = { ...serializeClientData(data), updated_at: new Date().toISOString() };
  const result = await runQuery(
    (client) => client.from('clients').update(payload).eq('id', id).select('id').single(),
    null,
    'Erro ao atualizar condomínio.',
  );
  return result.data?.id ? getClientById(result.data.id) : result;
}

export const updateClientRecord = updateClient;

export function inactivateClient(id) {
  return updateClient(id, { status: 'inativo' });
}

export function reactivateClient(id) {
  return updateClient(id, { status: 'ativo' });
}
