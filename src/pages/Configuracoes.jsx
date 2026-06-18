import { Building2, Calculator, Info, Palette, Save, Settings2, ShieldCheck, Wallet } from 'lucide-react';
import { useState } from 'react';
import FormInput from '../components/FormInput.jsx';
import LogoMark from '../components/LogoMark.jsx';
import PageTitle from '../components/PageTitle.jsx';
import TimeClockManagement from '../components/TimeClockManagement.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { expenseCategoryOptions } from '../services/financeService.js';
import { occurrenceTypeOptions, scoreRuleOptions } from '../services/occurrenceService.js';

const STORAGE_KEY = 'luvig-admin-company-settings';
const defaults = {
  companyName: 'LUVIG Serviços',
  systemName: 'LUVIG Admin',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
};

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

export default function Configuracoes() {
  const { isAdmin, isRH } = useAuth();
  const [settings, setSettings] = useState(loadSettings);
  const [message, setMessage] = useState('');

  function setField(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function handleSave(event) {
    event.preventDefault();
    if (!isAdmin) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setMessage('Configuração salva com sucesso.');
  }

  return (
    <div className="page-shell">
      <PageTitle title="Configurações" subtitle={isRH ? 'Consulta limitada das configurações operacionais.' : 'Dados institucionais e parâmetros atuais do sistema.'} />
      {isRH && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">RH possui acesso somente para consulta. Permissões, pesos e categorias financeiras são restritos ao Admin.</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

      <form className="surface-card p-5" onSubmit={handleSave}>
        <SectionTitle icon={Building2} title="Dados da empresa" subtitle="Informações locais exibidas na administração." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FormInput label="Nome da empresa" value={settings.companyName} onChange={(event) => setField('companyName', event.target.value)} disabled={!isAdmin} />
          <FormInput label="Nome do sistema" value={settings.systemName} onChange={(event) => setField('systemName', event.target.value)} disabled={!isAdmin} />
          <FormInput label="Telefone" value={settings.phone} onChange={(event) => setField('phone', event.target.value)} disabled={!isAdmin} />
          <FormInput label="WhatsApp" value={settings.whatsapp} onChange={(event) => setField('whatsapp', event.target.value)} disabled={!isAdmin} />
          <FormInput label="E-mail" type="email" value={settings.email} onChange={(event) => setField('email', event.target.value)} disabled={!isAdmin} />
          <div className="md:col-span-2"><FormInput label="Endereço" value={settings.address} onChange={(event) => setField('address', event.target.value)} disabled={!isAdmin} /></div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <SectionTitle icon={Palette} title="Cores principais" subtitle="Referência visual salva localmente." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ColorField label="Cor principal" value={settings.primaryColor} disabled={!isAdmin} onChange={(value) => setField('primaryColor', value)} />
            <ColorField label="Cor secundária" value={settings.secondaryColor} disabled={!isAdmin} onChange={(value) => setField('secondaryColor', value)} />
          </div>
        </div>

        {isAdmin && <button className="primary-button mt-6" type="submit"><Save className="h-5 w-5" /> Salvar configurações</button>}
      </form>

      <section className="surface-card overflow-hidden p-5">
        <div className="grid items-center gap-6 md:grid-cols-[220px,1fr]">
          <div className="flex min-h-36 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 to-luvig-blue p-4"><LogoMark size="lg" className="!h-24 !w-full" /></div>
          <div>
            <SectionTitle icon={Info} title="Sobre o Sistema" subtitle="LUVIG Admin · versão 0.1.0" />
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Plataforma interna da LUVIG Serviços Especializados para gestão de pessoas, clientes, documentos, ocorrências, relatórios e rotinas administrativas.</p>
          </div>
        </div>
      </section>

      <TimeClockManagement />

      <section className="surface-card p-5">
        <SectionTitle icon={Settings2} title="Tipos de ocorrência" subtitle="Tipos atualmente aceitos pelo Supabase." />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{occurrenceTypeOptions.map((item) => <ConfigItem key={item.value} label={item.label} code={item.value} />)}</div>
      </section>

      {isAdmin && (
        <>
          <section className="surface-card p-5">
            <SectionTitle icon={Calculator} title="Pesos da nota" subtitle="Valores usados no cadastro de ocorrências." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{scoreRuleOptions.filter((item) => item.value !== 'sem_impacto').map((item) => <ConfigItem key={item.value} label={item.label} code={item.value} />)}</div>
          </section>

          <section className="surface-card p-5">
            <SectionTitle icon={Wallet} title="Categorias financeiras" subtitle="Categorias aceitas nas saídas." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{expenseCategoryOptions.map((item) => <ConfigItem key={item.value} label={item.label} code={item.value} />)}</div>
          </section>

          <section className="surface-card p-5">
            <SectionTitle icon={ShieldCheck} title="Perfis de acesso" subtitle="Resumo das permissões finais." />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <AccessCard title="Admin" items={['Acesso administrativo completo', 'Financeiro e valores', 'Usuários e permissões', 'Aprovações finais']} />
              <AccessCard title="RH" items={['Funcionários e clientes', 'Central RH/Admin', 'Configurações limitadas', 'Sem financeiro ou usuários']} />
              <AccessCard title="Líder" items={['Dashboard limitado', 'Central da Liderança', 'Pedidos próprios e avisos', 'Sem áreas administrativas']} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-luvig-light text-luvig-blue"><Icon className="h-5 w-5" /></div><div><h2 className="font-black text-luvig-ink">{title}</h2><p className="text-sm font-semibold text-slate-500">{subtitle}</p></div></div>;
}

function ColorField({ label, value, disabled, onChange }) {
  return <label className="block"><span className="field-label">{label}</span><span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3"><input className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /><strong className="text-sm text-luvig-ink">{value}</strong></span></label>;
}

function ConfigItem({ label, code }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="font-bold text-luvig-ink">{label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{code}</p></div>;
}

function AccessCard({ title, items }) {
  return <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-black text-luvig-ink">{title}</h3><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="text-sm font-semibold text-slate-600">{item}</li>)}</ul></article>;
}
