import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentService } from './payment.service';

@Module({
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService],
})
export class PaymentModule {}
