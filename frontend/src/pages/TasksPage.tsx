import { useState, useMemo, useEffect, useCallback, memo, lazy, Suspense, useRef, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Plus, Trash2, Edit2, ChevronRight, Calendar,
  Search, ArrowUpDown, LayoutGrid, List, Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';
import { tasksApi, projectsApi, usersApi, groupsApi } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PageHeader, EmptyState, PriorityBadge,
  ConfirmModal, Avatar, Spinner, AssigneePicker,
} from '../components/shared';
import type { Task, TaskPriority, TaskStatus, Project, User, TeamGroup } from '../types';
import { canChangeTaskStatus, getTaskEditMode } from '../utils/taskPermissions';
import { invalidateTaskQueries } from '../utils/invalidateTaskQueries';
import { TaskKanbanBoard } from '../components/tasks/TaskKanbanBoard';

// Lazy-load heavy modals — not needed until user opens them
const TaskFormModal = lazy(() =>
  import('../components/tasks/TaskFormModal').then((m) => ({ default: m.TaskFormModal })),
);
const BulkTaskImportModal = lazy(() =>
  import('../components/tasks/BulkTaskImportModal').then((m) => ({ default: m.BulkTaskImportModal })),
);

type ViewMode = 'board' | 'list';

export default function TasksPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: me } = useAuthStore();
  const canManage = me?.role !== 'member';
  const canUseGroups = me?.role === 'admin' || me?.role === 'project_manager';

  // ── Filter / sort state ────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  // ── Modal state ────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  // ── Virtual list container ref ─────────────────────────────────
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Debounce search — defer API call until user stops typing
  const deferredSearch = useDeferredValue(search);

  // Scroll list to top whenever filters change
  useEffect(() => {
    listContainerRef.current?.scrollTo({ top: 0 });
  }, [statusFilter, priorityFilter, projectFilter, assigneeFilter, createdByFilter, deadlineFilter, deferredSearch, sortBy]);

  // All filters go to the server — no client-side filtering
  const serverFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (viewMode === 'list' && statusFilter) f.status = statusFilter;
    if (priorityFilter) f.priority = priorityFilter;
    if (projectFilter) f.project = projectFilter;
    if (assigneeFilter) f.assignedTo = assigneeFilter;
    if (createdByFilter) f.createdBy = createdByFilter;
    if (deferredSearch.trim()) f.search = deferredSearch.trim();
    if (deadlineFilter) f.deadline = deadlineFilter;
    if (sortBy) f.sort = sortBy;
    return f;
  }, [viewMode, statusFilter, priorityFilter, projectFilter, assigneeFilter, createdByFilter, deferredSearch, deadlineFilter, sortBy]);

  // ── Queries ────────────────────────────────────────────────────
  const { data: tasks = [], isLoading, isFetching } = useQuery({
    queryKey: ['tasks', serverFilters],
    queryFn: ({ signal }) => tasksApi.getAll(serverFilters, signal),
    placeholderData: keepPreviousData,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: ({ signal }) => projectsApi.getAll(undefined, signal),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: ({ signal }) => groupsApi.getAll(signal).then((r) => r.data),
    enabled: canUseGroups,
  });

  const isAdmin = me?.role === 'admin';
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: ({ signal }) => usersApi.getAll(undefined, signal),
    enabled: isAdmin,
  });

  const assigneeOptions: User[] = useMemo(() => {
    if (isAdmin) return allUsers as User[];
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
      invalidateTaskQueries(qc);
      setDeleting(null);
      toast.success('Task deleted');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to delete task'),
  });

  // ── Stable callbacks ───────────────────────────────────────────
  const handleStatusChange = useCallback(
    (task: Task, status: TaskStatus, opts?: { silent?: boolean }) => {
      const queryKey = ['tasks', serverFilters] as const;
      const previous = qc.getQueryData<Task[]>(queryKey);
      qc.setQueryData<Task[]>(queryKey, (old) =>
        old?.map((t) => (t._id === task._id ? { ...t, status } : t)),
      );
      tasksApi
        .update(task._id, { status })
        .then(() => {
          invalidateTaskQueries(qc);
          if (!opts?.silent) toast.success('Status updated');
        })
        .catch((e: any) => {
          if (previous) qc.setQueryData(queryKey, previous);
          toast.error(e?.response?.data?.message || 'Failed to update status');
        });
    },
    [qc, serverFilters],
  );

  const handleKanbanStatusChange = useCallback(
    (task: Task, status: TaskStatus) => handleStatusChange(task, status, { silent: true }),
    [handleStatusChange],
  );

  const handleNavigateTask = useCallback(
    (task: Task) => navigate(`/tasks/${task._id}`),
    [navigate],
  );
  const handleEditTask = useCallback((task: Task) => setEditing(task), []);
  const handleDeleteTask = useCallback((task: Task) => setDeleting(task), []);

  // All filtering/sorting is now server-side — tasks array is already the final result
  const filtered = tasks;

  // ── Virtual list — renders only visible rows, handles 200+ tasks ──
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  // ── Initial load ───────────────────────────────────────────────
  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${filtered.length} task${filtered.length !== 1 ? 's' : ''}`}
        action={
          canManage ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn-secondary flex items-center gap-2 text-sm"
                onClick={() => setShowBulkImport(true)}
              >
                <Upload className="w-4 h-4" /> Bulk import
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="w-4 h-4" /> New Task
              </button>
            </div>
          ) : undefined
        }
      />

      {/* View toggle + filters */}
      <div className="space-y-2.5 mb-5">

        {/* Row 1: view toggle + search (always full-width) */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 dark:border-white/[0.08] p-0.5 bg-slate-100/80 dark:bg-white/[0.04] flex-shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-white/[0.08] text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-white/[0.08] text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" /> List
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Row 2: filter selects — horizontal scroll on mobile, wrap on desktop */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {viewMode === 'list' && (
            <select
              className="input !w-auto flex-shrink-0 text-xs py-2 min-w-[110px] sm:w-[130px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          )}
          <select
            className="input !w-auto flex-shrink-0 text-xs py-2 min-w-[110px] sm:w-[130px]"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            className="input !w-auto flex-shrink-0 text-xs py-2 min-w-[120px] sm:w-[140px]"
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value)}
          >
            <option value="">All Deadlines</option>
            <option value="upcoming">Upcoming (7d)</option>
            <option value="overdue">Overdue</option>
          </select>
          <select
            className="input !w-auto flex-shrink-0 text-xs py-2 min-w-[130px] sm:w-[160px]"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <select
            className="input !w-auto flex-shrink-0 text-xs py-2 min-w-[120px] sm:w-[150px]"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">All Members</option>
            {assigneeOptions.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
          {isAdmin && (
            <select
              className="input !w-auto flex-shrink-0 text-xs py-2 min-w-[120px] sm:w-[150px]"
              value={createdByFilter}
              onChange={(e) => setCreatedByFilter(e.target.value)}
            >
              <option value="">All Creators</option>
              {(allUsers as User[]).map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          )}
          <div className="relative flex-shrink-0">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              className="input !w-auto pl-8 text-xs py-2 min-w-[145px] sm:w-[165px]"
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
      </div>

      {/* Task board / list */}
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
      ) : viewMode === 'board' ? (
        <TaskKanbanBoard
          tasks={filtered}
          me={me}
          sortBy={sortBy}
          isFetching={isFetching}
          onStatusChange={handleKanbanStatusChange}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onNavigate={handleNavigateTask}
        />
      ) : (
        /* Virtual list — only visible rows are in the DOM regardless of total count */
        <div className="relative">
          {isFetching && (
            <div className="absolute top-3 right-3 z-10">
              <Spinner size="sm" />
            </div>
          )}

          <div
            ref={listContainerRef}
            className={`overflow-auto transition-opacity duration-150 ${isFetching ? 'opacity-60' : ''}`}
            style={{ height: 'calc(100vh - 260px)', minHeight: '400px' }}
          >
            <div
              style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const task = filtered[virtualRow.index];
                return (
                  <div
                    key={task._id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: '8px',
                    }}
                  >
                    <TaskRow
                      task={task}
                      me={me}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onClick={handleNavigateTask}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals — lazy-loaded, zero cost until first open */}
      {(showCreate || editing) && (
        <Suspense fallback={null}>
          <TaskFormModal
            scope="global"
            task={editing}
            projects={projects}
            groups={groups}
            delegateOnly={editing ? getTaskEditMode(editing, me) === 'delegate' : false}
            onClose={() => { setShowCreate(false); setEditing(null); }}
            onSuccess={() => {
              invalidateTaskQueries(qc);
              setShowCreate(false);
              setEditing(null);
            }}
          />
        </Suspense>
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

      {showBulkImport && (
        <Suspense fallback={null}>
          <BulkTaskImportModal
            onClose={() => setShowBulkImport(false)}
            onSuccess={() => invalidateTaskQueries(qc)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────
const TaskRow = memo(function TaskRow({
  task,
  me,
  onEdit,
  onDelete,
  onClick,
  onStatusChange,
}: {
  task: Task;
  me: User | null | undefined;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onClick: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const editMode = getTaskEditMode(task, me);
  const statusEditable = canChangeTaskStatus(task, me);
  const overdue = task.status !== 'Completed' && isPast(new Date(task.dueDate));
  const projectName =
    typeof task.project === 'object' ? (task.project as Project).name : '';

  return (
    <div
      className="card px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onClick(task)}
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
        <select
          className={`text-xs border rounded-full px-2.5 py-0.5 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors appearance-none ${
            statusEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
          } ${
            task.status === 'Todo'
              ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.06] dark:text-slate-400 dark:border-white/[0.08]'
              : task.status === 'In Progress'
              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20'
          }`}
          value={task.status}
          disabled={!statusEditable}
          onChange={(e) => onStatusChange(task, e.target.value as TaskStatus)}
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
              className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
              onClick={() => onEdit(task)}
              title={editMode === 'delegate' ? 'Reassign task' : 'Edit task'}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {editMode === 'full' && (
              <button
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                onClick={() => onDelete(task)}
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
});
