import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmployeeForm from '../components/EmployeeForm.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createApprovalRequest } from '../services/approvalService.js';
import {
  getEmployeeById,
  serializeEmployeeData,
  updateEmployee,
  uploadEmployeePhoto,
} from '../services/employeeService.js';

export default function EditarFuncionario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isRH, can, profile } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const showSalary = can('employees:salaries');

  useEffect(() => {
    let active = true;
    async function loadEmployee() {
      setLoading(true);
      const result = await getEmployeeById(id);
      if (!active) return;
      setEmployee(result.data || null);
      setMessage(result.error || (!result.data ? 'Funcionário não encontrado.' : ''));
      setLoading(false);
    }
    loadEmployee();
    return () => { active = false; };
  }, [id]);

  async function handleSubmit(formData, photoFile) {
    setSaving(true);
    setMessage('');
    const payload = serializeEmployeeData(formData);

    if (photoFile) {
      const photoResult = await uploadEmployeePhoto(photoFile, employee.id);
      if (photoResult.error) {
        setMessage(photoResult.error);
        setSaving(false);
        return;
      }
      payload.photo_url = photoResult.data.photo_url;
    }

    const result = isRH
      ? await createApprovalRequest({
          requested_by: profile?.id,
          request_type: 'editar_funcionario',
          target_table: 'employees',
          target_id: employee.id,
          payload,
          reason: `Edição solicitada para ${employee.name}`,
          status: 'pendente',
        })
      : await updateEmployee(employee.id, payload);

    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }

    navigate(`/funcionarios/${employee.id}`, {
      state: { notice: isRH ? 'Alteração enviada para aprovação do administrativo.' : 'Funcionário atualizado com sucesso.' },
    });
  }

  return (
    <div className="page-shell">
      <PageTitle title="Editar funcionário" subtitle={employee?.name || 'Carregando dados...'} />
      {loading && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-luvig-blue">
          Carregando funcionário...
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div>
      )}
      {!loading && employee && (
        <EmployeeForm
          key={employee.id}
          employee={employee}
          showSalary={showSalary}
          saving={saving}
          submitLabel={isRH ? 'Enviar para aprovação' : 'Salvar'}
          cancelTo={`/funcionarios/${employee.id}`}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
