import { Filter, RotateCcw } from 'lucide-react';

export const initialReportFilters = { dateFrom: '', dateTo: '', employeeId: '', clientId: '', status: '', type: '', role: '' };
const statusOptions = [
  ['ativo', 'Ativo'], ['ferias', 'Férias'], ['atestado', 'Atestado'], ['aviso_previo', 'Aviso prévio'], ['inativo', 'Inativo'], ['desligado', 'Desligado'],
  ['aguardando_conferencia', 'Aguardando conferência'], ['recomendado_pelo_rh', 'Recomendado pelo RH'], ['confirmado', 'Confirmado'], ['recusado', 'Recusado'],
  ['pendente', 'Pendente'], ['em_analise', 'Em análise'], ['aprovado', 'Aprovado'], ['pago', 'Pago'], ['atrasado', 'Atrasado'],
];
const typeOptions = [
  ['falta', 'Falta'], ['atraso', 'Atraso'], ['atestado', 'Atestado'], ['advertencia', 'Advertência'], ['suspensao', 'Suspensão'], ['elogio', 'Elogio'],
  ['hora_extra', 'Hora extra'], ['hora_faltante', 'Hora faltante'], ['ferias', 'Férias'], ['aviso_previo', 'Aviso prévio'], ['demissao', 'Demissão'], ['ocorrencia_geral', 'Ocorrência geral'],
];

export default function GlobalReportFilters({ value, onChange, options = { employees: [], clients: [] }, show = {} }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const roles = [...new Set(options.employees.map((item) => item.role).filter(Boolean))].sort();
  return (
    <section className="surface-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black text-luvig-ink"><Filter className="h-4 w-4 text-luvig-blue" />Filtros</h2>
        <button type="button" onClick={() => onChange(initialReportFilters)} className="quiet-button min-h-9 px-3 py-1.5"><RotateCcw className="h-4 w-4" />Limpar</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Field label="Período inicial"><input className="input-base min-h-11" type="date" value={value.dateFrom} onChange={set('dateFrom')} /></Field>
        <Field label="Período final"><input className="input-base min-h-11" type="date" value={value.dateTo} onChange={set('dateTo')} /></Field>
        {show.employee && <Field label="Funcionário"><select className="input-base min-h-11" value={value.employeeId} onChange={set('employeeId')}><option value="">Todos</option>{options.employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
        {show.client && <Field label="Cliente"><select className="input-base min-h-11" value={value.clientId} onChange={set('clientId')}><option value="">Todos</option>{options.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
        {show.status && <Field label="Status"><select className="input-base min-h-11" value={value.status} onChange={set('status')}><option value="">Todos</option>{statusOptions.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></Field>}
        {show.type && <Field label="Tipo"><select className="input-base min-h-11" value={value.type} onChange={set('type')}><option value="">Todos</option>{typeOptions.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></Field>}
        {show.role && <Field label="Função"><select className="input-base min-h-11" value={value.role} onChange={set('role')}><option value="">Todas</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></Field>}
      </div>
    </section>
  );
}

function Field({ label, children }) { return <label><span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>{children}</label>; }
