import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, Mail, LayoutGrid, BarChart2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { usersApi, tasksApi, dashboardApi, projectsApi } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PageHeader, EmptyState, Avatar, PriorityBadge, TaskStatusBadge,
} from '../components/shared';
import type { User, UserRole, Task, TaskPriority, TaskStatus, Project } from '../types';

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  project_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  member: 'Member',
};

export default function TeamPage() {
  const navigate = useNavigate();
  const { user: me } = useAuthStore();
  const isAdminOrPM = me?.role === 'admin' || me?.role === 'project_manager';
  const isAdmin = me?.role === 'admin';

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'members' | 'workload'>('members');

  // Workload tab filters
  const [wlProject, setWlProject] = useState('');
  const [wlStatus, setWlStatus] = useState('');
  const [wlPriority, setWlPriority] = useState('');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((r) => r.data),
    enabled: isAdmin,
  });

  const wlFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (wlProject) f.project = wlProject;
    if (wlStatus) f.status = wlStatus;
    if (wlPriority) f.priority = wlPriority;
    return f;
  }, [wlProject, wlStatus, wlPriority]);

  const { data: allTasks = [], isLoading: tasksLoading, isFetching: tasksFetching } = useQuery({
    queryKey: ['tasks', 'workload', wlFilters],
    queryFn: () => tasksApi.getAll(wlFilters).then((r) => r.data),
    enabled: isAdminOrPM,
    placeholderData: keepPreviousData,
  });

  const { data: dashSummary } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
    enabled: isAdminOrPM,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
    enabled: isAdminOrPM,
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  // Group API-filtered tasks by assigned member
  const tasksByMember = useMemo(() => {
    const map = new Map<string, { user: User | null; tasks: Task[] }>();
    for (const task of allTasks as Task[]) {
      const assignee = task.assignedTo as User | undefined;
      if (!assignee) continue;
      const key = assignee._id;
      if (!map.has(key)) map.set(key, { user: assignee, tasks: [] });
      map.get(key)!.tasks.push(task);
    }
    return Array.from(map.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [allTasks]);

  const isLoading = usersLoading || tasksLoading;
  if (isLoading) return <LoadingScreen />;

  if (!isAdminOrPM) {
    return (
      <div>
        <PageHeader title="Team" subtitle="Your team members" />
        <div className="card p-12 flex flex-col items-center text-center">
          <Avatar name={me?.name || '?'} size="lg" />
          <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">{me?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{me?.email}</p>
          <span className={`mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[me!.role]}`}>
            {ROLE_LABELS[me!.role]}
          </span>
          <p className="text-xs text-slate-400 mt-6">Full team directory is visible to admins.</p>
          <button className="btn-secondary mt-3 text-xs" onClick={() => navigate('/projects')}>
            View Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={isAdmin ? `${users.length} member${users.length !== 1 ? 's' : ''}` : 'Team workload'}
        action={
          isAdmin ? (
            <button className="btn-secondary text-sm" onClick={() => navigate('/users')}>
              Manage Users
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-700">
        <button
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => setTab('members')}
        >
          <LayoutGrid className="w-4 h-4" /> Members
        </button>
        <button
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'workload'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => setTab('workload')}
        >
          <BarChart2 className="w-4 h-4" /> Workload
        </button>
      </div>

      {tab === 'members' && (
        <>
          {isAdmin && (
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search team members…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <EmptyState title="No members found" description="Try a different search" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((u) => (
                <MemberCard key={u._id} user={u} isMe={u._id === me?._id} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'workload' && (
        <div className="space-y-6">
          {/* Workload summary table */}
          {dashSummary?.memberWorkload?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Workload Summary</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                      <th className="pb-3 font-medium">Member</th>
                      <th className="pb-3 font-medium text-center">Total</th>
                      <th className="pb-3 font-medium text-center">Completed</th>
                      <th className="pb-3 font-medium text-center">In Progress</th>
                      <th className="pb-3 font-medium text-center">Todo</th>
                      <th className="pb-3 font-medium">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {dashSummary.memberWorkload.map((m: any) => {
                      const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                      return (
                        <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar name={m.name} size="sm" />
                              <span className="font-medium text-slate-800 dark:text-slate-200">{m.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center text-slate-500 dark:text-slate-400">{m.total}</td>
                          <td className="py-3 text-center">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{m.completed}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="text-blue-600 dark:text-blue-400 font-medium">{m.inProgress}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="text-slate-500 dark:text-slate-400">{m.todo}</span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-400 w-7 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Workload filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5" /> Filter tasks:
            </div>
            <select
              className="input py-1.5 text-xs w-auto min-w-[140px]"
              value={wlProject}
              onChange={(e) => setWlProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {(projects as Project[]).map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <select
              className="input py-1.5 text-xs w-auto min-w-[120px]"
              value={wlStatus}
              onChange={(e) => setWlStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <select
              className="input py-1.5 text-xs w-auto min-w-[120px]"
              value={wlPriority}
              onChange={(e) => setWlPriority(e.target.value)}
            >
              <option value="">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            {(wlProject || wlStatus || wlPriority) && (
              <button
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                onClick={() => { setWlProject(''); setWlStatus(''); setWlPriority(''); }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Member-wise task groups */}
          <div className={`space-y-6 transition-opacity duration-150 ${tasksFetching ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {tasksByMember.length === 0 ? (
            <EmptyState
              title="No assigned tasks"
              description={wlProject || wlStatus || wlPriority ? 'Try adjusting your filters' : 'No tasks have been assigned to any member yet'}
            />
          ) : (
            tasksByMember.map(({ user: assignee, tasks: memberTasks }) => (
              <div key={assignee?._id} className="card p-5">
                <div
                  className="flex items-center gap-3 mb-4 cursor-pointer group/header w-fit"
                  onClick={() => assignee && navigate(`/team/${assignee._id}`)}
                >
                  <Avatar name={assignee?.name || '?'} size="md" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white group-hover/header:text-brand-600 dark:group-hover/header:text-brand-400 transition-colors">
                      {assignee?.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''} assigned
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {memberTasks.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {typeof task.project === 'object' ? (task.project as any).name : ''}
                        </p>
                      </div>
                      <PriorityBadge priority={task.priority as TaskPriority} />
                      <TaskStatusBadge status={task.status as TaskStatus} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberCard({ user, isMe }: { user: User; isMe: boolean }) {
  const navigate = useNavigate();
  return (
    <div
      className="card p-5 flex flex-col gap-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/team/${user._id}`)}
    >
      <div className="flex items-start gap-3">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white truncate">
            {user.name}
            {isMe && <span className="ml-2 text-xs text-brand-500">(you)</span>}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[user.role]}`}>
          {ROLE_LABELS[user.role]}
        </span>
        <span className="text-xs text-slate-400">
          Since {format(new Date(user.createdAt), 'MMM yyyy')}
        </span>
      </div>
    </div>
  );
}
