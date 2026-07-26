import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../authz/authenticated.guard';
import { SkipOriginCheck } from '../common/origin.guard';
import { loadEnv } from '../config/env';
import {
  PAYOS_CURRENCY,
  PAYOS_WEBHOOK_PATH,
  resolvePayosWebhookChecksumKey,
} from './payos-config';
import { verifyPayosDataSignature } from './payos-signature';
import { PaymentService } from './payment.service';

/**
 * The envelope only. `data` is kept as an opaque record on purpose: payOS signs
 * the whole data object, so anything that drops a key it does not recognise —
 * which every non-passthrough Zod object does — changes the canonical string
 * and rejects genuine callbacks. Verification happens on this raw record; the
 * activation fields are parsed out of it only afterwards.
 */
const PayosWebhookEnvelopeSchema = z.object({
  code: z.string(),
  desc: z.string().optional(),
  success: z.boolean().optional(),
  data: z.record(z.unknown()),
  signature: z.string().min(1),
});

/** The signed fields activation depends on, parsed after verification. */
const PayosWebhookDataSchema = z.object({
  orderCode: z.number().int().safe().positive(),
  amount: z.number().int(),
  description: z.string(),
  reference: z.string().min(1),
  paymentLinkId: z.string().min(1),
  currency: z.string(),
  code: z.string(),
});

/**
 * payOS's server-to-server callback. It carries no Origin and no session, and
 * authenticates itself entirely by HMAC — hence @Public plus @SkipOriginCheck,
 * which is granted to this one route and nothing else.
 *
 * The address is not sent per request: it is registered once per payment
 * channel through payOS's confirm-webhook API, which probes it with a signed
 * sample transaction. That sample carries an orderCode we have never issued, so
 * it must be acknowledged without creating anything — the unknown-order path
 * below does exactly that.
 *
 * A callback that authenticates answers 204 whatever we decide about it —
 * applied, duplicate, unknown order, mismatched fields. payOS asks only for a
 * 2XX. Requests that never authenticate are the exception: a malformed body is
 * 400 and a bad signature is 401, because those are not payOS and there is
 * nothing to retry. A genuine server fault surfaces as an unhandled 5xx.
 */
@Controller()
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentService) {}

  @Public()
  @SkipOriginCheck()
  @Post(PAYOS_WEBHOOK_PATH)
  @HttpCode(204)
  async payosWebhook(@Body() rawBody: unknown): Promise<void> {
    const envelope = PayosWebhookEnvelopeSchema.safeParse(rawBody);
    if (!envelope.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid webhook payload',
      });
    }

    // Only the checksum key: this route authenticates by HMAC, and tying it to
    // the checkout configuration meant turning checkout off also silenced the
    // callbacks for payments already made.
    const checksumKey = resolvePayosWebhookChecksumKey(loadEnv());
    if (!checksumKey) {
      // Generic: an unconfigured server must not describe its own gaps to an
      // unauthenticated caller.
      throw new ServiceUnavailableException({
        code: 'PAYMENT_NOT_CONFIGURED',
        message: 'Payment checkout is not configured',
      });
    }

    // Over the full data object exactly as received — before anything strips it.
    if (
      !verifyPayosDataSignature(
        envelope.data.data,
        envelope.data.signature,
        checksumKey,
      )
    ) {
      // One generic rejection: which check failed is not the caller's business,
      // and neither the signature nor the payload is logged.
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Notification rejected',
      });
    }

    const data = PayosWebhookDataSchema.safeParse(envelope.data.data);
    if (!data.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid webhook payload',
      });
    }

    // Signed, but not for money we recognise. Acknowledged and dropped rather
    // than granting anything: the amount comparison downstream assumes VND.
    if (data.data.currency !== PAYOS_CURRENCY) return;

    // orderCode, amount and paymentLinkId are matched against the stored row
    // inside the transaction, which is also where duplicates and
    // unknown orders are absorbed — all of them end here as 204.
    await this.payments.processVerifiedNotification({
      orderCode: String(data.data.orderCode),
      amount: data.data.amount,
      description: data.data.description,
      reference: data.data.reference,
      paymentLinkId: data.data.paymentLinkId,
      code: data.data.code,
    });
  }
}
