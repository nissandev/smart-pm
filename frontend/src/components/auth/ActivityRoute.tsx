import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import ActivityPage from '../../pages/ActivityPage';

/** Activity log is for Admin and PM only; members use Dashboard / My Work. */
export default function ActivityRoute() {
  const { user } = useAuthStore();
  if (user?.role === 'member') {
    return <Navigate to="/" replace />;
  }
  return <ActivityPage />;
}
