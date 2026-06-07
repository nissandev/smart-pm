import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ArrowLeft, Mail, Calendar, CheckCircle2, Clock, Circle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { usersApi, tasksApi } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, Avatar, PriorityBadge, TaskStatusBadge,
} from '../components/shared';
import type { Task, TaskPriority, TaskStatus, Project } from '../types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  member: 'Member',
};

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  project_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const apiFilters = useMemo(() => {
    const f: Record<string, string> = { assignedTo: id! };
    if (statusFilter) f.status = statusFilter;
    if (priorityFilter) f.priority = priorityFilter;
    return f;
  }, [id, statusFilter, priorityFilter]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'member', id, { status: statusFilter, priority: priorityFilter }],
    queryFn: () => tasksApi.getAll(apiFilters),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

  // All tasks unfiltered — needed for accurate stats
  const { data: allMemberTasks = [] } = useQuery({
    queryKey: ['tasks', 'member', id, {}],
    queryFn: () => tasksApi.getAll({ assignedTo: id! }),
    enabled: !!id,
  });

  const filtered = tasks as Task[];

  // Stats always based on unfiltered totals
  const stats = useMemo(() => {
    const all = allMemberTasks as Task[];
    return {
      total: all.length,
      completed: all.filter((t) => t.status === 'Completed').length,
      inProgress: all.filter((t) => t.status === 'In Progress').length,
      todo: all.filter((t) => t.status === 'Todo').length,
      overdue: all.filter((t) => t.status !== 'Completed' && isPast(new Date(t.dueDate))).length,
    };
  }, [tasks]);

  if (memberLoading || tasksLoading) return <LoadingScreen />;
  if (!member) return <div className="text-center py-16 text-slate-400">Member not found</div>;

  return (
    <div>
      {/* Back */}
      <button
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-5 transition-colors"
        onClick={() => navigate('/team')}
      >
        <ArrowLeft className="w-4 h-4" /> Team
      </button>

      {/* Member profile card */}
      <div className="card p-6 mb-4">
        <div className="flex items-start gap-5">
          <Avatar name={member.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{member.name}</h1>
              {member._id === me?._id && (
                <span className="text-xs text-brand-500 font-medium">(you)</span>
              )}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[member.role]}`}>
                {ROLE_LABELS[member.role]}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500 dark:text-slate-400">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              {member.email}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Joined {format(new Date(member.createdAt), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          <StatCard label="Total Tasks" value={stats.total} color="text-slate-700 dark:text-slate-200" />
          <StatCard label="Completed" value={stats.completed} color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="In Progress" value={stats.inProgress} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Todo" value={stats.todo} color="text-slate-500 dark:text-slate-400" />
          <StatCard label="Overdue" value={stats.overdue} color="text-red-500" />
        </div>

        {/* Completion progress */}
        {stats.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Completion rate</span>
              <span className="font-medium">{Math.round((stats.completed / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((stats.completed / stats.total) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tasks section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Assigned Tasks
            <span className="ml-2 text-slate-400 font-normal">
              {(statusFilter || priorityFilter) ? `${filtered.length} of ${stats.total}` : stats.total}
            </span>
          </h2>
          <div className="flex gap-2">
            <select
              className="input py-1.5 text-xs w-auto min-w-[120px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <select
              className="input py-1.5 text-xs w-auto min-w-[120px]"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-10 text-center text-sm text-slate-400">
            {statusFilter || priorityFilter
              ? 'No tasks match your filters'
              : `${member.name} has no tasks assigned`}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskRow key={task._id} task={task} onClick={() => navigate(`/tasks/${task._id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = task.status !== 'Completed' && isPast(new Date(task.dueDate));
  const projectName = typeof task.project === 'object' ? (task.project as Project).name : '';

  return (
    <div
      className="card px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {task.status === 'Completed' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : task.status === 'In Progress' ? (
          <Clock className="w-4 h-4 text-blue-500" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium truncate ${task.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
            {task.title}
          </p>
          <PriorityBadge priority={task.priority as TaskPriority} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {projectName && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{projectName}</span>
          )}
          <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
            <Calendar className="w-3 h-3" />
            {format(new Date(task.dueDate), 'MMM d, yyyy')}
            {overdue && ' · Overdue'}
          </span>
        </div>
      </div>

      <TaskStatusBadge status={task.status as TaskStatus} />
    </div>
  );
}
