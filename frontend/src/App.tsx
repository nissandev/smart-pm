import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import MyWorkRoute from '@/components/auth/MyWorkRoute';
import ActivityRoute from '@/components/auth/ActivityRoute';
import { authApi } from '@/services';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const TaskDetailPage = lazy(() => import('@/pages/TaskDetailPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
const MemberDetailPage = lazy(() => import('@/pages/MemberDetailPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  const { theme, token, setAuth, logout } = useAuthStore();
  const verified = useRef(false);

  // Verify token is still valid on every app load / page refresh
  useEffect(() => {
    if (!token || verified.current) return;
    verified.current = true;
    authApi.me().then((res) => {
      setAuth(res.data, token);
    }).catch(() => {
      logout();
    });
  }, [token, setAuth, logout]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to="/" replace />
          ) : (
            <LazyPage>
              <LoginPage />
            </LazyPage>
          )
        }
      />
      <Route
        path="/signup"
        element={
          token ? (
            <Navigate to="/" replace />
          ) : (
            <LazyPage>
              <SignupPage />
            </LazyPage>
          )
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <LazyPage>
                <DashboardPage />
              </LazyPage>
            }
          />
          <Route path="my-work" element={<MyWorkRoute />} />
          <Route
            path="projects"
            element={
              <LazyPage>
                <ProjectsPage />
              </LazyPage>
            }
          />
          <Route
            path="projects/:id"
            element={
              <LazyPage>
                <ProjectDetailPage />
              </LazyPage>
            }
          />
          <Route
            path="tasks"
            element={
              <LazyPage>
                <TasksPage />
              </LazyPage>
            }
          />
          <Route
            path="tasks/:id"
            element={
              <LazyPage>
                <TaskDetailPage />
              </LazyPage>
            }
          />
          <Route
            path="team"
            element={
              <LazyPage>
                <TeamPage />
              </LazyPage>
            }
          />
          <Route
            path="team/:id"
            element={
              <LazyPage>
                <MemberDetailPage />
              </LazyPage>
            }
          />
          <Route path="activity" element={<ActivityRoute />} />
          <Route
            path="users"
            element={
              <LazyPage>
                <UsersPage />
              </LazyPage>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
