import {
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
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { loadEnv } from '../config/env';
import {
  MOMO_EXTRA_DATA,
  MOMO_IPN_PATH,
  MOMO_ORDER_INFO,
  MOMO_ORDER_TYPE,
  resolveMomoCheckoutConfig,
} from './momo-config';
import { verifyMomoIpnSignature } from './momo-signature';
import { PaymentService } from './payment.service';

/**
 * Only the fields the signature covers, plus the signature itself. Not strict:
 * MoMo documents optional extras (partnerUserId, promotionInfo, paymentOption,
 * userFee) and may add more, and a webhook that 400s on an unrecognised field
 * would break on a provider release we do not control. Unknown keys are simply
 * dropped, so they can never reach the signed string or the database.
 */
const MomoIpnSchema = z.object({
  partnerCode: z.string().min(1),
  orderId: z.string().min(1),
  requestId: z.string().min(1),
  amount: z.number().int().safe(),
  orderInfo: z.string(),
  orderType: z.string().min(1),
  transId: z.number().int().safe(),
  resultCode: z.number().int().safe(),
  message: z.string(),
  payType: z.string(),
  responseTime: z.number().int().safe(),
  extraData: z.string(),
  signature: z.string().min(1),
});

type MomoIpn = z.infer<typeof MomoIpnSchema>;

/**
 * MoMo's server-to-server callback. It carries no Origin and no session, and
 * authenticates itself entirely by HMAC — hence @Public plus @SkipOriginCheck,
 * which is granted to this one route and nothing else.
 *
 * A callback that passes authentication answers 204 with an empty body whatever
 * we decide about it — applied, duplicate, unknown order, mismatched fields.
 * MoMo retries anything that is not 204, and redelivering a notification we
 * have already settled achieves nothing.
 *
 * Requests that never authenticate are the exception: a malformed body is 400
 * and a bad signature is 401, because those are not MoMo and there is nothing
 * to retry. A genuine server fault surfaces as an unhandled 5xx, which is the
 * one case where a retry is what we want.
 */
@Controller()
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentService) {}

  @Public()
  @SkipOriginCheck()
  @Post(MOMO_IPN_PATH)
  @HttpCode(204)
  async momoIpn(
    @Body(new ZodValidationPipe(MomoIpnSchema)) body: MomoIpn,
  ): Promise<void> {
    const config = resolveMomoCheckoutConfig(loadEnv());
    if (!config) {
      // Generic: an unconfigured server must not describe its own gaps to an
      // unauthenticated caller.
      throw new ServiceUnavailableException({
        code: 'PAYMENT_NOT_CONFIGURED',
        message: 'Payment checkout is not configured',
      });
    }

    // accessKey comes from our configuration, never from the body: MoMo does
    // not send it on the IPN, and accepting a caller-supplied one would let
    // the caller choose part of the string it is being verified against.
    const signatureValid = verifyMomoIpnSignature(
      {
        accessKey: config.accessKey,
        amount: body.amount,
        extraData: body.extraData,
        message: body.message,
        orderId: body.orderId,
        orderInfo: body.orderInfo,
        orderType: body.orderType,
        partnerCode: body.partnerCode,
        payType: body.payType,
        requestId: body.requestId,
        responseTime: body.responseTime,
        resultCode: body.resultCode,
        transId: body.transId,
      },
      body.signature,
      config.secretKey,
    );

    // The signed fields must also be the ones we sent. A valid signature only
    // proves the sender holds the secret; these prove it is answering our
    // order rather than replaying a differently-shaped one.
    const authentic =
      signatureValid &&
      body.partnerCode === config.partnerCode &&
      body.orderInfo === MOMO_ORDER_INFO &&
      body.extraData === MOMO_EXTRA_DATA &&
      body.orderType === MOMO_ORDER_TYPE;

    if (!authentic) {
      // One generic rejection for every reason: which check failed is not the
      // caller's business, and neither the signature nor the payload is logged.
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Notification rejected',
      });
    }

    // orderId, requestId and amount are matched against the stored row inside
    // the transaction, which is also where duplicates and unknown orders are
    // absorbed — all of them end here as 204.
    await this.payments.processVerifiedNotification({
      partnerCode: body.partnerCode,
      orderId: body.orderId,
      requestId: body.requestId,
      amount: body.amount,
      transId: String(body.transId),
      resultCode: body.resultCode,
      message: body.message,
    });
  }
}
