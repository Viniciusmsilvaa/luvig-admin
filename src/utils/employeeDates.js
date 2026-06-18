const DAY_IN_MS = 86400000;

function parseLocalDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plural(value, singular, pluralForm) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export function differenceInDays(value) {
  const target = parseLocalDate(value);
  if (!target) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / DAY_IN_MS);
}

export function formatTenure(admissionDate) {
  const admission = parseLocalDate(admissionDate);
  if (!admission) return 'Data não informada';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (admission > today) return 'Admissão futura';

  let months = (today.getFullYear() - admission.getFullYear()) * 12;
  months += today.getMonth() - admission.getMonth();
  if (today.getDate() < admission.getDate()) months -= 1;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [];

  if (years) parts.push(plural(years, 'ano', 'anos'));
  if (remainingMonths) parts.push(plural(remainingMonths, 'mês', 'meses'));
  return parts.length ? parts.join(' e ') : 'Menos de 1 mês';
}

export function formatVacationCountdown(value) {
  const days = differenceInDays(value);
  if (days === null) return 'Sem data de férias';
  if (days === 0) return 'Férias hoje';
  if (days > 0) return `Férias em ${plural(days, 'dia', 'dias')}`;
  return `Férias vencidas há ${plural(Math.abs(days), 'dia', 'dias')}`;
}

export function formatReturnCountdown(value, prefix = 'Volta') {
  const days = differenceInDays(value);
  if (days === null) return 'Retorno não informado';
  if (days === 0) return `${prefix} hoje`;
  if (days > 0) return `${prefix} em ${plural(days, 'dia', 'dias')}`;
  return `Retorno vencido há ${plural(Math.abs(days), 'dia', 'dias')}`;
}

export function formatNoticeCountdown(value) {
  const days = differenceInDays(value);
  if (days === null) return 'Data final não informada';
  if (days === 0) return 'Termina hoje';
  if (days > 0) return `Faltam ${plural(days, 'dia', 'dias')}`;
  return `Encerrado há ${plural(Math.abs(days), 'dia', 'dias')}`;
}

export function formatDate(value) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString('pt-BR') : 'Não informada';
}
