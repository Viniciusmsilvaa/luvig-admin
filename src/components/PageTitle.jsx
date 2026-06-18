export default function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-black text-luvig-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
