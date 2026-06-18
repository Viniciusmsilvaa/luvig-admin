import { CheckCircle2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getEmployeeOptions } from '../services/employeeService.js';
import { createOccurrence } from '../services/occurrenceService.js';

export default function LiderancaFuncionario() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState({ loading: true, saving: false, message: '', error: '' });

  useEffect(() => {
    let active = true;

    async function loadEmployees() {
      const result = await getEmployeeOptions();
      if (!active) return;
      setEmployees(result.data ?? []);
      setStatus((current) => ({ ...current, loading: false, error: result.error ?? '' }));
    }

    loadEmployees();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, message: '', error: '' }));
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await createOccurrence({
      ...formData,
      created_by: profile?.id,
      source: 'lider',
      status: 'aguardando_conferencia',
      title: 'Registro da liderança',
      score_rule: formData.type === 'falta' ? 'falta_justificada' : formData.type,
    });

    setStatus((current) => ({
      ...current,
      saving: false,
      error: result.error ?? '',
      message: result.error ? '' : 'Registro enviado para conferência do RH/Admin.',
    }));
  }

  return (
    <div className="page-shell max-w-3xl">
      <PageTitle title="Ocorrência de funcionário" subtitle="Registro enviado para conferência do RH/Admin." />
      {status.message && <SuccessMessage message={status.message} />}
      {status.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{status.error}</div>}
      <form className="surface-card grid gap-4 p-5" onSubmit={handleSubmit}>
        <FormInput label="Funcionário" name="employee_id" as="select" options={employees.map((employee) => ({ label: employee.name, value: employee.id }))} />
        <FormInput
          label="Tipo"
          name="type"
          as="select"
          options={[
            { label: 'Atrasou', value: 'atraso' },
            { label: 'Faltou', value: 'falta' },
            { label: 'Não veio', value: 'falta' },
            { label: 'Saiu mais cedo', value: 'hora_faltante' },
            { label: 'Mau comportamento', value: 'deslize' },
            { label: 'Elogio', value: 'elogio' },
          ]}
        />
        <FormInput label="Data" name="occurrence_date" type="date" />
        <FormInput label="Observação curta" name="description" as="textarea" placeholder="Descreva o ocorrido" />
        <button className="primary-button w-full" type="submit" disabled={status.saving}>
          <Send className="h-5 w-5" />
          {status.saving ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

function SuccessMessage({ message }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
      <CheckCircle2 className="mr-2 inline h-5 w-5" />
      {message}
    </div>
  );
}
