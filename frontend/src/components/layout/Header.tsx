import { Menu, Sun, Moon, Zap } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../shared';
import NotificationBell from './NotificationBell';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/my-work': 'My Work',
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
    <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-white/80 dark:bg-[#0d0d1b]/90 backdrop-blur-md border-b border-slate-200/60 dark:border-white/[0.05] flex-shrink-0">
      {/* Hamburger — mobile/tablet only */}
      <button
        className="lg:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo — mobile only */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm shadow-brand-500/30">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-heading text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">SmartPM</span>
      </div>

      {/* Page title — desktop only */}
      <h1 className="hidden lg:block text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h1>

      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <NotificationBell />

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
        </button>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-white/10" />

      {/* User chip */}
      <div className="flex items-center gap-2.5">
        <Avatar name={user?.name || '?'} size="sm" />
        <div className="hidden sm:block leading-tight">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{user?.name}</p>
          <p className="text-[11px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
      </div>
    </header>
  );
}
