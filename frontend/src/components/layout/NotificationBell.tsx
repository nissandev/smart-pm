import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCheck, Trash2, MessageSquare, UserPlus,
  CheckCircle2, Calendar, ListTodo,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { notificationsApi } from '../../services';
import type { Notification, NotificationType } from '../../types';

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  task_assigned: ListTodo,
  task_status_changed: CheckCircle2,
  task_due_soon: Calendar,
  comment_added: MessageSquare,
  member_added: UserPlus,
};

const ICON_COLORS: Record<NotificationType, string> = {
  task_assigned: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  task_status_changed: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
  task_due_soon: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  comment_added: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
  member_added: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(15).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const items: Notification[] = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearAll = useMutation({
    mutationFn: () => notificationsApi.clearAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleClick = (n: Notification) => {
    if (!n.read) markRead.mutate(n._id);
    if (n.task?._id) navigate(`/tasks/${n.task._id}`);
    else if (n.project?._id) navigate(`/projects/${n.project._id}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] card shadow-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications {unread > 0 && <span className="text-xs text-red-500 font-medium">({unread} new)</span>}
            </p>
            <div className="flex gap-1">
              {unread > 0 && (
                <button
                  className="p-1.5 text-slate-400 hover:text-brand-500 rounded transition-colors"
                  onClick={() => markAll.mutate()}
                  title="Mark all as read"
                  disabled={markAll.isPending}
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {items.length > 0 && (
                <button
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                  onClick={() => clearAll.mutate()}
                  title="Clear all"
                  disabled={clearAll.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">You're all caught up</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  return (
                    <li
                      key={n._id}
                      onClick={() => handleClick(n)}
                      className={`relative px-4 py-3 flex gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        !n.read ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ICON_COLORS[n.type] || 'bg-slate-100 dark:bg-slate-800'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {n.message}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          {n.actor?.name && <span>by {n.actor.name}</span>}
                          {n.actor?.name && <span>·</span>}
                          <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
