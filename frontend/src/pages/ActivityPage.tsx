import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { Activity as ActivityIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { activityApi, projectsApi } from '../services';
import { LoadingScreen, PageHeader, Avatar } from '../components/shared';

const ACTION_COLORS: Record<string, string> = {
  project_created: 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400',
  task_created: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  task_assigned: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  status_changed: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  member_added: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  task_updated: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const ACTION_LABELS: Record<string, string> = {
  project_created: 'Project Created',
  task_created: 'Task Created',
  task_assigned: 'Task Assigned',
  status_changed: 'Status Changed',
  member_added: 'Member Added',
  task_updated: 'Task Updated',
};

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['activity', page, projectFilter],
    queryFn: () => activityApi.getAll(page, 20, projectFilter || undefined).then((r) => r.data),
  });

  const activities = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div>
      <PageHeader
        title="Activity Feed"
        subtitle="All actions across the workspace"
      />

      {/* Filter */}
      <div className="mb-4">
        <select
          className="input w-full sm:w-64"
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Projects</option>
          {projects.map((p: any) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : activities.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <ActivityIcon className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No activity yet</p>
          <p className="text-xs text-slate-500">Actions will appear here as the team works</p>
        </div>
      ) : (
        <>
          <div className="card divide-y divide-slate-100 dark:divide-slate-700/50">
            {activities.map((a: any) => (
              <div key={a._id} className="flex items-start gap-4 px-5 py-4">
                <Avatar name={a.actor?.name || '?'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{a.description}</p>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[a.actionType] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
                    >
                      {ACTION_LABELS[a.actionType] || a.actionType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {a.actor?.name}
                    </p>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <p
                      className="text-xs text-slate-400 dark:text-slate-500"
                      title={format(new Date(a.createdAt), 'MMM d, yyyy HH:mm')}
                    >
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
