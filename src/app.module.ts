import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CronModule } from './cron/cron.module';
import { EmailModule } from './email/email.module';
import { InterceptorModule } from './interceptor/interceptor.module';
import { KafkaModule } from './kafka/kafka.module';
import { MessageModule } from './message/message.module';
import { NotificationModule } from './notification/notification.module';
import { PaymentModule } from './payment/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ReviewModule } from './review/review.module';
import { SmsModule } from './sms/sms.module';
import { SocketModule } from './socket/socket.module';
import { UserModule } from './user/user.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [AuthModule, CronModule, EmailModule, InterceptorModule, KafkaModule, MessageModule, NotificationModule, PaymentModule, PrismaModule, RedisModule, ReviewModule, SmsModule, SocketModule, UserModule, WebhookModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
