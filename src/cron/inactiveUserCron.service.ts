import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class InactiveUserCronService {
    private readonly logger = new Logger(InactiveUserCronService.name);

    constructor(
        private readonly prisma: PrismaService
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleInactiveUsers() {

        const INACTIVITY_THRESHOLD_MINUTES = 2 * 60 * 1000
        const thresholdDate = new Date(Date.now() - INACTIVITY_THRESHOLD_MINUTES)

        try {
            const result = await this.prisma.user.updateMany({
                where: {
                    isOnline: true,
                    lastActiveAt: {
                        lt: thresholdDate
                    }
                },
                data: {
                    isOnline: false
                }
            })

            if (result.count > 0) {
                this.logger.log(`⏰ Marked ${result.count} users as inactive.`);
            }

            else{
                this.logger.log("⏰ No inactive users were found.");
            }
        }

        catch (error) {
            this.logger.error('❌ Failed to update inactive users:', error.message);
        }
    }
}