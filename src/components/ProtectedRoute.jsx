import { Navigate, useLocation } from 'react-router-dom';
import { canAccessRoute } from '../auth/permissions.js';
import { getTimeClockAccess } from '../auth/accessRules.js';
import { useAuth } from '../context/AuthContext.jsx';
import AccessDenied from './AccessDenied.jsx';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, loading, profile, role, user } = useAuth();

  if (loading) {
    return (
      <div className="page-shell">
        <div className="surface-card p-6 text-sm font-bold text-slate-600">Carregando sessão...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const timeClockAccess = getTimeClockAccess(profile, user);
  const isTimeClockRoute = location.pathname === '/meu-ponto';

  if (!canAccessRoute(role, location.pathname) || (isTimeClockRoute && !timeClockAccess.canView)) {
    return <AccessDenied />;
  }

  return children;
}
