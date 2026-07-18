import type { UserRole } from '@prisma/client';

/**
 * Table-driven authorization matrix (deny-by-default).
 * Actions not listed are denied.
 */
export type AuthzAction =
  | 'auth.me'
  | 'auth.logout'
  | 'auth.logout_all'
  | 'media.upload'
  | 'media.read_own'
  | 'media.read_any'
  | 'media.delete_own'
  | 'media.delete_any'
  | 'location.create'
  | 'location.read_exact_own'
  | 'location.read_exact_any'
  | 'location.read_public'
  | 'admin.assign_role';

export const AUTHORIZATION_MATRIX: Record<
  AuthzAction,
  ReadonlyArray<UserRole | '*'>
> = {
  'auth.me': ['*'],
  'auth.logout': ['*'],
  'auth.logout_all': ['*'],
  'media.upload': ['*'],
  'media.read_own': ['*'],
  'media.read_any': ['ADMIN'],
  'media.delete_own': ['*'],
  'media.delete_any': ['ADMIN'],
  'location.create': ['*'],
  'location.read_exact_own': ['*'],
  'location.read_exact_any': ['ADMIN'],
  'location.read_public': ['*'],
  'admin.assign_role': ['ADMIN'],
};

export function matrixAllows(
  action: AuthzAction,
  roles: readonly UserRole[],
): boolean {
  const allowed = AUTHORIZATION_MATRIX[action];
  if (!allowed) return false;
  if (allowed.includes('*')) return true;
  return roles.some((r) => allowed.includes(r));
}
