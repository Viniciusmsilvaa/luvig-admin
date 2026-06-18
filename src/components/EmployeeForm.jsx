import { Camera, Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeeStatusOptions } from '../services/employeeService.js';
import FormInput from './FormInput.jsx';

export default function EmployeeForm({
  employee = null,
  showSalary,
  saving,
  submitLabel = 'Salvar',
  cancelTo = '/funcionarios',
  onSubmit,
}) {
  const fileInputRef = useRef(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(employee?.photoUrl || '');

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(employee?.photoUrl || '');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [employee?.photoUrl, photoFile]);

  function handlePhotoChange(event) {
    setPhotoFile(event.target.files?.[0] || null);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget), photoFile);
  }

  return (
    <form className="surface-card grid gap-5 p-5 lg:grid-cols-[240px,1fr]" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-luvig-ink text-2xl font-black text-white">
          {previewUrl ? (
            <img className="h-full w-full object-cover" src={previewUrl} alt={`Foto de ${employee?.name || 'funcionário'}`} />
          ) : employee?.avatar ? (
            employee.avatar
          ) : (
            <Camera className="h-10 w-10" />
          )}
        </div>
        <p className="mt-4 text-sm font-bold text-slate-700">Foto do funcionário</p>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handlePhotoChange}
        />
        <button className="secondary-button mt-4 w-full" type="button" onClick={() => fileInputRef.current?.click()}>
          <Camera className="h-5 w-5" />
          {employee?.photoUrl ? 'Trocar foto' : 'Selecionar foto'}
        </button>
        <p className="mt-2 text-xs font-semibold text-slate-500">PNG, JPG ou WebP, até 5 MB</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormInput label="Nome completo" name="full_name" defaultValue={employee?.name || ''} required />
        <FormInput label="Função" name="role" defaultValue={employee?.role || ''} placeholder="Cargo ou função" />
        <FormInput label="Telefone" name="phone" defaultValue={employee?.phone || ''} placeholder="(00) 00000-0000" />
        <FormInput label="Data de admissão" name="admission_date" type="date" defaultValue={employee?.admissionDate || ''} />
        {showSalary ? (
          <FormInput
            label="Salário"
            name="salary"
            type="number"
            min="0"
            step="0.01"
            defaultValue={employee?.salary ?? ''}
            placeholder="0,00"
          />
        ) : (
          <FormInput label="Salário" value="Restrito ao Admin" disabled readOnly />
        )}
        <FormInput
          label="Status"
          name="status"
          as="select"
          options={employeeStatusOptions}
          defaultValue={employee?.statusValue || 'ativo'}
        />
        <FormInput
          label="Nota inicial"
          name="score"
          type="number"
          min="0"
          max="10"
          step="0.1"
          defaultValue={employee?.score ?? 10}
          required
        />
        <FormInput
          label="Próximas férias"
          name="next_vacation_date"
          type="date"
          defaultValue={employee?.nextVacationDate || ''}
        />
        <FormInput
          label="Retorno de férias"
          name="vacation_return_date"
          type="date"
          defaultValue={employee?.vacationReturnDate || ''}
        />
        <FormInput
          label="Retorno de atestado"
          name="medical_leave_return_date"
          type="date"
          defaultValue={employee?.medicalLeaveReturnDate || ''}
        />
        <FormInput
          label="Início do aviso prévio"
          name="notice_start_date"
          type="date"
          defaultValue={employee?.noticeStartDate || ''}
        />
        <FormInput
          label="Final do aviso prévio"
          name="notice_end_date"
          type="date"
          defaultValue={employee?.noticeEndDate || ''}
        />
        <FormInput
          label="Data de desligamento"
          name="dismissal_date"
          type="date"
          defaultValue={employee?.dismissalDate || ''}
        />
        <input type="hidden" name="photo_url" value={employee?.photoPath || ''} />
        <div className="md:col-span-2">
          <FormInput
            label="Observações"
            name="notes"
            as="textarea"
            defaultValue={employee?.notes || ''}
            placeholder="Informações administrativas relevantes"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
          <button className="primary-button" type="submit" disabled={saving}>
            <Save className="h-5 w-5" />
            {saving ? 'Salvando...' : submitLabel}
          </button>
          <Link className="secondary-button" to={cancelTo}>
            <X className="h-5 w-5" />
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
}
