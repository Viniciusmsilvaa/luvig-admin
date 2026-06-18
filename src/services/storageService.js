import { runQuery } from './serviceHelpers.js';

export async function uploadFile({ bucket, path, file }) {
  return runQuery(
    (client) => client.storage.from(bucket).upload(path, file, { upsert: true }),
    null,
    'Erro ao enviar arquivo.',
  );
}

export async function getSignedUrl({ bucket, path, expiresIn = 3600 }) {
  return runQuery(
    (client) => client.storage.from(bucket).createSignedUrl(path, expiresIn),
    null,
    'Erro ao gerar link do arquivo.',
  );
}

export async function removeFile({ bucket, paths }) {
  return runQuery(
    (client) => client.storage.from(bucket).remove(paths),
    null,
    'Erro ao remover arquivo.',
  );
}
