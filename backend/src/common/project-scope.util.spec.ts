import { Types } from 'mongoose';
import { UserRole } from '../users/user.schema';
import {
  buildProjectScopeFilter,
  buildTaskScopeFilter,
  userObjectId,
} from './project-scope.util';

const memberId = new Types.ObjectId();
const pmId = new Types.ObjectId();
const projectA = new Types.ObjectId();
const projectB = new Types.ObjectId();

describe('project-scope.util', () => {
  describe('userObjectId', () => {
    it('returns ObjectId instances unchanged', () => {
      expect(userObjectId({ _id: memberId }).equals(memberId)).toBe(true);
    });

    it('coerces string ids', () => {
      const id = userObjectId({ _id: memberId.toString() });
      expect(id.equals(memberId)).toBe(true);
    });
  });

  describe('buildTaskScopeFilter', () => {
    it('scopes members to assigned tasks only', () => {
      const filter = buildTaskScopeFilter(
        { _id: memberId, role: UserRole.MEMBER },
        [projectA, projectB],
      );
      expect(filter).toEqual({ assignedTo: memberId });
    });

    it('does not fall back to project scope when role is member', () => {
      const filter = buildTaskScopeFilter(
        { _id: memberId, role: UserRole.MEMBER },
        [projectA],
      );
      expect(filter).not.toHaveProperty('project');
      expect(filter).not.toHaveProperty('$or');
    });

    it('returns empty project filter for unknown roles with no projects', () => {
      const filter = buildTaskScopeFilter(
        { _id: memberId, role: undefined as unknown as UserRole },
        [],
      );
      expect(filter).toEqual({ project: { $in: [] } });
    });
  });

  describe('buildProjectScopeFilter', () => {
    it('scopes members to projects they belong to', () => {
      const filter = buildProjectScopeFilter({ _id: memberId, role: UserRole.MEMBER });
      expect(filter).toEqual({ members: memberId });
    });

    it('scopes PMs to led or created projects', () => {
      const filter = buildProjectScopeFilter({ _id: pmId, role: UserRole.PROJECT_MANAGER });
      expect(filter).toEqual({ $or: [{ leadId: pmId }, { createdBy: pmId }] });
    });
  });
});
