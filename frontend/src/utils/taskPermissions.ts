import type { Project, Task, User } from '../types';

export type TaskEditMode = 'none' | 'full' | 'delegate';

export function getProjectOwnerId(project: Project | string | undefined): string | undefined {
  if (!project || typeof project === 'string') return undefined;
  const createdBy = project.createdBy;
  if (!createdBy) return undefined;
  return typeof createdBy === 'object' ? (createdBy as User)._id : String(createdBy);
}

export function getTaskEditMode(task: Task, me: User | null | undefined): TaskEditMode {
  if (!me) return 'none';
  if (me.role === 'admin') return 'full';

  const assigneeId =
    typeof task.assignedTo === 'object' ? task.assignedTo?._id : task.assignedTo;

  if (me.role === 'project_manager') {
    const project = typeof task.project === 'object' ? task.project : undefined;
    const ownerId = getProjectOwnerId(project);
    if (ownerId === me._id) return 'full';
    if (assigneeId === me._id) return 'delegate';
    return 'none';
  }

  return 'none';
}

export function canChangeTaskStatus(task: Task, me: User | null | undefined): boolean {
  if (!me) return false;
  if (me.role === 'admin') return true;
  if (me.role === 'project_manager') return getTaskEditMode(task, me) !== 'none';
  const assigneeId =
    typeof task.assignedTo === 'object' ? task.assignedTo?._id : task.assignedTo;
  return assigneeId === me._id;
}
