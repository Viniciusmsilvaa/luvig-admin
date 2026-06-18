export default function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Carregando dados" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="surface-card animate-pulse p-4">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-20 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-36 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => <div key={index} className="surface-card animate-pulse p-5"><div className="h-5 w-44 rounded bg-slate-200" /><div className="mt-5 h-48 rounded-xl bg-slate-100" /></div>)}
      </div>
    </div>
  );
}
