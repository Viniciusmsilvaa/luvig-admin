import { Building2, ClipboardList, Package, Send, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle.jsx';

const cards = [
  {
    title: 'Funcionário',
    description: 'Atrasos, faltas, elogios e comportamento.',
    to: '/lideranca/funcionario',
    icon: UserRound,
  },
  {
    title: 'Condomínio',
    description: 'Registros gerais do prédio ou solicitações do síndico.',
    to: '/lideranca/condominio',
    icon: Building2,
  },
  {
    title: 'Material',
    description: 'Pedidos rápidos de produtos, uniformes e ferramentas.',
    to: '/lideranca/material',
    icon: Package,
  },
  {
    title: 'Ocorrência geral',
    description: 'Registro administrativo para revisão interna.',
    to: '/ocorrencias/nova',
    icon: ClipboardList,
  },
  {
    title: 'Pedido',
    description: 'Solicitação para administração acompanhar.',
    to: '/administracao/pedidos',
    icon: Send,
  },
];

export default function Lideranca() {
  return (
    <div className="page-shell">
      <PageTitle title="Central da Liderança" subtitle="Acessos grandes e rápidos para uso no celular." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.to}
            className="surface-card flex min-h-52 flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-luvig-sky hover:shadow-soft"
          >
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-luvig-light text-luvig-blue">
                <card.icon className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-black text-luvig-ink">{card.title}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">{card.description}</p>
            </div>
            <span className="primary-button mt-5 w-full">Acessar</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
