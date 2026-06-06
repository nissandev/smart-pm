import { Loader2, AlertTriangle, X } from 'lucide-react';
import type { TaskPriority, TaskStatus, ProjectStatus } from '../../types';

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return <Loader2 className={`${s} animate-spin text-brand-500`} />;
}

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function EmptyState({ title, description, action }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ── Priority badge ────────────────────────────────────────────
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cls = {
    High: 'badge-high',
    Medium: 'badge-medium',
    Low: 'badge-low',
  }[priority];
  return <span className={cls}>{priority}</span>;
}

// ── Task status badge ─────────────────────────────────────────
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const cls = {
    'Todo': 'status-todo',
    'In Progress': 'status-in-progress',
    'Completed': 'status-completed',
  }[status];
  return <span className={cls}>{status}</span>;
}

// ── Project status badge ──────────────────────────────────────
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const cls = {
    'Active': 'status-in-progress',
    'Completed': 'status-completed',
    'On Hold': 'status-todo',
  }[status];
  return <span className={cls}>{status}</span>;
}

// ── Confirm modal ─────────────────────────────────────────────
export function ConfirmModal({
  title, description, onConfirm, onCancel, loading, variant = 'danger',
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: 'danger' | 'warning';
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <AlertTriangle className={`w-5 h-5 ${variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{description}</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────
export function PageHeader({
  title, subtitle, action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export { AssigneePicker } from './AssigneePicker';

// ── Project task progress ring ────────────────────────────────
export function ProjectProgressRing({
  completed,
  total,
  size = 44,
}: {
  completed: number;
  total: number;
  size?: number;
}) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = total > 0 && completed === total;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={
        total === 0
          ? 'No tasks yet'
          : `${completed} of ${total} tasks completed (${pct}%)`
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={allDone ? 'stroke-emerald-500' : 'stroke-brand-500'}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none ${
          allDone
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        {total === 0 ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size];
  return (
    <div className={`${s} rounded-full bg-brand-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}
