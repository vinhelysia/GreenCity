import {
  BadRequestException,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Validate body/query/params with a Zod schema; strip unknown keys. */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
}
