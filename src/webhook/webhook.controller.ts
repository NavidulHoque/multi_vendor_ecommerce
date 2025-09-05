import {
  Controller,
  Post,
  Headers,
  Body,
  Req
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { RequestWithTrace } from 'src/common/types';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
  ) { }

  @Post('stripe')
  async handleStripeWebhook(
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
    @Req() request: RequestWithTrace
  ) {
    const traceId = request.traceId;
    await this.webhookService.handleStripeEvent(body, signature, traceId);
    return { received: true };
  }
}
