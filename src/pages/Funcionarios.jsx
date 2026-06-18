import { Filter, Plus, Search, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import EmployeeCard from '../components/EmployeeCard.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { employeeStatusOptions, getEmployees } from '../services/employeeService.js';

const filters = [{ value: 'todos', label: 'Todos' }, ...employeeStatusOptions];

export default function Funcionarios() {
  const { can, isRH } = useAuth();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getEmployees();
    setEmployees(result.data || []);
    setError(result.error || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return employees.filter((employee) => {
      const searchable = `${employee.name} ${employee.role}`.toLocaleLowerCase('pt-BR');
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesFilter = filter === 'todos' || employee.statusValue === filter;
      return matchesQuery && matchesFilter;
    });
  }, [employees, filter, query]);

  return (
    <div className="page-shell">
      <PageTitle
        title="Funcionários"
        subtitle="Cadastro visual com notas, status, próximos eventos e histórico administrativo."
        actions={
          can('employees:create') ? (
            <Link className="primary-button" to="/funcionarios/novo">
              <Plus className="h-5 w-5" />
              Adicionar funcionário
            </Link>
          ) : null
        }
      />

      {location.state?.notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {location.state.notice}
        </div>
      )}

      {isRH && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Alterações feitas pelo RH são enviadas para aprovação do administrativo antes de serem aplicadas.
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-luvig-blue">
          Carregando funcionários...
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button className="secondary-button" type="button" onClick={loadEmployees}>Tentar novamente</button>
        </div>
      )}

      <section className="surface-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="input-base pl-12"
              placeholder="Pesquisar por nome ou função"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.value}
                className={`touch-button whitespace-nowrap border ${
                  filter === item.value
                    ? 'border-luvig-blue bg-luvig-blue text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-luvig-sky'
                }`}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                <Filter className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!loading && filteredEmployees.length === 0 ? (
        <section className="surface-card flex min-h-56 flex-col items-center justify-center p-6 text-center">
          <UsersRound className="h-10 w-10 text-slate-400" />
          <h2 className="mt-3 text-lg font-black text-luvig-ink">Nenhum funcionário encontrado</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {employees.length ? 'Ajuste a pesquisa ou o filtro de status.' : 'Cadastre o primeiro funcionário para começar.'}
          </p>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredEmployees.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} />
          ))}
        </section>
      )}
    </div>
  );
}
