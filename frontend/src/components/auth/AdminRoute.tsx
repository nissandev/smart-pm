import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import UsersPage from '../../pages/UsersPage';

/** Users management page is admin-only; non-admins are redirected to dashboard. */
export default function AdminRoute() {
  const { user } = useAuthStore();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <UsersPage />;
}
