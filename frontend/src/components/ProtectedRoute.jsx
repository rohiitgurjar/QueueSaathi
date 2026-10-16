import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingState from './LoadingState.jsx';
import { dashboardPath } from './SiteHeader.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  if (authLoading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={dashboardPath(user.role)} replace />;
  return children;
}
