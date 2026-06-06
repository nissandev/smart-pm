import type { Project, User } from '../types';

export function getProjectOwnerId(project: Project): string | undefined {
  const createdBy = project.createdBy;
  if (!createdBy) return undefined;
  return typeof createdBy === 'object' ? createdBy._id : String(createdBy);
}

/** PM who leads day-to-day management (full project control). */
export function getProjectLeadId(project: Project | undefined): string | undefined {
  if (!project) return undefined;
  if (project.leadId) {
    return typeof project.leadId === 'object' ? project.leadId._id : String(project.leadId);
  }
  const owner = project.createdBy;
  if (typeof owner === 'object' && owner.role === 'project_manager') {
    return owner._id;
  }
  return undefined;
}

export function isProjectLead(project: Project, me: User | null | undefined): boolean {
  if (!me) return false;
  const leadId = getProjectLeadId(project);
  return !!leadId && leadId === me._id;
}

/** Admin or PM project lead — full manage access. */
export function canManageProject(project: Project, me: User | null | undefined): boolean {
  if (!me) return false;
  if (me.role === 'admin') return true;
  return isProjectLead(project, me);
}

/** @deprecated use canManageProject */
export function isProjectOwner(project: Project, me: User | null | undefined): boolean {
  return canManageProject(project, me);
}

export function canRemoveProjectMember(
  project: Project,
  member: User,
  me: User | null | undefined,
): boolean {
  if (!me || member._id === me._id) return false;
  const ownerId = getProjectOwnerId(project);
  if (member._id === ownerId) return false;
  if (me.role === 'admin') return true;
  return isProjectLead(project, me);
}
