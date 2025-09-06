import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailModule } from 'src/email/email.module';
import { SmsModule } from 'src/sms/sms.module';

@Module({
  imports: [UserModule, ConfigModule, PrismaModule, EmailModule, SmsModule, JwtModule.register({
    global: true,
  })],
  providers: [AuthService],
  controllers: [AuthController]
})
export class AuthModule { }