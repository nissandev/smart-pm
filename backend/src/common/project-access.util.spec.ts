import { ForbiddenException } from '@nestjs/common';
import { assertProjectAccess, assertProjectLeadOrAdmin } from './project-access.util';
import { UserRole } from '../users/user.schema';

const admin = { role: UserRole.ADMIN, _id: 'admin1' } as any;
const member = { role: UserRole.MEMBER, _id: 'mem1' } as any;
const outsider = { role: UserRole.MEMBER, _id: 'other' } as any;
const pm = { role: UserRole.PROJECT_MANAGER, _id: 'pm1' } as any;

function project(overrides: Record<string, unknown> = {}) {
  return {
    members: ['mem1'],
    leadId: 'pm1',
    ...overrides,
  } as any;
}

describe('project-access.util', () => {
  it('allows admin without membership', () => {
    expect(() => assertProjectAccess(project({ members: [] }), admin)).not.toThrow();
  });

  it('allows project member', () => {
    expect(() => assertProjectAccess(project(), member)).not.toThrow();
  });

  it('denies outsider', () => {
    expect(() => assertProjectAccess(project(), outsider)).toThrow(ForbiddenException);
  });

  it('allows project lead to manage', () => {
    expect(() => assertProjectLeadOrAdmin(project(), pm)).not.toThrow();
  });

  it('denies member from managing', () => {
    expect(() => assertProjectLeadOrAdmin(project(), member)).toThrow(ForbiddenException);
  });
});
