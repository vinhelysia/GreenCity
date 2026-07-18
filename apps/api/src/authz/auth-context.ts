import type { User, UserRole } from '@prisma/client';

export interface AuthContext {
  user: User;
  sessionId: string;
  roles: UserRole[];
}
