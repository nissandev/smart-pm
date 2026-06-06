import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import MyWorkPage from '../../pages/MyWorkPage';

/** My Work is for PMs and members; admins use the Dashboard instead. */
export default function MyWorkRoute() {
  const { user } = useAuthStore();
  if (user?.role === 'admin') {
    return <Navigate to="/" replace />;
  }
  return <MyWorkPage />;
}
