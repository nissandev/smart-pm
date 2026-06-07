import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Briefcase,
  Users, Activity, LogOut, X,
  UserCog, Zap,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types';

const navItems: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
  roles?: UserRole[];
}[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/my-work', icon: Briefcase, label: 'My Work', roles: ['project_manager', 'member'] },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/activity', icon: Activity, label: 'Activity', roles: ['admin', 'project_manager'] },
];

function NavItem({
  to,
  icon: Icon,
  label,
  end,
  onClick,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
  onClick: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-brand-50 dark:bg-brand-500/[0.12] text-brand-700 dark:text-brand-400'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 dark:bg-brand-400 rounded-r-full" />
          )}
          <span
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              isActive
                ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'
                : 'text-slate-400 dark:text-slate-500 group-hover:bg-slate-100 dark:group-hover:bg-white/[0.06] group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}
          >
            <Icon className="w-[17px] h-[17px]" />
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[220px] h-screen flex flex-col
          bg-white dark:bg-[#0d0d1b]
          border-r border-slate-100 dark:border-white/[0.05]
          flex-shrink-0
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-14 px-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-500/25">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
              SmartPM
            </span>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || (user?.role && item.roles.includes(user.role as UserRole)))
            .map(({ to, icon, label, end }) => (
              <NavItem key={to} to={to} icon={icon} label={label} end={end} onClick={onClose} />
            ))}

          {user?.role === 'admin' && (
            <NavItem to="/users" icon={UserCog} label="Manage Users" onClick={onClose} />
          )}
        </nav>

        {/* User section + logout */}
        <div className="px-3 pb-4 pt-2 border-t border-slate-100 dark:border-white/[0.05]">
          {/* User row */}
          <div className="flex items-center gap-3 px-3 py-2.5 mb-0.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                {user?.name}
              </p>
              <p className="text-[11px] text-slate-400 capitalize leading-tight">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-500/10 transition-colors">
              <LogOut className="w-[17px] h-[17px]" />
            </span>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
