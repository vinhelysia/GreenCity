import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type { AuthContext } from '../authz/auth-context';
import { CurrentUser } from '../authz/current-user.decorator';
import { getRequestId } from '../common/request-id';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaymentService } from './payment.service';

/**
 * The price and the duration are the server's alone. Strict rather than
 * stripped: a request carrying amount or durationDays is a client trying to
 * price itself, and it should fail loudly rather than be quietly ignored.
 */
const CreateSubscriptionPaymentBodySchema = z.object({}).strict();
const IdempotencyKeySchema = z.string().uuid();

function parseIdempotencyKey(value: unknown): string {
  const parsed = IdempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

@Controller('subscription-payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  async create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateSubscriptionPaymentBodySchema))
    _body: unknown,
    @Headers('idempotency-key')
    idempotencyKey: string | undefined,
    @Req() req: Request,
  ) {
    return this.payments.startCheckout(
      auth.user.id,
      parseIdempotencyKey(idempotencyKey),
      getRequestId(req),
    );
  }

  @Get(':id')
  async status(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.payments.getPaymentStatus(auth.user.id, id);
  }
}
