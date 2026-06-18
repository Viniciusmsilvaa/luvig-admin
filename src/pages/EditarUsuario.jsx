import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserProfileForm from '../components/UserProfileForm.jsx';
import PageTitle from '../components/PageTitle.jsx';
import { getEmployees } from '../services/employeeService.js';
import { getUserProfile, updateUserProfile } from '../services/userService.js';

export default function EditarUsuario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getUserProfile(id), getEmployees()]).then(([userResult, employeeResult]) => {
      if (!active) return;
      setUser(userResult.data || null);
      setEmployees(employeeResult.data || []);
      setMessage(userResult.error || employeeResult.error || (!userResult.data ? 'Usuário não encontrado.' : ''));
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  async function handleSubmit(data) {
    setSaving(true);
    setMessage('');
    const result = await updateUserProfile(user.id, data, user);
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    navigate('/usuarios', { state: { notice: 'Usuário atualizado com sucesso. Permissão alterada com sucesso.' } });
  }

  return (
    <div className="page-shell">
      <PageTitle title="Editar usuário" subtitle={user?.name || 'Carregando perfil...'} />
      {loading && <div className="surface-card p-5 text-sm font-bold text-slate-600">Carregando usuário...</div>}
      {message && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div>}
      {!loading && user && <UserProfileForm key={user.id} user={user} employees={employees} saving={saving} submitLabel="Salvar alterações" onSubmit={handleSubmit} />}
    </div>
  );
}
