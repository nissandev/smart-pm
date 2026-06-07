import { ForbiddenException } from '@nestjs/common';
import { ProjectDocument } from '../projects/project.schema';
import { UserDocument, UserRole } from '../users/user.schema';
import { isProjectLead } from '../projects/project-lead.util';

export function getUserObjectId(user: UserDocument): string {
  return (user as any)._id?.toString?.() ?? String((user as any)._id);
}

/** Member, lead, or admin may view project-scoped resources. */
export function assertProjectAccess(project: ProjectDocument, user: UserDocument): void {
  if (user.role === UserRole.ADMIN) return;
  const userId = getUserObjectId(user);
  const isMember = project.members.some(
    (m: any) => m._id?.toString() === userId || m.toString() === userId,
  );
  if (!isMember && !isProjectLead(project, userId)) {
    throw new ForbiddenException('Access denied');
  }
}

/** Only project lead or admin may manage project resources. */
export function assertProjectLeadOrAdmin(project: ProjectDocument, user: UserDocument): void {
  if (user.role === UserRole.ADMIN) return;
  if (!isProjectLead(project, getUserObjectId(user))) {
    throw new ForbiddenException('Only the project lead or admin can perform this action');
  }
}
