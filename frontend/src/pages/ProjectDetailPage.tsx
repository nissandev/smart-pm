import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, Trash2, UserMinus, Calendar, Edit2,
  Search, Clock, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { projectsApi, tasksApi, usersApi, activityApi, groupsApi } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, ProjectStatusBadge, PriorityBadge,
  ConfirmModal, Avatar, EmptyState, Spinner, AssigneePicker,
} from '../components/shared';
import type { Project, Task, TaskPriority, TaskStatus, User, ProjectStatus, Activity, TeamGroup } from '../types';
import { getTaskEditMode } from '../utils/taskPermissions';
import { invalidateTaskQueries } from '../utils/invalidateTaskQueries';
import { getTaskAssigneePool } from '../utils/taskAssignees';
import {
  canManageProject, canRemoveProjectMember, getProjectLeadId, getProjectOwnerId,
} from '../utils/projectPermissions';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me } = useAuthStore();

  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<User | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // ── Queries ────────────────────────────────────────────────────
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', { project: id }],
    queryFn: () => tasksApi.getAll({ project: id! }).then((r) => r.data),
    enabled: !!id,
  });

  const isAdminOrPM = me?.role === 'admin' || me?.role === 'project_manager';

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.getAll().then((r) => r.data),
    enabled: isAdminOrPM,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['activity', 'project', id],
    queryFn: () => activityApi.getRecent(8, id).then((r) => r.data),
    enabled: !!id && isAdminOrPM,
  });

  // ── Mutations ──────────────────────────────────────────────────
  const updateProjectMutation = useMutation({
    mutationFn: (data: Partial<Project>) =>
      projectsApi.update(id!, data).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(['project', id], updated);
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowEditProject(false);
      toast.success('Project updated');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to update project'),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to delete project'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(taskId),
    onSuccess: () => {
      invalidateTaskQueries(qc, { projectId: id });
      setDeletingTask(null);
      toast.success('Task deleted');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to delete task'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => projectsApi.removeMember(id!, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['activity', 'project', id] });
      setRemovingMember(null);
      toast.success('Member removed');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to remove member'),
  });

  // ── Permissions ────────────────────────────────────────────────
  const canManage = project ? canManageProject(project, me) : me?.role === 'admin';

  const canChangeTaskStatus = (task: Task) => {
    if (me?.role === 'admin' || me?.role === 'project_manager') return true;
    return (task.assignedTo as User)?._id === me?._id;
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setStatusUpdating(taskId);
    try {
      await tasksApi.update(taskId, { status: newStatus });
      invalidateTaskQueries(qc, { projectId: id });
      toast.success('Status updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusUpdating(null);
    }
  };

  // ── Filtered tasks ─────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  // ── Render ─────────────────────────────────────────────────────
  if (isLoading) return <LoadingScreen />;
  if (!project) return (
    <div className="text-center py-16 text-slate-400">Project not found</div>
  );

  const members = project.members as User[];
  const projectOwnerId = getProjectOwnerId(project);
  const projectLeadId = getProjectLeadId(project);
  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'Todo').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    completed: tasks.filter((t) => t.status === 'Completed').length,
  };
  const progress =
    tasks.length > 0
      ? Math.round((tasksByStatus.completed / tasks.length) * 100)
      : 0;

  const deadlineColor = isPast(new Date(project.deadline))
    ? 'text-red-500'
    : Date.now() > new Date(project.deadline).getTime() - 2 * 86400000
    ? 'text-amber-500'
    : 'text-slate-500 dark:text-slate-400';

  return (
    <div>
      {/* Back */}
      <button
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-5 transition-colors"
        onClick={() => navigate('/projects')}
      >
        <ArrowLeft className="w-4 h-4" /> Projects
      </button>

      {/* Project header */}
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <ProjectStatusBadge status={project.status} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {project.description}
              </p>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                onClick={() => setShowEditProject(true)}
                title="Edit project"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                onClick={() => setShowDeleteProject(true)}
                title="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className={`flex items-center gap-1.5 font-medium ${deadlineColor}`}>
            <Calendar className="w-3.5 h-3.5" />
            Deadline: {format(new Date(project.deadline), 'MMM d, yyyy')}
            {isPast(new Date(project.deadline)) && (
              <span className="ml-1 text-red-500 font-semibold">· Overdue</span>
            )}
          </span>
          <span className="text-slate-400">{tasks.length} tasks</span>
          <span className="text-slate-400">{members.length} members</span>
          {typeof project.createdBy === 'object' && project.createdBy && (
            <span className="text-slate-400">
              Owner: {(project.createdBy as User).name}
            </span>
          )}
          {project.leadId && typeof project.leadId === 'object' && (
            <span className="text-slate-400">
              Lead: {(project.leadId as User).name}
            </span>
          )}
          {project.teamId && typeof project.teamId === 'object' && (
            <span className="text-slate-400">
              Team: {(project.teamId as TeamGroup).name}
            </span>
          )}
        </div>

        {tasks.length > 0 && (
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

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Tasks panel */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Tasks</h2>
            {canManage && (
              <button
                className="btn-primary text-xs py-1.5 flex items-center gap-1"
                onClick={() => setShowCreateTask(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                className="input pl-8 py-1.5 text-xs"
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input py-1.5 text-xs w-auto min-w-[110px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <select
              className="input py-1.5 text-xs w-auto min-w-[110px]"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Task list */}
          {tasksLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description="Add the first task to get started"
              action={
                canManage ? (
                  <button className="btn-primary" onClick={() => setShowCreateTask(true)}>
                    Add Task
                  </button>
                ) : undefined
              }
            />
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">
              No tasks match your filters
            </div>
          ) : (
            <>
              {filteredTasks.map((task) => (
                <div key={task._id} className="card px-4 py-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    {/* Clickable left area → task detail */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/tasks/${task._id}`)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate">
                          {task.title}
                        </p>
                        <PriorityBadge priority={task.priority as TaskPriority} />
                      </div>
                      {task.dueDate && (
                        <span
                          className={`flex items-center gap-1 text-xs mt-0.5 ${
                            task.status !== 'Completed' && isPast(new Date(task.dueDate))
                              ? 'text-red-400'
                              : 'text-slate-400'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.dueDate), 'MMM d, yyyy')}
                          {task.status !== 'Completed' && isPast(new Date(task.dueDate)) && (
                            <span className="font-medium"> · Overdue</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Right controls */}
                    <div
                      className="flex items-center gap-2 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Inline status select */}
                      {statusUpdating === task._id ? (
                        <Spinner size="sm" />
                      ) : (
                        <select
                          className={`text-xs border rounded-full px-2.5 py-0.5 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors appearance-none ${
                            task.status === 'Todo'
                              ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              : task.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                          } ${!canChangeTaskStatus(task) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          value={task.status}
                          disabled={!canChangeTaskStatus(task)}
                          onChange={(e) =>
                            handleStatusChange(task._id, e.target.value as TaskStatus)
                          }
                        >
                          <option value="Todo">Todo</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      )}

                      {/* Assignee avatar */}
                      {task.assignedTo && (
                        <div title={(task.assignedTo as User).name}>
                          <Avatar name={(task.assignedTo as User).name} size="sm" />
                        </div>
                      )}

                      {/* Edit / delete — full for owners; delegate (reassign) for assignee PMs */}
                      {(() => {
                        const mode = getTaskEditMode(task, me);
                        if (mode === 'none') return null;
                        return (
                          <>
                            <button
                              className="p-1 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
                              onClick={() => setEditingTask(task)}
                              title={mode === 'delegate' ? 'Reassign task' : 'Edit task'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {mode === 'full' && (
                              <button
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                onClick={() => setDeletingTask(task)}
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}

              {(search || statusFilter || priorityFilter) && (
                <p className="text-xs text-slate-400 text-center">
                  Showing {filteredTasks.length} of {tasks.length} tasks
                </p>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Members
                <span className="text-slate-400 font-normal">{members.length}</span>
              </h2>
              {canManage && (
                <button
                  className="btn-secondary text-xs py-1.5 flex items-center gap-1"
                  onClick={() => setShowAddMember(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
            <div className="card divide-y divide-slate-100 dark:divide-slate-700/50">
              {members.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No members yet</p>
              ) : (
                members.map((m) => (
                  <div key={m._id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {m.name}
                      </p>
                      <p className="text-xs text-slate-400 capitalize flex items-center gap-1.5">
                        <span>{m.role?.replace('_', ' ')}</span>
                        {m._id === projectOwnerId && (
                          <span className="text-purple-600 dark:text-purple-400 font-medium">· Owner</span>
                        )}
                        {m._id === projectLeadId && (
                          <span className="text-brand-600 dark:text-brand-400 font-medium">· Lead</span>
                        )}
                      </p>
                    </div>
                    {canRemoveProjectMember(project, m, me) && (
                      <button
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        onClick={() => setRemovingMember(m)}
                        title="Remove member"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity (admin / PM only) */}
          {isAdminOrPM && (
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-3">
                <Clock className="w-4 h-4" />
                Recent Activity
              </h2>
              <div className="card p-4">
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {(recentActivity as Activity[]).map((a) => (
                      <div key={a._id} className="flex gap-2.5">
                        <Avatar name={(a.actor as User)?.name || '?'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                            {a.description}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}

      {showEditProject && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditProject(false)}
          onSave={(data) => updateProjectMutation.mutate(data)}
          loading={updateProjectMutation.isPending}
        />
      )}

      {showDeleteProject && (
        <ConfirmModal
          title="Delete Project"
          description={`Delete "${project.name}"? All tasks in this project will also be permanently deleted. This cannot be undone.`}
          onConfirm={() => deleteProjectMutation.mutate()}
          onCancel={() => setShowDeleteProject(false)}
          loading={deleteProjectMutation.isPending}
          variant="danger"
        />
      )}

      {showAddMember && (
        <AddMemberModal
          projectId={id!}
          isAdmin={me?.role === 'admin'}
          canAssignLead={canManage}
          groups={groups}
          existingMemberIds={members.map((m) => m._id)}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['project', id] });
            qc.invalidateQueries({ queryKey: ['activity', 'project', id] });
            setShowAddMember(false);
          }}
        />
      )}

      {showCreateTask && (
        <TaskFormModal
          projectId={id!}
          members={members}
          groups={groups}
          onClose={() => setShowCreateTask(false)}
          onSuccess={() => {
            invalidateTaskQueries(qc, { projectId: id });
            setShowCreateTask(false);
          }}
        />
      )}

      {editingTask && (
        <TaskFormModal
          projectId={id!}
          members={members}
          groups={groups}
          task={editingTask}
          delegateOnly={getTaskEditMode(editingTask, me) === 'delegate'}
          onClose={() => setEditingTask(null)}
          onSuccess={() => {
            invalidateTaskQueries(qc, { projectId: id });
            setEditingTask(null);
          }}
        />
      )}

      {deletingTask && (
        <ConfirmModal
          title="Delete Task"
          description={`Delete "${deletingTask.title}"? This cannot be undone.`}
          onConfirm={() => deleteTaskMutation.mutate(deletingTask._id)}
          onCancel={() => setDeletingTask(null)}
          loading={deleteTaskMutation.isPending}
          variant="danger"
        />
      )}

      {removingMember && (
        <ConfirmModal
          title="Remove Member"
          description={`Remove ${removingMember.name} from this project? Their assigned tasks will remain.`}
          onConfirm={() => removeMemberMutation.mutate(removingMember._id)}
          onCancel={() => setRemovingMember(null)}
          loading={removeMemberMutation.isPending}
          variant="warning"
        />
      )}
    </div>
  );
}

// ── EditProjectModal ──────────────────────────────────────────────
function EditProjectModal({
  project, onClose, onSave, loading,
}: {
  project: Project;
  onClose: () => void;
  onSave: (data: Partial<Project>) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [deadline, setDeadline] = useState(project.deadline.slice(0, 10));
  const [status, setStatus] = useState<ProjectStatus>(project.status);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!deadline) { toast.error('Deadline is required'); return; }
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      deadline,
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Edit Project</h2>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Deadline *</label>
              <input
                type="date"
                className="input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TaskFormModal (create & edit) ─────────────────────────────────
function TaskFormModal({
  projectId, members, groups, task, delegateOnly = false, onClose, onSuccess,
}: {
  projectId: string;
  members: User[];
  groups: TeamGroup[];
  task?: Task;
  delegateOnly?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [teamGroupId, setTeamGroupId] = useState('');
  const [assignedTo, setAssignedTo] = useState(
    task?.assignedTo ? (task.assignedTo as User)._id : '',
  );
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'Medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'Todo');
  const [loading, setLoading] = useState(false);

  const selectedGroup = groups.find((g) => g._id === teamGroupId);
  const assigneePool = getTaskAssigneePool(members, selectedGroup);

  const handleTeamGroupChange = (id: string) => {
    setTeamGroupId(id);
    const group = groups.find((g) => g._id === id);
    const pool = getTaskAssigneePool(members, group);
    if (assignedTo && !pool.some((m) => m._id === assignedTo)) {
      setAssignedTo('');
    }
  };

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateOnly && (!title.trim() || !dueDate)) {
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
    if (isEdit && task!.status === 'Completed' && assignedTo !== originalAssignee) {
      toast.error('Completed tasks cannot be reassigned.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit && delegateOnly) {
        await tasksApi.update(task._id, {
          status,
          assignedTo: assignedTo || undefined,
        });
        toast.success('Task reassigned');
      } else {
        const payload: any = {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo: assignedTo || undefined,
          dueDate,
          priority,
        };
        if (isEdit) {
          payload.status = status;
          await tasksApi.update(task._id, payload);
          toast.success('Task updated');
        } else {
          payload.project = projectId;
          payload.status = 'Todo';
          await tasksApi.create(payload);
          toast.success('Task created');
        }
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} task`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {delegateOnly ? 'Reassign Task' : isEdit ? 'Edit Task' : 'Add Task'}
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
                  placeholder="Task title"
                  maxLength={150}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details…"
                />
              </div>
            </>
          )}
          {groups.length > 0 && (
            <div>
              <label className="label">Filter by group</label>
              <select
                className="input"
                value={teamGroupId}
                onChange={(e) => handleTeamGroupChange(e.target.value)}
              >
                <option value="">All project members</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Assign To</label>
            <AssigneePicker
              users={assigneePool}
              value={assignedTo}
              onChange={setAssignedTo}
            />
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
          {isEdit && (
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
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Spinner size="sm" />}
              {loading
                ? isEdit ? 'Saving…' : 'Creating…'
                : delegateOnly ? 'Save' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AddMemberModal ────────────────────────────────────────────────
function AddMemberModal({
  projectId, isAdmin, canAssignLead, groups, existingMemberIds, onClose, onSuccess,
}: {
  projectId: string;
  isAdmin: boolean;
  canAssignLead: boolean;
  groups: TeamGroup[];
  existingMemberIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [selectedId, setSelectedId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [makeLead, setMakeLead] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((r) => r.data),
    enabled: isAdmin,
  });

  const available = allUsers.filter((u) => !existingMemberIds.includes(u._id));
  const selectedUser = available.find((u) => u._id === selectedId);
  const canMakeLeadIndividual = canAssignLead && selectedUser?.role === 'project_manager';

  const selectedGroup = groups.find((g) => g._id === selectedGroupId);
  const groupNewCount = useMemo(() => {
    if (!selectedGroup) return 0;
    const existing = new Set(existingMemberIds);
    const leadId = typeof selectedGroup.leadId === 'object' ? selectedGroup.leadId._id : selectedGroup.leadId;
    const ids = new Set<string>([String(leadId)]);
    for (const m of selectedGroup.memberIds) ids.add(m._id);
    return [...ids].filter((id) => !existing.has(id)).length;
  }, [selectedGroup, existingMemberIds]);

  const canMakeLeadGroup = canAssignLead && !!selectedGroup;

  const handle = async () => {
    setLoading(true);
    try {
      if (mode === 'group') {
        if (!selectedGroupId) {
          toast.error('Select a group');
          return;
        }
        await projectsApi.addMembersFromGroup(projectId, selectedGroupId, {
          makeLead: canMakeLeadGroup && makeLead,
        });
        toast.success(
          makeLead && canMakeLeadGroup
            ? 'Group added and PM set as project lead'
            : 'Group members added',
        );
      } else {
        if (!selectedId) {
          toast.error('Select a user');
          return;
        }
        await projectsApi.addMember(projectId, selectedId, {
          makeLead: canMakeLeadIndividual && makeLead,
        });
        toast.success(
          makeLead && canMakeLeadIndividual
            ? 'Member added and set as project lead'
            : 'Member added',
        );
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    mode === 'group'
      ? !!selectedGroupId && groupNewCount > 0
      : !!selectedId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add Members</h2>

        <div className="flex gap-1 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'individual'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={() => { setMode('individual'); setMakeLead(false); }}
          >
            Individual
          </button>
          {groups.length > 0 && (
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'group'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              onClick={() => { setMode('group'); setMakeLead(false); setSelectedId(''); }}
            >
              From group
            </button>
          )}
        </div>

        {mode === 'individual' ? (
          available.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">All users are already members</p>
          ) : (
            <select
              className="input w-full mb-4"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setMakeLead(false);
              }}
            >
              <option value="">Select a user…</option>
              {available.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          )
        ) : (
          <>
            <select
              className="input w-full mb-2"
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setMakeLead(false);
              }}
            >
              <option value="">Select a group…</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
            {selectedGroup && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {groupNewCount > 0
                  ? `${groupNewCount} new member${groupNewCount !== 1 ? 's' : ''} will be added (already on project are skipped).`
                  : 'All members of this group are already on the project.'}
              </p>
            )}
          </>
        )}

        {((mode === 'individual' && canMakeLeadIndividual) || (mode === 'group' && canMakeLeadGroup)) && (
          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-slate-300"
              checked={makeLead}
              onChange={(e) => setMakeLead(e.target.checked)}
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {mode === 'group' ? 'Make group PM the project lead' : 'Make this PM the project lead'}
              <span className="block text-xs text-slate-400 mt-0.5">
                Full project control. The admin owner is unchanged.
              </span>
            </span>
          </label>
        )}

        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          {(mode === 'group' || available.length > 0) && (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handle}
              disabled={loading || !canSubmit}
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Adding…' : mode === 'group' ? 'Add Group' : 'Add Member'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
