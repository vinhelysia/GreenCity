import type { User } from '@prisma/client';
import type { PublicUser } from '@greencity/shared';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    phone: user.phone,
    roles: user.roles,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
