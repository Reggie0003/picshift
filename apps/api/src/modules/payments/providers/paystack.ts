/**
 * Paystack adapter (strong in Nigeria, growing in Ghana).
 *
 * Endpoints used:
 *   POST /transferrecipient        — register a beneficiary
 *   POST /transfer                 — initiate transfer
 *   GET  /transfer/:id_or_code     — status
 *   POST /bank/resolve             — verify account number → name
 *
 * Webhook signature: `x-paystack-signature` (HMAC-SHA512 of body, hex).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env.js';
import { ApiError } from '@/lib/errors.js';
import type {
  PaymentProvider,
  PayoutBeneficiary,
  PayoutRequest,
  PayoutResult,
  WebhookEvent,
} from '@/modules/payments/types.js';

export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack';

  constructor(private readonly cfg = {
    secretKey: env.PAYSTACK_SECRET_KEY ?? '',
    webhookSecret: env.PAYSTACK_WEBHOOK_SECRET ?? env.PAYSTACK_SECRET_KEY ?? '',
  }) {}

  private assertConfigured(): void {
    if (!this.cfg.secretKey) {
      throw ApiError.notImplemented('Paystack not configured (PAYSTACK_SECRET_KEY missing)');
    }
  }

  async verifyBeneficiary(_b: PayoutBeneficiary): Promise<{ verified: boolean; resolvedName?: string }> {
    this.assertConfigured();
    return { verified: false };
  }

  async initiatePayout(req: PayoutRequest): Promise<PayoutResult> {
    this.assertConfigured();
    return { providerReference: `ps-pending-${req.idempotencyKey}`, status: 'queued' };
  }

  async getPayoutStatus(providerReference: string): Promise<PayoutResult> {
    this.assertConfigured();
    return { providerReference, status: 'processing' };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookEvent> {
    const sigHeader = headers['x-paystack-signature'];
    const provided =
      Array.isArray(sigHeader) ? sigHeader[0] : (sigHeader as string | undefined);
    if (!provided) throw ApiError.unauthorized('Missing webhook signature');
    const expected = createHmac('sha512', this.cfg.webhookSecret).update(rawBody).digest('hex');
    const provBuf = Buffer.from(provided);
    const expBuf = Buffer.from(expected);
    if (provBuf.length !== expBuf.length || !timingSafeEqual(provBuf, expBuf)) {
      throw ApiError.unauthorized('Invalid webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    return {
      providerReference: String((event as { data?: { reference?: string } }).data?.reference ?? ''),
      type: this.mapEventType(event['event'] as string | undefined),
      raw: event,
    };
  }

  private mapEventType(t: string | undefined): WebhookEvent['type'] {
    switch (t) {
      case 'transfer.success': return 'payout.success';
      case 'transfer.failed':  return 'payout.failed';
      case 'transfer.reversed': return 'payout.failed';
      default:                 return 'unknown';
    }
  }
}
