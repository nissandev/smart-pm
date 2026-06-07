import { useState } from 'react';
import toast from 'react-hot-toast';
import { tasksApi } from '@/services';
import { AssigneePicker, Spinner } from '@/components/shared';
import { getTaskAssigneePool } from '@/utils/taskAssignees';
import { toastApiError } from '@/lib/api-error';
import type { Project, Task, TaskPriority, TaskStatus, TeamGroup, User } from '@/types';

export type TaskFormModalProps = {
  task?: Task | null;
  groups: TeamGroup[];
  delegateOnly?: boolean;
  onClose: () => void;
  onSuccess: () => void;
} & (
  | { scope: 'project'; projectId: string; members: User[] }
  | { scope: 'global'; projects: Project[] }
);

export function TaskFormModal({
  task,
  groups,
  delegateOnly = false,
  onClose,
  onSuccess,
  ...scopeProps
}: TaskFormModalProps) {
  const isEdit = !!task;
  const fixedProject = scopeProps.scope === 'project';

  const initialProjectId = task
    ? typeof task.project === 'object'
      ? (task.project as Project)._id
      : (task.project as string)
    : fixedProject
      ? scopeProps.projectId
      : scopeProps.projects[0]?._id ?? '';

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [projectId, setProjectId] = useState(initialProjectId);
  const [teamGroupId, setTeamGroupId] = useState('');
  const [assignedTo, setAssignedTo] = useState(
    task?.assignedTo ? (task.assignedTo as User)._id : '',
  );
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'Medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'Todo');
  const [loading, setLoading] = useState(false);

  const selectedProject =
    scopeProps.scope === 'global'
      ? scopeProps.projects.find((p) => p._id === projectId)
      : undefined;

  const members = (
    delegateOnly && task && typeof task.project === 'object'
      ? (task.project as Project).members
      : fixedProject
        ? scopeProps.members
        : selectedProject?.members
  ) as User[] | undefined;

  const memberList = members ?? [];
  const selectedGroup = groups.find((g) => g._id === teamGroupId);
  const assigneePool = getTaskAssigneePool(memberList, selectedGroup);

  const handleTeamGroupChange = (id: string) => {
    setTeamGroupId(id);
    const group = groups.find((g) => g._id === id);
    const pool = getTaskAssigneePool(memberList, group);
    if (assignedTo && !pool.some((m) => m._id === assignedTo)) {
      setAssignedTo('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveProjectId = fixedProject ? scopeProps.projectId : projectId;

    if (!delegateOnly && (!title.trim() || !dueDate || (!isEdit && !effectiveProjectId))) {
      toast.error('All required fields must be filled.');
      return;
    }
    if (!delegateOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
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
        await tasksApi.update(task!._id, {
          status,
          assignedTo: assignedTo || undefined,
        });
        toast.success('Task reassigned');
      } else if (isEdit) {
        await tasksApi.update(task!._id, {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo: assignedTo || undefined,
          dueDate,
          priority,
          status,
        });
        toast.success('Task updated');
      } else {
        await tasksApi.create({
          title: title.trim(),
          description: description.trim() || undefined,
          project: effectiveProjectId,
          assignedTo: assignedTo || undefined,
          dueDate,
          priority,
        });
        toast.success('Task created');
      }
      onSuccess();
    } catch (err) {
      toastApiError(err, `Failed to ${isEdit ? 'update' : 'create'} task`);
    } finally {
      setLoading(false);
    }
  };

  const titleLabel = delegateOnly
    ? 'Reassign Task'
    : isEdit
      ? 'Edit Task'
      : fixedProject
        ? 'Add Task'
        : 'New Task';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{titleLabel}</h2>
        {delegateOnly && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Delegate this task to another project member or update its status.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {!isEdit && !delegateOnly && scopeProps.scope === 'global' && (
            <div>
              <label className="label">Project *</label>
              <select
                className="input"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setAssignedTo('');
                }}
              >
                <option value="">Select a project</option>
                {scopeProps.projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
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
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Assign To</label>
            <AssigneePicker users={assigneePool} value={assignedTo} onChange={setAssignedTo} />
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
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {loading
                ? 'Saving…'
                : delegateOnly
                  ? 'Save'
                  : isEdit
                    ? 'Save Changes'
                    : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
