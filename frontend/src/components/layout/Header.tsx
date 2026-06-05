import { Menu, Sun, Moon, Zap } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../shared';
import NotificationBell from './NotificationBell';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/activity': 'Activity',
  '/users': 'Manage Users',
};

function getTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/projects/')) return 'Project Detail';
  if (pathname.startsWith('/tasks/')) return 'Task Detail';
  if (pathname.startsWith('/team/')) return 'Member Detail';
  return 'SmartPM';
}

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, theme, toggleTheme } = useAuthStore();
  const { pathname } = useLocation();
  const title = getTitle(pathname);

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-white dark:bg-[#12121f] border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
      {/* Hamburger — mobile/tablet only */}
      <button
        className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo — mobile/tablet only (desktop has it in sidebar) */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-base font-bold text-slate-900 dark:text-white">SmartPM</span>
      </div>

      {/* Page title — desktop only */}
      <h1 className="hidden lg:block text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h1>

      <div className="flex-1" />

      {/* Notifications */}
      <NotificationBell />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* User chip */}
      <div className="flex items-center gap-2.5">
        <Avatar name={user?.name || '?'} size="sm" />
        <div className="hidden sm:block text-right leading-tight">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.name}</p>
          <p className="text-xs text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
      </div>
    </header>
  );
}
