import type { TeamGroup, User } from '../types';

export function getGroupUserIds(group: TeamGroup): Set<string> {
  const ids = new Set<string>();
  const leadId = typeof group.leadId === 'object' ? group.leadId._id : group.leadId;
  if (leadId) ids.add(leadId);
  for (const m of group.memberIds || []) {
    const id = typeof m === 'object' ? m._id : m;
    if (id) ids.add(id);
  }
  return ids;
}

export function filterMembersByGroup(members: User[], group: TeamGroup | undefined): User[] {
  if (!group) return members;
  const allowed = getGroupUserIds(group);
  return members.filter((m) => allowed.has(m._id));
}
