import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Relatorios = lazy(() => import('./pages/Relatorios.jsx'));
const Documentos = lazy(() => import('./pages/Documentos.jsx'));
const NovoDocumento = lazy(() => import('./pages/NovoDocumento.jsx'));
const Funcionarios = lazy(() => import('./pages/Funcionarios.jsx'));
const NovoFuncionario = lazy(() => import('./pages/NovoFuncionario.jsx'));
const FuncionarioDetalhe = lazy(() => import('./pages/FuncionarioDetalhe.jsx'));
const EditarFuncionario = lazy(() => import('./pages/EditarFuncionario.jsx'));
const NovaOcorrencia = lazy(() => import('./pages/NovaOcorrencia.jsx'));
const RH = lazy(() => import('./pages/RH.jsx'));
const Lideranca = lazy(() => import('./pages/Lideranca.jsx'));
const LiderancaFuncionario = lazy(() => import('./pages/LiderancaFuncionario.jsx'));
const LiderancaCondominio = lazy(() => import('./pages/LiderancaCondominio.jsx'));
const LiderancaMaterial = lazy(() => import('./pages/LiderancaMaterial.jsx'));
const Administracao = lazy(() => import('./pages/Administracao.jsx'));
const Pedidos = lazy(() => import('./pages/Pedidos.jsx'));
const Pendencias = lazy(() => import('./pages/Pendencias.jsx'));
const Revisoes = lazy(() => import('./pages/Revisoes.jsx'));
const Avisos = lazy(() => import('./pages/Avisos.jsx'));
const Financeiro = lazy(() => import('./pages/Financeiro.jsx'));
const Entradas = lazy(() => import('./pages/Entradas.jsx'));
const Saidas = lazy(() => import('./pages/Saidas.jsx'));
const Clientes = lazy(() => import('./pages/Clientes.jsx'));
const NovoCliente = lazy(() => import('./pages/NovoCliente.jsx'));
const ClienteDetalhe = lazy(() => import('./pages/ClienteDetalhe.jsx'));
const EditarCliente = lazy(() => import('./pages/EditarCliente.jsx'));
const Usuarios = lazy(() => import('./pages/Usuarios.jsx'));
const NovoUsuario = lazy(() => import('./pages/NovoUsuario.jsx'));
const EditarUsuario = lazy(() => import('./pages/EditarUsuario.jsx'));
const MeuPonto = lazy(() => import('./pages/MeuPonto.jsx'));
const Configuracoes = lazy(() => import('./pages/Configuracoes.jsx'));

export default function App() {
  const protect = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={protect(<Dashboard />)} />
          <Route path="/relatorios" element={protect(<Relatorios />)} />
          <Route path="/documentos" element={protect(<Documentos />)} />
          <Route path="/documentos/novo" element={protect(<NovoDocumento />)} />
          <Route path="/funcionarios" element={protect(<Funcionarios />)} />
          <Route path="/funcionarios/novo" element={protect(<NovoFuncionario />)} />
          <Route path="/funcionarios/:id" element={protect(<FuncionarioDetalhe />)} />
          <Route path="/funcionarios/:id/editar" element={protect(<EditarFuncionario />)} />
          <Route path="/ocorrencias/nova" element={protect(<NovaOcorrencia />)} />
          <Route path="/rh" element={protect(<RH />)} />
          <Route path="/lideranca" element={protect(<Lideranca />)} />
          <Route path="/lideranca/funcionario" element={protect(<LiderancaFuncionario />)} />
          <Route path="/lideranca/condominio" element={protect(<LiderancaCondominio />)} />
          <Route path="/lideranca/material" element={protect(<LiderancaMaterial />)} />
          <Route path="/administracao" element={protect(<Administracao />)} />
          <Route path="/administracao/pedidos" element={protect(<Pedidos />)} />
          <Route path="/administracao/pendencias" element={protect(<Pendencias />)} />
          <Route path="/administracao/revisoes" element={protect(<Revisoes />)} />
          <Route path="/administracao/avisos" element={protect(<Avisos />)} />
          <Route path="/financeiro" element={protect(<Financeiro />)} />
          <Route path="/financeiro/entradas" element={protect(<Entradas />)} />
          <Route path="/financeiro/saidas" element={protect(<Saidas />)} />
          <Route path="/clientes" element={protect(<Clientes />)} />
          <Route path="/clientes/novo" element={protect(<NovoCliente />)} />
          <Route path="/clientes/:id" element={protect(<ClienteDetalhe />)} />
          <Route path="/clientes/:id/editar" element={protect(<EditarCliente />)} />
          <Route path="/usuarios" element={protect(<Usuarios />)} />
          <Route path="/usuarios/novo" element={protect(<NovoUsuario />)} />
          <Route path="/usuarios/:id/editar" element={protect(<EditarUsuario />)} />
          <Route path="/meu-ponto" element={protect(<MeuPonto />)} />
          <Route path="/configuracoes" element={protect(<Configuracoes />)} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function RouteLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-luvig-cloud p-6"><div className="surface-card w-full max-w-sm p-6"><div className="loading-shimmer h-5 w-40" /><div className="loading-shimmer mt-4 h-3 w-full" /><div className="loading-shimmer mt-2 h-3 w-3/4" /></div></div>;
}
