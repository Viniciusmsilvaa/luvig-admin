import { runQuery } from './serviceHelpers.js';

export async function recalculateEmployeeScore(employeeId) {
  return runQuery(
    (client) => client.rpc('recalculate_employee_score', { target_employee_id: employeeId }),
    null,
    'Erro ao recalcular nota.',
  );
}

export function getScoreTrend(occurrences = []) {
  const confirmed = occurrences
    .filter((item) => item.statusValue === 'confirmado')
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
  const recentImpact = confirmed[0]?.impact || 0;
  if (recentImpact > 0) return 'Melhorando';
  if (recentImpact < 0) return 'Piorando';
  return 'Estável';
}
