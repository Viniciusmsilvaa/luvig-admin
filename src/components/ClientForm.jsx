import { FileText, Save, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientStatusOptions, contractedServiceOptions } from '../services/clientService.js';
import FormInput from './FormInput.jsx';

export default function ClientForm({
  client = null,
  showMonthlyValue,
  saving,
  submitLabel = 'Salvar',
  cancelTo = '/clientes',
  onSubmit,
}) {
  const fileInputRef = useRef(null);
  const [contractFile, setContractFile] = useState(null);
  const selectedServices = new Set(client?.servicesArray || []);

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    data.contracted_services = formData.getAll('contracted_services');
    onSubmit(data, contractFile);
  }

  return (
    <form className="surface-card grid gap-5 p-5 lg:grid-cols-[240px,1fr]" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-luvig-light text-luvig-blue">
          <FileText className="h-10 w-10" />
        </div>
        <p className="mt-4 text-sm font-bold text-slate-700">Contrato do condomínio</p>
        <p className="mt-1 break-words text-xs font-semibold text-slate-500">
          {contractFile?.name || (client?.contractPath ? 'Contrato anexado' : 'Nenhum arquivo selecionado')}
        </p>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
          onChange={(event) => setContractFile(event.target.files?.[0] || null)}
        />
        <button className="secondary-button mt-4 w-full" type="button" onClick={() => fileInputRef.current?.click()}>
          <FileText className="h-5 w-5" />
          {client?.contractPath ? 'Trocar contrato' : 'Selecionar contrato'}
        </button>
        <p className="mt-2 text-xs font-semibold text-slate-500">PDF, Word ou imagem, até 15 MB</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormInput label="Nome do condomínio" name="name" defaultValue={client?.name || ''} required />
        <FormInput label="Responsável" name="responsible_name" defaultValue={client?.manager || ''} />
        <FormInput label="Telefone" name="phone" defaultValue={client?.phone || ''} placeholder="(00) 00000-0000" />
        <FormInput label="Bairro" name="neighborhood" defaultValue={client?.neighborhood || ''} />
        <div className="md:col-span-2">
          <FormInput label="Endereço" name="address" defaultValue={client?.address || ''} />
        </div>
        {showMonthlyValue ? (
          <FormInput label="Valor mensal" name="monthly_value" type="number" min="0" step="0.01" defaultValue={client?.monthlyValue ?? ''} />
        ) : (
          <FormInput label="Valor mensal" value="Restrito ao Admin" disabled readOnly />
        )}
        <FormInput label="Dia de vencimento" name="due_day" type="number" min="1" max="31" defaultValue={client?.dueDay || ''} />
        <FormInput label="Status" name="status" as="select" options={clientStatusOptions} defaultValue={client?.statusValue || 'ativo'} />
        <input type="hidden" name="contract_url" value={client?.contractPath || ''} />

        <fieldset className="md:col-span-2">
          <legend className="field-label">Serviços contratados</legend>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {contractedServiceOptions.map((service) => (
              <label key={service} className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700">
                <input
                  className="h-4 w-4 accent-luvig-blue"
                  type="checkbox"
                  name="contracted_services"
                  value={service}
                  defaultChecked={selectedServices.has(service)}
                />
                {service}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="md:col-span-2">
          <FormInput label="Observações" name="notes" as="textarea" defaultValue={client?.notes || ''} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
          <button className="primary-button" type="submit" disabled={saving}>
            <Save className="h-5 w-5" />
            {saving ? 'Salvando...' : submitLabel}
          </button>
          <Link className="secondary-button" to={cancelTo}>
            <X className="h-5 w-5" /> Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
}
