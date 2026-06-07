import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, tasksApi } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen, ConfirmModal } from '@/components/shared';
import { ProjectExpensesPanel } from '@/components/projects/ProjectExpensesPanel';
import {
  AddMemberModal,
  EditProjectModal,
  ProjectDetailHeader,
  ProjectDetailTabs,
  ProjectTasksPanel,
  ProjectTeamSidebar,
  SyncGroupModal,
  type ProjectDetailTab,
} from '@/components/projects/detail';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { useGroups, useProjectActivity, useProjectExpenseSummary, useProjectSyncPreview } from '@/hooks';
import { queryKeys } from '@/lib/query-keys';
import { toastApiError } from '@/lib/api-error';
import { invalidateProjectQueries, invalidateTaskQueries } from '@/lib/invalidate-queries';
import { canManageProject } from '@/utils/projectPermissions';
import { getTaskEditMode } from '@/utils/taskPermissions';
import type { Project, Task, TaskStatus, TeamGroup, User } from '@/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('tasks');
  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSyncGroup, setShowSyncGroup] = useState(false);
  const [removingMember, setRemovingMember] = useState<User | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const isAdminOrPM = me?.role === 'admin' || me?.role === 'project_manager';

  const { data: project, isLoading } = useQuery({
    queryKey: queryKeys.projects.detail(id!),
    queryFn: () => projectsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: queryKeys.tasks.list({ project: id! }),
    queryFn: () => tasksApi.getAll({ project: id! }),
    enabled: !!id,
  });

  const { data: groups = [] } = useGroups(isAdminOrPM && !!id);

  const linkedTeamId = project?.teamId
    ? typeof project.teamId === 'object'
      ? (project.teamId as TeamGroup)._id
      : String(project.teamId)
    : undefined;

  const canManage = project ? canManageProject(project, me) : me?.role === 'admin';

  const { data: syncPreview } = useProjectSyncPreview(id, linkedTeamId, !!id && !!linkedTeamId && canManage);

  const syncPendingCount = syncPreview
    ? syncPreview.toAdd.length +
      syncPreview.toRemove.length +
      (syncPreview.leadChange.wouldChange ? 1 : 0)
    : 0;
  const syncAvailable = !!syncPreview && !syncPreview.inSync;

  const { data: recentActivity = [] } = useProjectActivity(id, isAdminOrPM);
  const { data: expenseSummary } = useProjectExpenseSummary(id);

  const updateProjectMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.update(id!, data).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.projects.detail(id!), updated);
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      setShowEditProject(false);
      toast.success('Project updated');
    },
    onError: (err) => toastApiError(err, 'Failed to update project'),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (err) => toastApiError(err, 'Failed to delete project'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(taskId),
    onSuccess: () => {
      invalidateTaskQueries(qc, { projectId: id });
      setDeletingTask(null);
      toast.success('Task deleted');
    },
    onError: (err) => toastApiError(err, 'Failed to delete task'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => projectsApi.removeMember(id!, memberId),
    onSuccess: () => {
      invalidateProjectQueries(qc, id!);
      setRemovingMember(null);
      toast.success('Member removed');
    },
    onError: (err) => toastApiError(err, 'Failed to remove member'),
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setStatusUpdating(taskId);
    try {
      await tasksApi.update(taskId, { status: newStatus });
      invalidateTaskQueries(qc, { projectId: id, taskId });
      toast.success('Status updated');
    } catch (err) {
      toastApiError(err, 'Failed to update status');
    } finally {
      setStatusUpdating(null);
    }
  };

  const canChangeTaskStatus = (task: Task) => {
    if (me?.role === 'admin' || me?.role === 'project_manager') return true;
    return (task.assignedTo as User)?._id === me?._id;
  };

  if (isLoading) return <LoadingScreen />;
  if (!project || !id) {
    return <div className="text-center py-16 text-slate-400">Project not found</div>;
  }

  const members = project.members as User[];
  const linkedTeamName =
    project.teamId && typeof project.teamId === 'object'
      ? (project.teamId as TeamGroup).name
      : undefined;
  const showSyncButton = canManage && (!!linkedTeamId || groups.length > 0);
  const groupsForSync = (() => {
    const list = [...groups];
    if (project.teamId && typeof project.teamId === 'object') {
      const tid = (project.teamId as TeamGroup)._id;
      if (!list.some((g) => g._id === tid)) list.unshift(project.teamId as TeamGroup);
    }
    return list;
  })();

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'Todo').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    completed: tasks.filter((t) => t.status === 'Completed').length,
  };
  const progress =
    tasks.length > 0 ? Math.round((tasksByStatus.completed / tasks.length) * 100) : 0;

  const refreshProject = () => invalidateProjectQueries(qc, id);

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-5 transition-colors"
        onClick={() => navigate('/projects')}
      >
        <ArrowLeft className="w-4 h-4" /> Projects
      </button>

      <ProjectDetailHeader
        project={project}
        tasksCount={tasks.length}
        progress={progress}
        tasksByStatus={tasksByStatus}
        expenseSummary={expenseSummary}
        linkedTeamName={linkedTeamName}
        showSyncButton={showSyncButton}
        syncAvailable={syncAvailable}
        syncPendingCount={syncPendingCount}
        isAdminOrPM={isAdminOrPM}
        canManage={canManage}
        onEdit={() => setShowEditProject(true)}
        onDelete={() => setShowDeleteProject(true)}
        onSync={() => setShowSyncGroup(true)}
      />

      <ProjectDetailTabs
        activeTab={activeTab}
        taskCount={tasks.length}
        expenseTotal={expenseSummary?.total ?? 0}
        expenseCurrency={expenseSummary?.currency ?? 'USD'}
        canManage={canManage}
        onTabChange={setActiveTab}
        onAddTask={() => setShowCreateTask(true)}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {activeTab === 'tasks' ? (
            <ProjectTasksPanel
              tasks={tasks}
              filteredTasks={filteredTasks}
              tasksLoading={tasksLoading}
              canManage={canManage}
              currentUser={me}
              search={search}
              statusFilter={statusFilter}
              priorityFilter={priorityFilter}
              statusUpdating={statusUpdating}
              onSearchChange={setSearch}
              onStatusFilterChange={setStatusFilter}
              onPriorityFilterChange={setPriorityFilter}
              onAddTask={() => setShowCreateTask(true)}
              onEditTask={setEditingTask}
              onDeleteTask={setDeletingTask}
              onStatusChange={handleStatusChange}
              canChangeTaskStatus={canChangeTaskStatus}
            />
          ) : (
            <ProjectExpensesPanel projectId={project._id} canManage={canManage} embedded />
          )}
        </div>

        <ProjectTeamSidebar
          project={project}
          currentUser={me}
          recentActivity={recentActivity}
          showActivity={isAdminOrPM}
          showSyncButton={showSyncButton}
          syncAvailable={syncAvailable}
          syncPendingCount={syncPendingCount}
          canManage={canManage}
          onSync={() => setShowSyncGroup(true)}
          onAddMember={() => setShowAddMember(true)}
          onRemoveMember={setRemovingMember}
        />
      </div>

      {showEditProject && (
        <EditProjectModal
          project={project}
          loading={updateProjectMutation.isPending}
          onClose={() => setShowEditProject(false)}
          onSave={(data) => updateProjectMutation.mutate(data)}
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

      {showSyncGroup && (
        <SyncGroupModal
          projectId={id}
          projectTeamId={linkedTeamId}
          linkedTeamName={linkedTeamName}
          groups={groupsForSync}
          onClose={() => setShowSyncGroup(false)}
          onSuccess={() => {
            refreshProject();
            setShowSyncGroup(false);
          }}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          projectId={id}
          isAdmin={me?.role === 'admin'}
          canAssignLead={canManage}
          groups={groups}
          existingMemberIds={members.map((m) => m._id)}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => {
            refreshProject();
            setShowAddMember(false);
          }}
        />
      )}

      {showCreateTask && (
        <TaskFormModal
          scope="project"
          projectId={id}
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
          scope="project"
          projectId={id}
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
