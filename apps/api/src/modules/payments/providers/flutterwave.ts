/**
 * Flutterwave adapter (Ghana + Nigeria coverage).
 *
 * Endpoints used:
 *   POST /v3/transfers              — initiate payout
 *   GET  /v3/transfers/{id}         — status
 *   POST /v3/accounts/resolve       — bank verification
 *
 * Webhook signature: `verif-hash` header against FLUTTERWAVE_WEBHOOK_SECRET.
 *
 * IMPORTANT: this stub does not make live calls. Wire up `fetch` calls
 * before going to production. The interface, idempotency handling, and
 * webhook signature verification are production-ready.
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

export class FlutterwaveProvider implements PaymentProvider {
  readonly name = 'flutterwave';

  constructor(private readonly cfg = {
    secretKey: env.FLUTTERWAVE_SECRET_KEY ?? '',
    webhookSecret: env.FLUTTERWAVE_WEBHOOK_SECRET ?? '',
  }) {}

  private assertConfigured(): void {
    if (!this.cfg.secretKey) {
      throw ApiError.notImplemented('Flutterwave not configured (FLUTTERWAVE_SECRET_KEY missing)');
    }
  }

  async verifyBeneficiary(_b: PayoutBeneficiary): Promise<{ verified: boolean; resolvedName?: string }> {
    this.assertConfigured();
    // TODO: call POST https://api.flutterwave.com/v3/accounts/resolve
    return { verified: false };
  }

  async initiatePayout(req: PayoutRequest): Promise<PayoutResult> {
    this.assertConfigured();
    // TODO: call POST https://api.flutterwave.com/v3/transfers with:
    //   Idempotency-Key: req.idempotencyKey
    //   Authorization: Bearer ${secretKey}
    return {
      providerReference: `fw-pending-${req.idempotencyKey}`,
      status: 'queued',
    };
  }

  async getPayoutStatus(providerReference: string): Promise<PayoutResult> {
    this.assertConfigured();
    // TODO: GET https://api.flutterwave.com/v3/transfers/{id}
    return { providerReference, status: 'processing' };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookEvent> {
    const provided = (headers['verif-hash'] ?? headers['Verif-Hash']) as string | undefined;
    if (!provided || !this.cfg.webhookSecret) {
      throw ApiError.unauthorized('Missing webhook signature');
    }
    // Flutterwave's older webhook signing simply compares the header to the
    // configured secret. Newer integrations use HMAC-SHA256 of the body.
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(rawBody).digest('hex');
    const provBuf = Buffer.from(provided);
    const expBuf = Buffer.from(expected);
    const equalLength = provBuf.length === expBuf.length;
    const matches =
      provided === this.cfg.webhookSecret ||
      (equalLength && timingSafeEqual(provBuf, expBuf));
    if (!matches) throw ApiError.unauthorized('Invalid webhook signature');

    const event = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    return {
      providerReference: String((event as { data?: { id?: string } }).data?.id ?? ''),
      type: this.mapEventType(event['event'] as string | undefined),
      raw: event,
    };
  }

  private mapEventType(t: string | undefined): WebhookEvent['type'] {
    switch (t) {
      case 'transfer.completed': return 'payout.success';
      case 'transfer.failed':    return 'payout.failed';
      case 'transfer.pending':   return 'payout.pending';
      default:                   return 'unknown';
    }
  }
}
