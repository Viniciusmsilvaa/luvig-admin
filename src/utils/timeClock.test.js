import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClockDays,
  calculateClockDay,
  DEFAULT_WORK_SCHEDULE,
  formatMinutes,
  getPeriodBounds,
  scheduleForDate,
  summarizeClockDays,
} from './timeClock.js';

const day = '2026-06-18';
const schedule = { ...DEFAULT_WORK_SCHEDULE, valid_from: '2026-01-01' };
const record = (clock_type, time, extra = {}) => ({ id: `${clock_type}-${time}`, clock_type, clock_time: `${day}T${time}:00-03:00`, ...extra });
const complete = (times = ['10:00', '13:00', '14:00', '17:30'], extra = {}) => [
  record('entrada', times[0], extra), record('saida_almoco', times[1]), record('retorno_almoco', times[2]), record('saida', times[3]),
];
const calculate = (records, options = {}) => calculateClockDay(records, schedule, { referenceDate: day, now: `${day}T18:00:00-03:00`, ...options });

test('1. entrada dentro do horário fica regular', () => assert.equal(calculate(complete()).scheduleAlerts.some((item) => item.startsWith('Entrada')), false));
test('2. entrada atrasada gera alerta', () => assert.ok(calculate(complete(['10:10', '13:00', '14:00', '17:30'])).scheduleAlerts.includes('Entrada atrasada')));
test('3. entrada antecipada fora da tolerância gera alerta', () => assert.ok(calculate(complete(['09:50', '13:00', '14:00', '17:30'])).scheduleAlerts.some((item) => item.includes('Entrada antecipada'))));
test('4. saída antecipada gera alerta', () => assert.ok(calculate(complete(['10:00', '13:00', '14:00', '17:20'])).scheduleAlerts.includes('Saída antecipada')));
test('5. saída após o horário gera alerta separado', () => assert.ok(calculate(complete(['10:00', '13:00', '14:00', '17:40'])).scheduleAlerts.includes('Saída após o horário')));
test('6. intervalo de exatamente uma hora é regular', () => assert.equal(calculate(complete()).intervalMinutes, 60));
test('7. intervalo acima da tolerância gera alerta', () => assert.ok(calculate(complete(['10:00', '13:00', '14:10', '17:40'])).scheduleAlerts.includes('Intervalo acima do previsto')));
test('8. jornada oficial soma 390 minutos', () => assert.equal(calculate(complete()).workedMinutes, 390));
test('9. jornada oficial tem saldo zero', () => assert.equal(calculate(complete()).balanceMinutes, 0));
test('10. horas extras ficam positivas', () => assert.equal(calculate(complete(['10:00', '13:00', '14:00', '18:00'])).balanceMinutes, 30));
test('11. horas negativas ficam vermelhas', () => assert.equal(calculate(complete(['10:00', '13:00', '14:00', '17:00'])).journeyTone, 'negative'));
test('12. ponto completo é reconhecido', () => assert.equal(calculate(complete()).complete, true));
test('13. ponto incompleto informa batidas faltantes', () => { const result = calculate([record('entrada', '10:00')], { referenceDate: '2026-06-17' }); assert.ok(result.missingTypes.includes('saida_almoco')); });
test('14. entrada em andamento calcula até agora', () => { const result = calculateClockDay([record('entrada', '10:00')], schedule, { referenceDate: day, now: `${day}T10:47:00-03:00`, isToday: true }); assert.equal(result.workedMinutes, 47); });
test('15. retorno em andamento soma os dois períodos', () => { const records = [record('entrada', '10:00'), record('saida_almoco', '13:00'), record('retorno_almoco', '14:00')]; const result = calculateClockDay(records, schedule, { referenceDate: day, now: `${day}T16:00:00-03:00`, isToday: true }); assert.equal(result.workedMinutes, 300); });
test('16. sequência inválida não inventa duração', () => { const result = calculate([record('entrada', '10:00'), record('saida', '17:30')]); assert.equal(result.workedMinutes, 0); assert.equal(result.invalidSequence, true); });

for (const [index, status] of ['folga', 'atestado', 'ferias', 'feriado', 'outro_justificado'].entries()) {
  test(`${17 + index}. ${status} justificado não gera saldo negativo`, () => { const result = calculate([], { dayStatus: { status } }); assert.equal(result.balanceMinutes, 0); assert.equal(result.incomplete, false); });
}

