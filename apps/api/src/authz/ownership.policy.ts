import { ForbiddenException } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import type { AuthContext } from './auth-context';

/**
 * Ownership policy foundation: owner OR admin may access; others denied.
 * Cleanup partner is not a global owner bypass.
 */
export function assertOwnerOrAdmin(
  auth: AuthContext,
  ownerId: string,
  message = 'Not allowed to access this resource',
): void {
  if (auth.user.id === ownerId) return;
  if (auth.roles.includes('ADMIN')) return;
  throw new ForbiddenException({
    code: 'FORBIDDEN',
    message,
  });
}

export function isOwner(auth: AuthContext, ownerId: string): boolean {
  return auth.user.id === ownerId;
}

export function hasRole(auth: AuthContext, role: UserRole): boolean {
  return auth.roles.includes(role);
}

/** Client-supplied role elevation is always rejected. */
export function rejectClientRoleAssignment(body: unknown): void {
  if (!body || typeof body !== 'object') return;
  const obj = body as Record<string, unknown>;
  if ('roles' in obj || 'role' in obj || 'status' in obj) {
    throw new ForbiddenException({
      code: 'ROLE_ESCALATION_REJECTED',
      message: 'roles and status cannot be set by clients',
    });
  }
}
