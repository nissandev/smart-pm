import { Types } from 'mongoose';
import { UserDocument, UserRole } from '../users/user.schema';

type ScopeUser = Pick<UserDocument, 'role'> & { _id: unknown };

/** Normalize JWT/lean user ids for MongoDB queries. */
export function userObjectId(user: { _id: unknown }): Types.ObjectId {
  const id = user._id;
  if (id instanceof Types.ObjectId) return id;
  return new Types.ObjectId(String(id));
}

function userRole(user: ScopeUser): UserRole | undefined {
  const role = user.role as string | undefined;
  if (!role) return undefined;
  if (Object.values(UserRole).includes(role as UserRole)) {
    return role as UserRole;
  }
  return undefined;
}

/** MongoDB filter for projects visible to the given user (role-scoped). */
export function buildProjectScopeFilter(user: ScopeUser): Record<string, unknown> {
  const userId = userObjectId(user);
  const role = userRole(user);

  if (role === UserRole.ADMIN) return {};
  if (role === UserRole.PROJECT_MANAGER) {
    return { $or: [{ leadId: userId }, { createdBy: userId }] };
  }
  return { members: userId };
}

/** Task filter scoped to accessible projects (admin / PM / member). */
export function buildTaskScopeFilter(
  user: ScopeUser,
  projectIds: Types.ObjectId[],
): Record<string, unknown> {
  const role = userRole(user);

  if (role === UserRole.ADMIN) return {};
  if (role === UserRole.MEMBER) {
    return { assignedTo: userObjectId(user) };
  }
  if (role === UserRole.PROJECT_MANAGER) {
    const userId = userObjectId(user);
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
