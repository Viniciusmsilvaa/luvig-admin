export default function StatCard({ icon: Icon, label, value, detail, tone = 'blue' }) {
  const tones = {
    blue: 'bg-luvig-light text-luvig-blue',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-700',
    cyan: 'bg-cyan-100 text-cyan-700',
    orange: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-luvig-ink">{value}</p>
        </div>
        {Icon && (
          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {detail && <p className="mt-3 text-xs font-semibold text-slate-500">{detail}</p>}
    </div>
  );
}
