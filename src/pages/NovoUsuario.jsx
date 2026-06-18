import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfileForm from '../components/UserProfileForm.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { getEmployees } from '../services/employeeService.js';
import { configureExistingUserProfile } from '../services/userService.js';

export default function NovoUsuario() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { getEmployees().then((result) => setEmployees(result.data || [])); }, []);

  async function handleSubmit(data) {
    setSaving(true);
    setMessage('');
    const result = await configureExistingUserProfile(data.email, data);
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    navigate('/usuarios', { state: { notice: 'Perfil de usuário configurado com sucesso.' } });
  }

  return (
    <div className="page-shell">
      <PageTitle title="Cadastrar perfil de usuário existente" subtitle="Configure um login já criado no Supabase Auth." />
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-luvig-blue">Crie primeiro o usuário no Supabase Auth. Depois use esta tela para configurar nome, função e permissões no sistema.</div>
      {message && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div>}
      <UserProfileForm employees={employees} saving={saving} submitLabel="Configurar perfil" includeEmail onSubmit={handleSubmit} />
    </div>
  );
}
