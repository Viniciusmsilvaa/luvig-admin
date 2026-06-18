import { runQuery } from './serviceHelpers.js';

export async function getEmployeeHistory(employeeId) {
  return runQuery(
    (client) =>
      client
        .from('employee_history')
        .select('*, occurrences(score_impact, status)')
        .eq('employee_id', employeeId)
        .order('history_date', { ascending: false }),
    [],
    'Erro ao carregar histórico.',
  ).then((result) => ({
    ...result,
    data: result.usingFallback
      ? result.data
      : result.data.map((item) => ({
          id: item.id,
          type: item.title || item.type,
          typeValue: item.type,
          date: item.history_date,
          description: item.description || 'Sem descrição.',
          impact: Number(item.occurrences?.score_impact || 0),
          occurrenceId: item.occurrence_id,
        })),
  }));
}
