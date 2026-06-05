import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Edit2, ChevronRight, Calendar,
  Search, ArrowUpDown, ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, isWithinInterval, addDays, startOfDay } from 'date-fns';
import { tasksApi, projectsApi, usersApi } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PageHeader, EmptyState, PriorityBadge,
  ConfirmModal, Avatar, Spinner,
} from '../components/shared';
import type { Task, TaskPriority, TaskStatus, Project, User } from '../types';
import { canChangeTaskStatus, getTaskEditMode } from '../utils/taskPermissions';

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const PAGE_SIZE = 10;

export default function TasksPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: me } = useAuthStore();
  const canManage = me?.role !== 'member';

  // ── Filter / sort state ────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  // ── Modal state ────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  // Reset to page 1 whenever any filter or sort changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, projectFilter, assigneeFilter, createdByFilter, deadlineFilter, search, sortBy]);

  // Build server-side filter params (status, priority, project, assignee, createdBy)
  const serverFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (statusFilter) f.status = statusFilter;
    if (priorityFilter) f.priority = priorityFilter;
    if (projectFilter) f.project = projectFilter;
    if (assigneeFilter) f.assignedTo = assigneeFilter;
    if (createdByFilter) f.createdBy = createdByFilter;
    return f;
  }, [statusFilter, priorityFilter, projectFilter, assigneeFilter, createdByFilter]);

  // ── Queries ────────────────────────────────────────────────────
  const { data: tasks = [], isLoading, isFetching } = useQuery({
    queryKey: ['tasks', serverFilters],
    queryFn: () => tasksApi.getAll(serverFilters).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
  });

  // Build the assignee dropdown from users (admins) or, for PM, members of their projects.
  const isAdmin = me?.role === 'admin';
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((r) => r.data),
    enabled: isAdmin,
  });

  const assigneeOptions: User[] = useMemo(() => {
    if (isAdmin) return allUsers as User[];
    // PM / member: combine members of accessible projects (deduplicated)
    const seen = new Map<string, User>();
    for (const p of projects as Project[]) {
      for (const m of (p.members || []) as User[]) {
        if (m && (m as any)._id && !seen.has(m._id)) seen.set(m._id, m);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, allUsers, projects]);

  // ── Mutations ──────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setDeleting(null);
      toast.success('Task deleted');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to delete task'),
  });

  // ── Client-side search + sort ──────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const now = startOfDay(new Date());
    const in7days = addDays(now, 7);

    let base = q
      ? tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            (t.assignedTo as User)?.name?.toLowerCase().includes(q),
        )
      : tasks;

    if (deadlineFilter === 'overdue') {
      base = base.filter(
        (t) => t.status !== 'Completed' && startOfDay(new Date(t.dueDate)) < now,
      );
    } else if (deadlineFilter === 'upcoming') {
      base = base.filter(
        (t) =>
          t.status !== 'Completed' &&
          isWithinInterval(startOfDay(new Date(t.dueDate)), { start: now, end: in7days }),
      );
    }

    return [...base].sort((a, b) => {
      if (sortBy === 'deadline')
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (sortBy === 'priority')
        return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
      if (sortBy === 'updated')
        return (
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
        );
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, search, sortBy]);

  // ── Pagination ─────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    tasksApi
      .update(task._id, { status })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['tasks'] });
        toast.success('Status updated');
      })
      .catch((e: any) =>
        toast.error(e?.response?.data?.message || 'Failed to update status'),
      );
  };

  // ── Initial load ───────────────────────────────────────────────
  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${filtered.length} task${filtered.length !== 1 ? 's' : ''}`}
        action={
          canManage ? (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Search by title, description, or assignee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-36"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="Todo">Todo</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          className="input w-36"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All Priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          className="input w-36"
          value={deadlineFilter}
          onChange={(e) => setDeadlineFilter(e.target.value)}
        >
          <option value="">All Deadlines</option>
          <option value="upcoming">Upcoming (7d)</option>
          <option value="overdue">Overdue</option>
        </select>
        <select
          className="input w-44"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input w-44"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          title="Filter by assigned member"
        >
          <option value="">All Members</option>
          {assigneeOptions.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name}
            </option>
          ))}
        </select>
        {/* PRD §09: "Created by" filter for admin */}
        {isAdmin && (
          <select
            className="input w-44"
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            title="Filter by creator"
          >
            <option value="">All Creators</option>
            {(allUsers as User[]).map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            className="input pl-8 w-44"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="deadline">Nearest deadline</option>
            <option value="priority">Highest priority</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
      </div>

      {/* Task list with table-level loading overlay */}
      {filtered.length === 0 && !isFetching ? (
        <EmptyState
          title="No tasks found"
          description={
            search || statusFilter || priorityFilter || projectFilter || assigneeFilter || createdByFilter || deadlineFilter
              ? 'Try adjusting your filters'
              : 'Create your first task'
          }
          action={
            canManage && !search && !statusFilter && !priorityFilter && !projectFilter && !assigneeFilter && !createdByFilter && !deadlineFilter ? (
              <button className="btn-primary" onClick={() => setShowCreate(true)}>
                Create Task
              </button>
            ) : undefined
          }
        />
      ) : (
        <div>
          {/* Relative wrapper for loading overlay */}
          <div className="relative">
            {/* Fetching overlay — keeps rows visible, shows spinner on top */}
            {isFetching && (
              <div className="absolute inset-0 z-10 flex items-start justify-center pt-10 rounded-xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px]">
                <Spinner size="md" />
              </div>
            )}

            <div className={`space-y-2 transition-opacity duration-150 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
              {paginated.map((task) => (
                <TaskRow
                  key={task._id}
                  task={task}
                  me={me}
                  onEdit={() => setEditing(task)}
                  onDelete={() => setDeleting(task)}
                  onClick={() => navigate(`/tasks/${task._id}`)}
                  onStatusChange={(status) => handleStatusChange(task, status)}
                />
              ))}
            </div>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing <span className="font-medium text-slate-700 dark:text-slate-200">{from}–{to}</span> of{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">{filtered.length}</span> tasks
              </p>
              <div className="flex items-center gap-1">
                <button
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`e${idx}`} className="px-1 text-slate-400 text-sm">…</span>
                    ) : (
                      <button
                        key={item}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          item === safePage
                            ? 'bg-brand-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => setPage(item as number)}
                      >
                        {item}
                      </button>
                    ),
                  )}

                <button
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(showCreate || editing) && (
        <TaskFormModal
          task={editing}
          projects={projects}
          delegateOnly={editing ? getTaskEditMode(editing, me) === 'delegate' : false}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
            setShowCreate(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Task"
          description={`Delete "${deleting.title}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(deleting._id)}
          onCancel={() => setDeleting(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────
function TaskRow({
  task, me, onEdit, onDelete, onClick, onStatusChange,
}: {
  task: Task;
  me: User | null | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const editMode = getTaskEditMode(task, me);
  const statusEditable = canChangeTaskStatus(task, me);
  const overdue = task.status !== 'Completed' && isPast(new Date(task.dueDate));
  const projectName =
    typeof task.project === 'object' ? (task.project as Project).name : '';

  return (
    <div
      className="card px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
            {task.title}
          </p>
          <PriorityBadge priority={task.priority as TaskPriority} />
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {projectName && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{projectName}</span>
          )}
          <span
            className={`flex items-center gap-1 text-xs ${
              overdue ? 'text-red-500' : 'text-slate-400'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {format(new Date(task.dueDate), 'MMM d, yyyy')}
            {overdue && ' · Overdue'}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inline status select */}
        <select
          className={`text-xs border rounded-full px-2.5 py-0.5 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors appearance-none ${
            statusEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
          } ${
            task.status === 'Todo'
              ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              : task.status === 'In Progress'
              ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
              : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
          }`}
          value={task.status}
          disabled={!statusEditable}
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
        >
          <option value="Todo">Todo</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>

        {task.assignedTo && (
          <div title={(task.assignedTo as User).name}>
            <Avatar name={(task.assignedTo as User).name} size="sm" />
          </div>
        )}

        {editMode !== 'none' && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg"
              onClick={onEdit}
              title={editMode === 'delegate' ? 'Reassign task' : 'Edit task'}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {editMode === 'full' && (
              <button
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                onClick={onDelete}
                title="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
}

// ── TaskFormModal ─────────────────────────────────────────────────
function TaskFormModal({
  task, projects, delegateOnly = false, onClose, onSuccess,
}: {
  task: Task | null;
  projects: Project[];
  delegateOnly?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [projectId, setProjectId] = useState(
    task
      ? typeof task.project === 'object'
        ? (task.project as Project)._id
        : (task.project as string)
      : projects[0]?._id || '',
  );
  const [assignedTo, setAssignedTo] = useState(
    task?.assignedTo ? (task.assignedTo as User)._id : '',
  );
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'Medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'Todo');
  const [loading, setLoading] = useState(false);

  const selectedProject = projects.find((p) => p._id === projectId);
  const members = (
    delegateOnly && task && typeof task.project === 'object'
      ? (task.project as Project).members
      : selectedProject?.members
  ) as User[] || [];

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateOnly && (!title.trim() || !projectId || !dueDate)) {
      toast.error('All required fields must be filled.');
      return;
    }
    if (!delegateOnly) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(dueDate) < today) {
        toast.error('Please select a valid deadline.');
        return;
      }
    }
    const originalAssignee = task?.assignedTo ? (task.assignedTo as User)._id : '';
    if (task && task.status === 'Completed' && assignedTo !== originalAssignee) {
      toast.error('Completed tasks cannot be reassigned.');
      return;
    }
    setLoading(true);
    try {
      if (task && delegateOnly) {
        await tasksApi.update(task._id, {
          status,
          assignedTo: assignedTo || undefined,
        });
        toast.success('Task reassigned');
      } else if (task) {
        await tasksApi.update(task._id, {
          title,
          description,
          assignedTo: assignedTo || undefined,
          dueDate,
          priority,
          status,
        });
        toast.success('Task updated');
      } else {
        await tasksApi.create({
          title,
          description,
          project: projectId,
          assignedTo: assignedTo || undefined,
          dueDate,
          priority,
        });
        toast.success('Task created');
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {delegateOnly ? 'Reassign Task' : task ? 'Edit Task' : 'New Task'}
        </h2>
        {delegateOnly && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Delegate this task to another project member or update its status.
          </p>
        )}
        <form onSubmit={handle} className="space-y-4">
          {!delegateOnly && (
            <>
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details"
                />
              </div>
            </>
          )}
          {!task && !delegateOnly && (
            <div>
              <label className="label">Project *</label>
              <select
                className="input"
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setAssignedTo(''); }}
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Assign To</label>
            <select
              className="input"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {!delegateOnly && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Due Date *</label>
                <input
                  type="date"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          )}
          {task && (
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Saving…' : delegateOnly ? 'Save' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
