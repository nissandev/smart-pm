import { UserRole } from '../users/user.schema';

/** Resolves the PM who leads day-to-day project management. */
export function getProjectLeadId(project: {
  leadId?: { _id?: unknown } | string | { toString(): string } | null;
  createdBy?: { _id?: unknown; role?: UserRole } | string | { toString(): string } | null;
}): string | undefined {
  const lead = project.leadId as any;
  if (lead) {
    return (lead._id ?? lead).toString();
  }
  const creator = project.createdBy as any;
  if (!creator) return undefined;
  const creatorId = (creator._id ?? creator).toString();
  const creatorRole = typeof creator === 'object' ? creator.role : undefined;
  if (creatorRole === UserRole.PROJECT_MANAGER) {
    return creatorId;
  }
  return undefined;
}

export function isProjectLead(
  project: Parameters<typeof getProjectLeadId>[0],
  userId: string,
): boolean {
  const leadId = getProjectLeadId(project);
  return !!leadId && leadId === userId;
}
