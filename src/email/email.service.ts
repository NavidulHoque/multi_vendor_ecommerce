import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly Otp_Expires_Minutes: number;

  constructor(
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: this.config.get<string>('SMTP_PORT') === '465', // true for 465, false for other ports
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    this.Otp_Expires_Minutes = Number(this.config.get<string>('OTP_EXPIRES', "15"))
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }) {
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM'),
      ...options,
    });
  }

  async sendOtpEmail(to: string, otp: string) {
    await this.sendEmail({
      to,
      subject: 'Your OTP Code',
      text: `Your OTP is: ${otp}. It expires in ${this.Otp_Expires_Minutes} minutes.`,
      html: `<p>Your OTP is: <b>${otp}</b></p><p>It expires in <b>${this.Otp_Expires_Minutes}</b> minutes.</p>`,
    });
  }

  async sendNotificationFailureEmail(to: string, reason: string) {
    await this.sendEmail({
      to,
      subject: 'Notification Delivery Failed',
      text: `We were unable to deliver a notification to your account. Reason: ${reason}`,
      html: `<p>We were unable to deliver a notification to your account.</p><p>Reason: <b>${reason}</b></p>`,
    });
  }

  async alertAdmin(subject: string, message: string) {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    if (!adminEmail) return;

    await this.sendEmail({
      to: adminEmail,
      subject: `[ALERT] ${subject}`,
      text: message,
      html: `<p>${message}</p>`,
    });
  }
}