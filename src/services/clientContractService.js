import { runQuery } from './serviceHelpers.js';

const CONTRACT_BUCKET = 'client-contracts';
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export async function uploadClientContract(file, clientId) {
  if (!file || !clientId) {
    return { data: null, error: 'Selecione um contrato válido.', usingFallback: false };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { data: null, error: 'O contrato deve ter no máximo 15 MB.', usingFallback: false };
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return { data: null, error: 'Envie o contrato em PDF, Word ou imagem.', usingFallback: false };
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const path = `${clientId}/${Date.now()}-${safeName}`;
  const result = await runQuery(
    async (client) => {
      const upload = await client.storage.from(CONTRACT_BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upload.error) return upload;
      const signed = await client.storage.from(CONTRACT_BUCKET).createSignedUrl(upload.data.path, 3600);
      return {
        data: { path: upload.data.path, contract_url: upload.data.path, signedUrl: signed.data?.signedUrl || '' },
        error: signed.error,
      };
    },
    null,
    'Não foi possível enviar o contrato.',
  );

  return result.error ? { ...result, error: 'Não foi possível enviar o contrato.' } : result;
}

export async function getClientContractUrl(path, expiresIn = 3600) {
  if (!path) return { data: { signedUrl: '' }, error: null, usingFallback: false };
  if (path.startsWith('http')) return { data: { signedUrl: path }, error: null, usingFallback: false };
  return runQuery(
    (client) => client.storage.from(CONTRACT_BUCKET).createSignedUrl(path, expiresIn),
    { signedUrl: '' },
    'Não foi possível abrir o contrato.',
  );
}
