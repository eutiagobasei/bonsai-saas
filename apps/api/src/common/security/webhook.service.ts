import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from './encryption.service';

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Webhook Security Service
 *
 * Features:
 * - HMAC-SHA256 signature validation
 * - Replay attack protection with timestamps
 * - Automatic retry with exponential backoff
 * - Delivery logging
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly signatureHeader = 'X-Webhook-Signature';
  private readonly timestampHeader = 'X-Webhook-Timestamp';
  private readonly maxTimestampAge = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Create a new webhook endpoint
   */
  async createEndpoint(
    tenantId: string,
    url: string,
    events: string[],
  ) {
    // Generate and encrypt secret
    const secret = crypto.randomBytes(32).toString('hex');
    const encryptedSecret = this.encryption.encrypt(secret);

    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url,
        secret: encryptedSecret,
        events,
      },
    });

    // Return the secret only on creation (user must save it)
    return {
      ...endpoint,
      secret, // Plain secret for user to save
    };
  }

  /**
   * Trigger webhook for an event
   */
  async trigger(
    tenantId: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        isActive: true,
        events: { has: event },
      },
    });

    for (const endpoint of endpoints) {
      await this.deliver(endpoint.id, event, data);
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  async deliver(
    endpointId: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!endpoint || !endpoint.isActive) {
      return;
    }

    const timestamp = new Date().toISOString();
    const payload: WebhookPayload = { event, data, timestamp };
    const payloadString = JSON.stringify(payload);

    // Decrypt secret and sign
    const secret = this.encryption.decrypt(endpoint.secret);
    const signature = this.sign(payloadString, timestamp, secret);

    // Create delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        endpointId,
        event,
        payload: payload as object,
        signature,
        timestamp: new Date(timestamp),
      },
    });

    // Attempt delivery
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [this.signatureHeader]: signature,
          [this.timestampHeader]: timestamp,
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          statusCode: response.status,
          response: await response.text().catch(() => null),
          attempts: 1,
          deliveredAt: response.ok ? new Date() : null,
          failedAt: response.ok ? null : new Date(),
          nextRetryAt: response.ok ? null : this.calculateNextRetry(1),
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `Webhook delivery failed: ${endpoint.url} - ${response.status}`,
        );
      }
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts: 1,
          failedAt: new Date(),
          nextRetryAt: this.calculateNextRetry(1),
          response: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      this.logger.error(`Webhook delivery error: ${endpoint.url}`, error);
    }
  }

  /**
   * Sign webhook payload
   */
  sign(payload: string, timestamp: string, secret: string): string {
    const data = `${timestamp}.${payload}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify incoming webhook signature
   */
  verifySignature(
    payload: string,
    timestamp: string,
    signature: string,
    secret: string,
  ): boolean {
    // Check timestamp age (replay protection)
    const timestampMs = new Date(timestamp).getTime();
    const now = Date.now();

    if (Math.abs(now - timestampMs) > this.maxTimestampAge) {
      this.logger.warn('Webhook timestamp too old');
      return false;
    }

    // Verify signature
    const expectedSignature = this.sign(payload, timestamp, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(attempt: number): Date {
    // Exponential backoff: 1min, 5min, 30min, 2h, 8h
    const delays = [60, 300, 1800, 7200, 28800];
    const delaySeconds = delays[Math.min(attempt - 1, delays.length - 1)];
    return new Date(Date.now() + delaySeconds * 1000);
  }

  /**
   * Retry failed deliveries
   * Run this periodically (e.g., every minute via cron)
   */
  async retryFailedDeliveries(): Promise<number> {
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        deliveredAt: null,
        attempts: { lt: 5 },
        nextRetryAt: { lte: new Date() },
      },
      include: { endpoint: true },
    });

    let retried = 0;
    for (const delivery of deliveries) {
      if (!delivery.endpoint.isActive) continue;

      await this.deliver(
        delivery.endpointId,
        delivery.event,
        delivery.payload as Record<string, unknown>,
      );
      retried++;
    }

    return retried;
  }
}
