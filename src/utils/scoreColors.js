export function getScoreTheme(score) {
  if (score >= 9) {
    return {
      card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white',
      badge: 'bg-emerald-100 text-emerald-700',
      bar: 'bg-emerald-500',
      text: 'text-emerald-700',
      label: 'Excelente',
    };
  }

  if (score >= 7) {
    return {
      card: 'border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50',
      badge: 'bg-cyan-100 text-cyan-700',
      bar: 'bg-cyan-500',
      text: 'text-cyan-700',
      label: 'Bom',
    };
  }

  if (score >= 5) {
    return {
      card: 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white',
      badge: 'bg-amber-100 text-amber-700',
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      label: 'Atenção',
    };
  }

  if (score >= 3) {
    return {
      card: 'border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white',
      badge: 'bg-orange-100 text-orange-700',
      bar: 'bg-orange-500',
      text: 'text-orange-700',
      label: 'Risco',
    };
  }

  return {
    card: 'border-red-200 bg-gradient-to-br from-red-50 via-white to-white',
    badge: 'bg-red-100 text-red-700',
    bar: 'bg-red-500',
    text: 'text-red-700',
    label: 'Crítico',
  };
}
