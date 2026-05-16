import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private isConfigured = false;

  constructor(private prisma: PrismaService) {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@dip.local';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
      this.isConfigured = true;
    } else {
      this.logger.warn('VAPID keys not configured. Web Push will not work.');
    }
  }

  async subscribe(userId: string, subscription: any) {
    return this.prisma.notificationSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async sendSecurityAlert(userId: string, title: string, body: string) {
    return this.sendPush(userId, { type: 'security', title, body });
  }

  async sendCallEvent(userId: string, title: string, body: string, data?: any) {
    return this.sendPush(userId, { type: 'call_event', title, body, data });
  }

  private async sendPush(userId: string, payload: any) {
    if (!this.isConfigured) return;

    const subs = await this.prisma.notificationSubscription.findMany({
      where: { userId },
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or no longer valid
          await this.prisma.notificationSubscription.delete({ where: { id: sub.id } });
        } else {
          this.logger.error('Failed to send push notification', err);
        }
      }
    }
  }
}
