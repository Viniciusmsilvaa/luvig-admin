import { CalendarDays, Clock3, TimerReset, TrendingUp, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getScoreTheme } from '../utils/scoreColors.js';
import StatusBadge from './StatusBadge.jsx';

export default function EmployeeCard({ employee }) {
  const theme = getScoreTheme(employee.score);
  const inactiveClass = employee.isInactive ? 'grayscale-[35%] opacity-80' : '';

  return (
    <article className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${theme.card} ${inactiveClass}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-luvig-ink text-xl font-black text-white shadow-lg shadow-slate-900/10">
          {employee.photoUrl ? (
            <img className="h-full w-full object-cover" src={employee.photoUrl} alt={`Foto de ${employee.name}`} />
          ) : (
            employee.avatar
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-luvig-ink">{employee.name}</h3>
              <p className="text-sm font-semibold text-slate-500">{employee.role}</p>
            </div>
            <StatusBadge status={employee.status} />
          </div>

          <div className="mt-4 grid gap-3 text-sm lg:grid-cols-[1.15fr,0.85fr]">
            <div className="rounded-xl bg-white/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase text-slate-500">Nota atual</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${theme.badge}`}>{theme.label}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className={`text-3xl font-black ${theme.text}`}>{employee.score.toFixed(1)}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${employee.score * 10}%` }} />
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <TrendingUp className="h-3.5 w-3.5" />
                {employee.scoreTrend === 'Melhorando' ? '↑' : employee.scoreTrend === 'Piorando' ? '↓' : '→'} {employee.scoreTrend}
              </p>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                <Clock3 className="h-4 w-4" /> Tempo de casa
              </div>
              <p className="font-black text-luvig-ink">{employee.tenure}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <Info icon={CalendarDays} label="Próximas férias" value={employee.nextVacation} />
            <Info icon={UserRoundCheck} label="Última ocorrência" value={employee.lastOccurrence} />
            {employee.specialStatus && <Info icon={TimerReset} label="Situação atual" value={employee.specialStatus} />}
            <Info
              icon={TimerReset}
              label="Nota atualizada"
              value={employee.scoreUpdatedAt ? new Date(employee.scoreUpdatedAt).toLocaleDateString('pt-BR') : 'Sem atualização'}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="secondary-button" to={`/funcionarios/${employee.id}`}>
              Ver perfil
            </Link>
            <Link className="quiet-button" to={`/funcionarios/${employee.id}/editar`}>
              Editar
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <p className="flex min-h-10 items-center gap-2 rounded-xl bg-white/65 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-luvig-blue" />
      <span className="min-w-0">
        <span className="font-semibold text-slate-500">{label}: </span>
        <strong className="text-luvig-ink">{value}</strong>
      </span>
    </p>
  );
}
