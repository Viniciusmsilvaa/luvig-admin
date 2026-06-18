import { Save, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { profileRoleOptions, profileStatusOptions } from '../services/userService.js';
import FormInput from './FormInput.jsx';

export default function UserProfileForm({
  user = null,
  employees = [],
  saving,
  submitLabel = 'Salvar',
  cancelTo = '/usuarios',
  includeEmail = false,
  onSubmit,
}) {
  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  return (
    <form className="surface-card grid gap-5 p-5 lg:grid-cols-[240px,1fr]" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-luvig-ink text-2xl font-black text-white">
          {user?.avatarUrl ? <img className="h-full w-full object-cover" src={user.avatarUrl} alt={`Avatar de ${user.name}`} /> : user?.avatar || <ShieldCheck className="h-10 w-10" />}
        </div>
        <p className="mt-4 text-sm font-bold text-slate-700">Perfil de acesso</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Senha e e-mail de login são administrados no Supabase Auth.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {includeEmail ? (
          <FormInput label="E-mail do usuário no Supabase Auth" name="email" type="email" defaultValue={user?.email || ''} required />
        ) : (
          <FormInput label="E-mail de login" value={user?.email || ''} disabled readOnly />
        )}
        <FormInput label="Nome" name="full_name" defaultValue={user?.name || ''} required />
        <FormInput label="Função na empresa" name="company_position" defaultValue={user?.companyPosition || ''} />
        <FormInput label="Perfil de acesso" name="access_role" as="select" options={profileRoleOptions} defaultValue={user?.roleValue || 'lider'} />
        <FormInput label="Status" name="status" as="select" options={profileStatusOptions} defaultValue={user?.statusValue || 'ativo'} />
        <FormInput label="Dispositivo principal" name="main_device" defaultValue={user?.mainDevice || ''} />
        <FormInput
          label="Funcionário vinculado"
          name="linked_employee_id"
          as="select"
          options={[{ value: '', label: 'Não vinculado' }, ...employees.map((employee) => ({ value: employee.id, label: employee.name }))]}
          defaultValue={user?.linkedEmployeeId || ''}
        />
        <FormInput label="URL do avatar" name="avatar_url" type="url" defaultValue={user?.avatarUrl || ''} placeholder="Opcional" />
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button className="primary-button" type="submit" disabled={saving}><Save className="h-5 w-5" /> {saving ? 'Salvando...' : submitLabel}</button>
          <Link className="secondary-button" to={cancelTo}><X className="h-5 w-5" /> Cancelar</Link>
        </div>
      </div>
    </form>
  );
}