test('22. feriado trabalhado considera todas as horas extras', () => { const result = calculate(complete(), { holiday: { name: 'Feriado municipal' } }); assert.equal(result.expectedMinutes, 0); assert.equal(result.balanceMinutes, 390); });
test('23. edição é identificada para o indicador amarelo', () => assert.equal(calculate(complete(undefined, { is_edited: true })).edited, true));
test('24. soft delete remove a batida dos cálculos', () => { const records = complete(); records[3].deleted_at = new Date().toISOString(); assert.equal(calculate(records).complete, false); });
test('25. período no dia 2 começa no próprio mês', () => assert.deepEqual(getPeriodBounds('2026-06-02T12:00:00-03:00'), { startDate: '2026-06-02', endDate: '2026-07-01' }));
test('26. período no dia 1 ainda pertence ao mês anterior', () => assert.deepEqual(getPeriodBounds('2026-07-01T12:00:00-03:00'), { startDate: '2026-06-02', endDate: '2026-07-01' }));
test('27. configuração vigente respeita valid_from', () => { const settings = [{ ...schedule, expected_daily_minutes: 360, valid_from: '2026-01-01' }, { ...schedule, expected_daily_minutes: 390, valid_from: '2026-06-01' }]; assert.equal(scheduleForDate(settings, day).expected_daily_minutes, 390); });
test('28. resumo separa extras e negativas', () => { const days = [calculate(complete(['10:00', '13:00', '14:00', '18:00'])), calculate(complete(['10:00', '13:00', '14:00', '17:00']))]; const summary = summarizeClockDays(days); assert.equal(summary.extraMinutes, 30); assert.equal(summary.negativeMinutes, 30); });
test('29. dia útil sem batidas e sem justificativa fica incompleto', () => { const days = buildClockDays({ records: [], settings: [schedule], startDate: '2026-06-17', endDate: '2026-06-17', now: '2026-06-18T12:00:00-03:00', includeEmpty: true }); assert.equal(days[0].incomplete, true); });
test('30. hora extra não esconde irregularidade de horário', () => { const result = calculate(complete(['09:40', '13:00', '14:00', '18:00'])); assert.ok(result.balanceMinutes > 0); assert.ok(result.scheduleAlerts.length > 0); });
test('31. formato mostra horas e minutos', () => assert.equal(formatMinutes(347), '5h 47min'));
test('32. formato de saldo mostra sinal', () => assert.equal(formatMinutes(-20, { signed: true }), '-20min'));
test('40. data anterior ao início do controle não gera negativo', () => {
  const result = calculateClockDay([], schedule, { referenceDate: '2026-06-16', now: '2026-06-18T18:00:00-03:00' });
  assert.equal(result.balanceMinutes, 0);
  assert.equal(result.incomplete, false);
});
test('41. fim de semana não gera negativo', () => {
  const result = calculateClockDay([], schedule, { referenceDate: '2026-06-20', now: '2026-06-22T18:00:00-03:00' });
  assert.equal(result.balanceMinutes, 0);
});
test('42. dia atual antes das 17h30 não fica negativo', () => {
  const result = calculateClockDay([record('entrada', '10:00')], schedule, { referenceDate: day, now: `${day}T12:00:00-03:00`, isToday: true });
  assert.equal(result.balanceMinutes, 0);
  assert.equal(result.provisionalDay, true);
});
test('43. dia atual sem registros fica incompleto somente após 17h30', () => {
  const before = calculateClockDay([], schedule, { referenceDate: day, now: `${day}T17:00:00-03:00`, isToday: true });
  const after = calculateClockDay([], schedule, { referenceDate: day, now: `${day}T18:00:00-03:00`, isToday: true });
  assert.equal(before.incomplete, false);
  assert.equal(after.incomplete, true);
});
test('44. resumo preserva saldo provisório sem recriar negativo', () => {
  const current = calculateClockDay([record('entrada', '10:00')], schedule, { referenceDate: day, now: `${day}T12:00:00-03:00`, isToday: true });
  assert.equal(summarizeClockDays([current]).balanceMinutes, 0);
});
