import {
  Calendar, DollarSign, Edit2, RefreshCw, Trash2, Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { ProjectStatusBadge } from '@/components/shared';
import { CopyProjectIdButton } from '@/components/projects/CopyProjectIdButton';
import {
  formatCurrency,
  formatTeamLabel,
  getProjectDeadlineHighlight,
} from '@/utils/projectTeam';
import type { ExpenseSummary, Project, User } from '@/types';

type ProjectDetailHeaderProps = {
  project: Project;
  tasksCount: number;
  progress: number;
  tasksByStatus: { todo: number; inProgress: number; completed: number };
  expenseSummary?: ExpenseSummary;
  linkedTeamName?: string;
  showSyncButton: boolean;
  syncAvailable: boolean;
  syncPendingCount: number;
  isAdminOrPM: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => void;
};

export function ProjectDetailHeader({
  project,
  tasksCount,
  progress,
  tasksByStatus,
  expenseSummary,
  linkedTeamName,
  showSyncButton,
  syncAvailable,
  syncPendingCount,
  isAdminOrPM,
  canManage,
  onEdit,
  onDelete,
  onSync,
}: ProjectDetailHeaderProps) {
  const deadlineHighlight = getProjectDeadlineHighlight(project.deadline, project.status);

  return (
    <div className="card p-6 mb-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <ProjectStatusBadge status={project.status} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{project.description}</p>
          )}
        </div>
        {isAdminOrPM && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <CopyProjectIdButton projectId={project._id} size="md" />
            {canManage && (
              <button
                type="button"
                className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                onClick={onEdit}
                title="Edit project"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canManage && (
              <button
                type="button"
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                onClick={onDelete}
                title="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm ${deadlineHighlight.pillClass}`}
        >
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span>
            Deadline: {format(new Date(project.deadline), 'MMM d, yyyy')}
            {deadlineHighlight.statusLabel && (
              <span className="ml-1.5 font-bold">· {deadlineHighlight.statusLabel}</span>
            )}
          </span>
        </span>
        <span className="text-slate-400">{tasksCount} tasks</span>
        <span className="text-slate-400 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {formatTeamLabel(project)}
        </span>
        <span className="text-slate-400 flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5" />
          {formatCurrency(expenseSummary?.total ?? 0, expenseSummary?.currency ?? 'USD')} spent
        </span>
        {typeof project.createdBy === 'object' && project.createdBy && (
          <span className="text-slate-400">Owner: {(project.createdBy as User).name}</span>
        )}
        {project.leadId && typeof project.leadId === 'object' && (
          <span className="text-slate-400">Lead: {(project.leadId as User).name}</span>
        )}
        {linkedTeamName && (
          <span className="text-slate-400 flex items-center gap-2 flex-wrap">
            Team: {linkedTeamName}
            {showSyncButton && (
              <button
                type="button"
                className={`relative inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  syncAvailable
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                    : 'bg-brand-100 hover:bg-brand-200 dark:bg-brand-950/50 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300'
                }`}
                onClick={onSync}
              >
                <RefreshCw className={`w-3 h-3 ${syncAvailable ? 'animate-pulse' : ''}`} />
                Sync
                {syncAvailable && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-white text-amber-600 text-[10px] font-bold leading-none flex items-center justify-center">
                    {syncPendingCount}
                  </span>
                )}
              </button>
            )}
          </span>
        )}
      </div>

      {tasksCount > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>{tasksByStatus.todo} todo</span>
            <span className="text-blue-500">{tasksByStatus.inProgress} in progress</span>
            <span className="text-emerald-500">{tasksByStatus.completed} completed</span>
          </div>
        </div>
      )}
    </div>
  );
}
