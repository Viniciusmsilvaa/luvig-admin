export default function StatusBadge({ status }) {
  const normalized = status?.toLocaleLowerCase('pt-BR') ?? '';
  let color = 'bg-slate-100 text-slate-700';

  if (normalized.includes('recusado') || normalized.includes('inativo') || normalized.includes('desligado') || normalized.includes('atrasado') || normalized.includes('em atraso')) {
    color = 'bg-red-100 text-red-700';
  } else if (normalized.includes('atestado') || normalized.includes('férias') || normalized.includes('aviso')) {
    color = 'bg-cyan-100 text-cyan-700';
  } else if (
    normalized.includes('pendente') ||
    normalized.includes('aguardando') ||
    normalized.includes('revisão') ||
    normalized.includes('programado') ||
    normalized.includes('aberta')
  ) {
    color = 'bg-amber-100 text-amber-700';
  } else if (
    normalized === 'ativo' ||
    normalized.includes('pago') ||
    normalized.includes('confirmado') ||
    normalized.includes('aprovado')
  ) {
    color = 'bg-emerald-100 text-emerald-700';
  }

  return <span className={`badge-base ${color}`}>{status}</span>;
}
