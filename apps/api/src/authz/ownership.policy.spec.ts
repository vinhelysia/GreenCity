import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthContext } from './auth-context';
import {
  assertOwnerOrAdmin,
  rejectClientRoleAssignment,
} from './ownership.policy';

function ctx(partial: Partial<AuthContext> & { userId: string; roles: AuthContext['roles'] }): AuthContext {
  return {
    sessionId: 's1',
    roles: partial.roles,
    user: {
      id: partial.userId,
      roles: partial.roles,
    } as User,
  };
}

describe('ownership policy', () => {
  it('allows owner', () => {
    expect(() =>
      assertOwnerOrAdmin(ctx({ userId: 'u1', roles: ['USER'] }), 'u1'),
    ).not.toThrow();
  });

  it('allows admin on foreign resource', () => {
    expect(() =>
      assertOwnerOrAdmin(ctx({ userId: 'admin', roles: ['ADMIN'] }), 'u1'),
    ).not.toThrow();
  });

  it('denies stranger', () => {
    expect(() =>
      assertOwnerOrAdmin(ctx({ userId: 'u2', roles: ['USER'] }), 'u1'),
    ).toThrow(ForbiddenException);
  });

  it('rejects client role escalation fields', () => {
    expect(() => rejectClientRoleAssignment({ roles: ['ADMIN'] })).toThrow(
      ForbiddenException,
    );
    expect(() => rejectClientRoleAssignment({ status: 'DISABLED' })).toThrow(
      ForbiddenException,
    );
    expect(() => rejectClientRoleAssignment({ email: 'a@b.com' })).not.toThrow();
  });
});
