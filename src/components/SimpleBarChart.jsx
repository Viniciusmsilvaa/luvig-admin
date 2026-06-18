export default function SimpleBarChart({ data = [], series = [{ key: 'value', label: 'Total', color: 'bg-luvig-blue' }], emptyMessage = 'Sem dados para exibir.' }) {
  if (!data.length) return <p className="py-10 text-center text-sm font-semibold text-slate-500">{emptyMessage}</p>;
  const max = Math.max(1, ...data.flatMap((item) => series.map((entry) => Math.abs(Number(item[entry.key] || 0)))));
  return (
    <div>
      <div className="flex h-52 items-end gap-3 overflow-x-auto pb-2" role="img" aria-label="Gráfico de barras">
        {data.map((item) => (
          <div key={item.name} className="flex min-w-14 flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end justify-center gap-1">
              {series.map((entry) => {
                const value = Number(item[entry.key] || 0);
                return <div key={entry.key} className={`w-full max-w-9 rounded-t-lg transition-all ${entry.color}`} style={{ height: `${Math.max(value ? 8 : 2, (Math.abs(value) / max) * 100)}%` }} title={`${entry.label}: ${value.toLocaleString('pt-BR')}`} />;
              })}
            </div>
            <span className="max-w-20 truncate text-center text-[11px] font-bold text-slate-500" title={item.name}>{item.name}</span>
          </div>
        ))}
      </div>
      {series.length > 1 && <div className="mt-3 flex flex-wrap justify-center gap-4">{series.map((entry) => <span key={entry.key} className="flex items-center gap-2 text-xs font-bold text-slate-500"><i className={`h-2.5 w-2.5 rounded-full ${entry.color}`} />{entry.label}</span>)}</div>}
    </div>
  );
}
