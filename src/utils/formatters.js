export const currencyBRL = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const shortDate = (value) => {
  if (!value) return 'A definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'A definir';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};
