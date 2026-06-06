import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Clock, PauseCircle, Filter, ChevronRight,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { dashboardApi } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PageHeader, EmptyState, Avatar,
  PriorityBadge, TaskStatusBadge,
} from '../components/shared';
import type { Task, TaskPriority, TaskStatus } from '../types';

type Section = 'overdue' | 'dueSoon' | 'stagnant';

const SECTION_META: Record<Section, { label: string; description: string; icon: typeof AlertCircle; color: string; bg: string }> = {
  overdue: {
    label: 'Overdue',
    description: 'Past due and not completed',
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
  },
  dueSoon: {
    label: 'Due in 48 hours',
    description: 'Coming up soon — needs attention',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  stagnant: {
    label: 'Not started',
    description: 'Still Todo after the deadline',
    icon: PauseCircle,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
  },
};

export default function MyWorkPage() {
  const navigate = useNavigate();
  const { user: me } = useAuthStore();
  const isPM = me?.role === 'project_manager';
  const isAdmin = me?.role === 'admin';

  const [projectFilter, setProjectFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('overdue');

  const filters = {
    ...(projectFilter ? { project: projectFilter } : {}),
    ...(assigneeFilter ? { assignee: assigneeFilter } : {}),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['my-work', filters],
    queryFn: () => dashboardApi.getMyWork(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });

  if (isLoading) return <LoadingScreen />;

  const { counts, overdue, dueSoon, stagnant, filters: options } = data!;
  const tasksBySection: Record<Section, Task[]> = { overdue, dueSoon, stagnant };
  const activeTasks = tasksBySection[activeSection];

  const subtitle = isPM
    ? 'At-risk tasks across projects you lead'
    : isAdmin
      ? 'At-risk tasks across your workspace'
      : 'Your assigned tasks that need attention';

  return (
    <div className="space-y-5">
      <PageHeader title="My Work" subtitle={subtitle} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.keys(SECTION_META) as Section[]).map((key) => {
          const meta = SECTION_META[key];
          const Icon = meta.icon;
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={`card p-5 text-left transition-all ${
                isActive
                  ? 'ring-2 ring-brand-500 shadow-md'
                  : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{meta.label}</p>
                <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{counts[key]}</p>
              <p className="text-xs text-slate-400 mt-1">{meta.description}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {(isPM || isAdmin) && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </div>
          <select
            className="input text-sm max-w-[200px]"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All projects</option>
            {options.projects.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <select
            className="input text-sm max-w-[200px]"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">All team members</option>
            {options.assignees.map((a) => (
              <option key={a._id} value={a._id}>{a.name}</option>
            ))}
          </select>
          {(projectFilter || assigneeFilter) && (
            <button
              type="button"
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
              onClick={() => { setProjectFilter(''); setAssigneeFilter(''); }}
            >
              Clear filters
            </button>
          )}
          {isFetching && (
            <span className="text-xs text-slate-400 ml-auto">Updating…</span>
          )}
        </div>
      )}

      {/* Task list */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          {(() => {
            const Icon = SECTION_META[activeSection].icon;
            return <Icon className={`w-4 h-4 ${SECTION_META[activeSection].color}`} />;
          })()}
          {SECTION_META[activeSection].label}
          <span className="text-xs text-slate-400 font-normal">
            ({activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''})
          </span>
        </h2>

        {activeTasks.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description={
              activeSection === 'overdue'
                ? 'No overdue tasks — great job keeping things on track.'
                : activeSection === 'dueSoon'
                  ? 'No tasks due in the next 48 hours.'
                  : 'No stagnant tasks — everyone has started their overdue work.'
            }
          />
        ) : (
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <TaskRow key={task._id} task={task} onClick={() => navigate(`/tasks/${task._id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const projectName =
    typeof task.project === 'object' && task.project !== null
      ? task.project.name
      : 'Project';
  const due = new Date(task.dueDate);
  const overdue = isPast(due) && task.status !== 'Completed';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group"
    >
      {task.assignedTo ? (
        <Avatar name={task.assignedTo.name} size="sm" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {task.title}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {projectName}
          {task.assignedTo ? ` · ${task.assignedTo.name}` : ' · Unassigned'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <TaskStatusBadge status={task.status as TaskStatus} />
        <PriorityBadge priority={task.priority as TaskPriority} />
        <div className="text-right min-w-[72px]">
          <p className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-amber-500'}`}>
            {format(due, 'MMM d')}
          </p>
          <p className="text-[10px] text-slate-400">
            {overdue
              ? `${formatDistanceToNow(due)} ago`
              : `in ${formatDistanceToNow(due)}`}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors" />
      </div>
    </button>
  );
}
