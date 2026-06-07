import { Types } from 'mongoose';
import { UserDocument, UserRole } from '../users/user.schema';

/** MongoDB filter for projects visible to the given user (role-scoped). */
export function buildProjectScopeFilter(user: UserDocument): Record<string, unknown> {
  const userId = (user as any)._id;
  if (user.role === UserRole.ADMIN) return {};
  if (user.role === UserRole.PROJECT_MANAGER) {
    return { $or: [{ leadId: userId }, { createdBy: userId }] };
  }
  return { members: userId };
}

/** Task filter scoped to accessible projects (admin / PM / member). */
export function buildTaskScopeFilter(
  user: UserDocument,
  projectIds: Types.ObjectId[],
): Record<string, unknown> {
  if (user.role === UserRole.ADMIN) return {};
  if (user.role === UserRole.MEMBER) {
    return { assignedTo: (user as any)._id };
  }
  if (user.role === UserRole.PROJECT_MANAGER) {
    const userId = (user as any)._id;
    const or: Record<string, unknown>[] = [{ assignedTo: userId }];
    if (projectIds.length > 0) {
      or.push({ project: { $in: projectIds } });
    }
    return { $or: or };
  }
  if (projectIds.length === 0) {
    return { project: { $in: [] } };
  }
  return { project: { $in: projectIds } };
}
