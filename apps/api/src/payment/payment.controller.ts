import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
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

@Controller('subscription-payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  async create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateSubscriptionPaymentBodySchema))
    _body: unknown,
    @Req() req: Request,
  ) {
    return this.payments.startCheckout(auth.user.id, getRequestId(req));
  }

  @Get(':id')
  async status(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.payments.getPaymentStatus(auth.user.id, id);
  }
}
