import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  FolderKanban, CheckSquare, Clock, AlertCircle, ListTodo,
  Calendar, TrendingUp, Users,
} from 'lucide-react';
import { dashboardApi } from '../services';
import { LoadingScreen, PageHeader, Avatar, PriorityBadge, TaskStatusBadge } from '../components/shared';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import type { TaskPriority, TaskStatus } from '../types';
import { useAuthStore } from '../store/authStore';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const PRIORITY_COLORS: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
const DEADLINE_COLORS: Record<string, string> = { red: 'text-red-500', yellow: 'text-amber-500', green: 'text-emerald-500' };

// Theme-aware Recharts tooltip props (light/dark) — keeps text readable on both themes.
function getTooltipProps(isDark: boolean) {
  const contentStyle = isDark
    ? {
        background: '#1e1e2e',
        border: '1px solid #313244',
        borderRadius: '8px',
        color: '#e2e8f0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        padding: '8px 12px',
      }
    : {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        color: '#0f172a',
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        padding: '8px 12px',
      };
  const labelStyle = { color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600, marginBottom: 4 };
  const itemStyle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const cursor = { fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.05)' };
  return { contentStyle, labelStyle, itemStyle, cursor };
}

export default function DashboardPage() {
  const theme = useAuthStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const isMember = user?.role === 'member';
  const canViewTeamInsights = user?.role === 'admin' || user?.role === 'project_manager';
  const isDark = theme === 'dark';
  const tooltipProps = getTooltipProps(isDark);

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => dashboardApi.getSummary(signal).then((r) => r.data),
    retry: 2,
  });

  if (isLoading) return <LoadingScreen />;

  if (isError || !summary) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dashboard" subtitle="Overview of your workspace" />
        <div className="card p-10 text-center max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
            Could not load dashboard
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            The API may still be starting. Check that the backend is running on port 3001.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    projects, tasks, tasksByPriority, taskStatusDistribution,
    completionTrend, projectSummary, upcomingDeadlines, highPriorityTasks,
    memberWorkload, teamProductivity, recentActivity,
  } = summary;

  const kpis = [
    {
      label: isMember ? 'My Projects' : 'Total Projects',
      value: projects.total,
      icon: FolderKanban,
      color: 'text-brand-600 dark:text-brand-400',
      bg: 'bg-brand-50 dark:bg-brand-500/15',
      accent: 'from-brand-500/10 to-transparent',
    },
    {
      label: isMember ? 'My Tasks' : 'Total Tasks',
      value: tasks.total,
      icon: CheckSquare,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-500/15',
      accent: 'from-blue-500/10 to-transparent',
    },
    {
      label: 'Completed',
      value: tasks.completed,
      icon: Clock,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/15',
      accent: 'from-emerald-500/10 to-transparent',
    },
    {
      label: 'Pending',
      value: tasks.pending,
      icon: ListTodo,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/15',
      accent: 'from-amber-500/10 to-transparent',
    },
    {
      label: 'Overdue',
      value: tasks.overdue,
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/15',
      accent: 'from-red-500/10 to-transparent',
    },
  ];

  const subtitle = isMember
    ? 'Overview of your assigned work'
    : user?.role === 'project_manager'
      ? 'Overview of projects you lead'
      : 'Overview of your workspace';

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle={subtitle} />

      {/* KPI Cards — 5 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, accent }) => (
          <div key={label} className="card p-5 relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${accent} pointer-events-none`} />
            <div className="flex items-center justify-between mb-4">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-[18px] h-[18px] ${color}`} />
              </div>
            </div>
            <p className="font-heading text-[28px] font-bold text-slate-900 dark:text-white leading-none mb-1">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Task status donut */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Task Status Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={taskStatusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="count">
                {taskStatusDistribution.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: any, n: any) => [v, n]}
                contentStyle={tooltipProps.contentStyle}
                labelStyle={tooltipProps.labelStyle}
                itemStyle={tooltipProps.itemStyle}
              />
              <Legend formatter={(v) => taskStatusDistribution.find((d: any) => d.status === v || d.count === v)?.status || v} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tasks by priority bar */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Tasks by Priority</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tasksByPriority} barCategoryGap="40%">
              <XAxis dataKey="priority" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipProps.contentStyle}
                labelStyle={tooltipProps.labelStyle}
                itemStyle={tooltipProps.itemStyle}
                cursor={tooltipProps.cursor}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {tasksByPriority.map((entry: any) => (
                  <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Progress Trend (PRD §08) — completion rate over the last 8 weeks */}
      {completionTrend?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500" /> {isMember ? 'My Progress Trend' : 'Project Progress Trend'}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {isMember ? 'Your tasks created vs. completed by week' : 'Tasks created vs. completed by week'}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={completionTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke={isDark ? '#1f2937' : '#e2e8f0'} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipProps.contentStyle}
                labelStyle={tooltipProps.labelStyle}
                itemStyle={tooltipProps.itemStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#334155' }} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="created" name="Created" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Project Summary Widget */}
      {projectSummary?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500" /> {isMember ? 'My Project Progress' : 'Project Progress'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium">Project</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                  <th className="pb-2 font-medium text-center">Tasks</th>
                  <th className="pb-2 font-medium text-center">Pending</th>
                  <th className="pb-2 font-medium">Progress</th>
                  <th className="pb-2 font-medium">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {projectSummary.map((p: any) => (
                  <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{p.name}</td>
                    <td className="py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        p.status === 'Completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>{p.status}</span>
                    </td>
                    <td className="py-2.5 text-center text-slate-500 dark:text-slate-400">{p.totalTasks}</td>
                    <td className="py-2.5 text-center text-slate-500 dark:text-slate-400">{p.pendingTasks}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${p.completionPct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{p.completionPct}%</span>
                      </div>
                    </td>
                    <td className={`py-2.5 text-xs font-medium ${DEADLINE_COLORS[p.deadlineColor]}`}>
                      {format(new Date(p.deadline), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming Deadlines + High Priority Tasks */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Upcoming deadlines */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" /> Upcoming Deadlines
            <span className="text-xs text-slate-400 font-normal">(next 7 days)</span>
          </h2>
          {upcomingDeadlines?.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No upcoming deadlines</p>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines?.map((t: any) => (
                <div key={t._id} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.assignedTo?.name || 'Unassigned'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PriorityBadge priority={t.priority as TaskPriority} />
                    <span className={`text-xs font-medium ${isPast(new Date(t.dueDate)) ? 'text-red-500' : 'text-amber-500'}`}>
                      {format(new Date(t.dueDate), 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High priority tasks */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" /> High Priority Tasks
          </h2>
          {highPriorityTasks?.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No high priority tasks</p>
          ) : (
            <div className="space-y-2">
              {highPriorityTasks?.map((t: any) => (
                <div key={t._id} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.assignedTo?.name || 'Unassigned'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <TaskStatusBadge status={t.status as TaskStatus} />
                    <span className={`text-xs font-medium ${isPast(new Date(t.dueDate)) ? 'text-red-500' : 'text-slate-400'}`}>
                      {format(new Date(t.dueDate), 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Productivity chart + Member Workload table — admin/PM only */}
      {canViewTeamInsights && (teamProductivity?.length > 0 || memberWorkload?.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Team productivity bar */}
          {teamProductivity?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Team Productivity
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={teamProductivity} layout="vertical" barCategoryGap="30%">
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipProps.contentStyle}
                    labelStyle={tooltipProps.labelStyle}
                    itemStyle={tooltipProps.itemStyle}
                    cursor={tooltipProps.cursor}
                  />
                  <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Member workload table */}
          {memberWorkload?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Member Workload
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                      <th className="pb-2 font-medium">Member</th>
                      <th className="pb-2 font-medium text-center">Total</th>
                      <th className="pb-2 font-medium text-center">Done</th>
                      <th className="pb-2 font-medium text-center">Active</th>
                      <th className="pb-2 font-medium text-center">Todo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {memberWorkload.map((m: any) => (
                      <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">{m.name}</td>
                        <td className="py-2.5 text-center text-slate-500 dark:text-slate-400">{m.total}</td>
                        <td className="py-2.5 text-center">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{m.completed}</span>
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{m.inProgress}</span>
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="text-slate-500 dark:text-slate-400">{m.todo}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity — admin/PM only */}
      {canViewTeamInsights && (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h2>
        {recentActivity?.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No activity yet</p>
        ) : (
          <div className="space-y-4">
            {recentActivity?.map((a: any) => (
              <div key={a._id} className="flex items-start gap-3">
                <Avatar name={a.actor?.name || '?'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{a.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
