import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "src/email/email.service";
import { NotificationService } from "src/notification/notification.service";
import { PrismaService } from "src/prisma/prisma.service";
import Stripe from "stripe";

@Injectable()
export class WebhookService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly email: EmailService
    ) {
        this.stripe = new Stripe(configService.get('STRIPE_SECRET_KEY')!, {
            apiVersion: '2025-07-30.basil',
        });
    }

    async handleStripeEvent(body: string, signature: string, traceId: string) {
        const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
        const event = this.stripe.webhooks.constructEvent(body, signature, endpointSecret!);

        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleSuccessfulCheckout(event.data.object as Stripe.Checkout.Session);
                break;

            case 'checkout.session.expired':
                await this.handleExpiredSession(event.data.object as Stripe.Checkout.Session, traceId);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
    }

    private async handleSuccessfulCheckout(session: Stripe.Checkout.Session) {
        await this.prisma.payment.update({
            where: { transactionId: session.id },
            data: {
                transactionId: session.payment_intent as string,
                status: 'COMPLETED',
            },
        });

        const appointmentId = session.metadata?.appointmentId;

        await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                isPaid: true,
                paymentMethod: 'ONLINE',
            },
        });
    }

    private async handleExpiredSession(session: Stripe.Checkout.Session, traceId: string) {

        const payment = await this.prisma.payment.delete({
            where: { transactionId: session.id },
            select: {
                userId: true,
                appointment: {
                    select: {
                        doctor: {
                            select: {
                                fullName: true
                            }
                        }
                    }
                }
            }
        });

        this.notificationService.sendNotifications(
            payment.userId,
            `Payment session expired for appointment with ${payment.appointment.doctor.fullName}`,
            traceId
        )
            .catch((error) => {
                this.logger.log(
                    `❌ Failed to insert notification into queue, Reason: ${error.message} with traceId: ${traceId}`
                )

                this.email.alertAdmin(
                    'Failed to send notification',
                    `Failed to send notification about payment session expiry to patientId=${payment.userId}, Reason: ${error.message} with traceId: ${traceId}`
                )
                    .catch((error) => {
                        this.logger.error(
                            `❌ Failed to send alert email to admin, Reason: ${error.message} with traceId: ${traceId}`
                        )
                    })
            })
    }
}