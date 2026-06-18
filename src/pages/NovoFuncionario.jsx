import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeForm from '../components/EmployeeForm.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createApprovalRequest } from '../services/approvalService.js';
import {
  createEmployee,
  serializeEmployeeData,
  updateEmployee,
  uploadEmployeePhoto,
} from '../services/employeeService.js';

export default function NovoFuncionario() {
  const navigate = useNavigate();
  const { isRH, can, profile } = useAuth();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const showSalary = can('employees:salaries');

  async function handleSubmit(formData, photoFile) {
    setSaving(true);
    setMessage('');
    const payload = serializeEmployeeData(formData);

    if (isRH) {
      if (photoFile) {
        const photoResult = await uploadEmployeePhoto(photoFile, crypto.randomUUID());
        if (photoResult.error) {
          setMessage(photoResult.error);
          setSaving(false);
          return;
        }
        payload.photo_url = photoResult.data.photo_url;
      }

      const result = await createApprovalRequest({
        requested_by: profile?.id,
        request_type: 'outro',
        target_table: 'employees',
        payload,
        reason: 'Cadastro de funcionário solicitado pelo RH',
        status: 'pendente',
      });

      setSaving(false);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      navigate('/funcionarios', { state: { notice: 'Cadastro enviado para aprovação do administrativo.' } });
      return;
    }

    const result = await createEmployee(payload);
    if (result.error || !result.data) {
      setMessage(result.error || 'Não foi possível cadastrar o funcionário.');
      setSaving(false);
      return;
    }

    if (photoFile) {
      const photoResult = await uploadEmployeePhoto(photoFile, result.data.id);
      if (photoResult.error) {
        setMessage(`Funcionário cadastrado, mas ${photoResult.error.toLocaleLowerCase('pt-BR')}`);
        setSaving(false);
        return;
      }
      const photoUpdate = await updateEmployee(result.data.id, { photo_url: photoResult.data.photo_url });
      if (photoUpdate.error) {
        setMessage(photoUpdate.error);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    navigate('/funcionarios', { state: { notice: 'Funcionário cadastrado com sucesso.' } });
  }

  return (
    <div className="page-shell">
      <PageTitle title="Adicionar funcionário" subtitle="Cadastre os dados profissionais e os próximos eventos do funcionário." />
      {message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div>
      )}
      <EmployeeForm
        showSalary={showSalary}
        saving={saving}
        submitLabel={isRH ? 'Enviar para aprovação' : 'Salvar'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
