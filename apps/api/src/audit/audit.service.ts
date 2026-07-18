import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditRecordInput {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          requestId: input.requestId,
          metadata:
            input.metadata === undefined
              ? undefined
              : (input.metadata as Prisma.InputJsonValue),
        },
      });
    } catch (err) {
      // Auditing must not break the primary request path, but must be visible.
      this.logger.error(
        `Failed to write audit log action=${input.action}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
