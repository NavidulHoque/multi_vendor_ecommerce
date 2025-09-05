// src/webhook/webhook.module.ts
import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller'; 
import { ConfigModule } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [ConfigModule, NotificationModule, PrismaModule, EmailModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}