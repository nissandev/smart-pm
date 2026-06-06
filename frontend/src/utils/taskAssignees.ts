import type { TeamGroup, User } from '../types';
import { filterMembersByGroup } from './groupMembers';

/** Users who can be assigned tasks (admins are project owners, not assignees). */
export function getTaskAssigneePool(
  members: User[],
  group?: TeamGroup,
): User[] {
  const pool = filterMembersByGroup(members, group).filter((m) => m.role !== 'admin');
  return [...pool].sort((a, b) => a.name.localeCompare(b.name));
}

export const ASSIGNEE_ROLE_LABELS: Record<'project_manager' | 'member', string> = {
  project_manager: 'Project Manager',
  member: 'Member',
};

export const ASSIGNEE_ROLE_STYLES: Record<'project_manager' | 'member', string> = {
  project_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
