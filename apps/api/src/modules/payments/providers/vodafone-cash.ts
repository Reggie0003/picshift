/**
 * Vodafone Cash (Ghana). Disbursements typically routed via Hubtel
 * aggregator or the Vodafone Cash Business portal. This is a thin
 * stub conforming to the PaymentProvider interface.
 */
import { env } from '@/config/env.js';
import { ApiError } from '@/lib/errors.js';
import type {
  PaymentProvider,
  PayoutBeneficiary,
  PayoutRequest,
  PayoutResult,
  WebhookEvent,
} from '@/modules/payments/types.js';

export class VodafoneCashProvider implements PaymentProvider {
  readonly name = 'vodafone_cash';

  constructor(private readonly cfg = {
    merchantId: env.VODAFONE_CASH_MERCHANT_ID ?? '',
    apiKey: env.VODAFONE_CASH_API_KEY ?? '',
  }) {}

  private assertConfigured(): void {
    if (!this.cfg.merchantId || !this.cfg.apiKey) {
      throw ApiError.notImplemented('Vodafone Cash not configured');
    }
  }

  async verifyBeneficiary(_b: PayoutBeneficiary): Promise<{ verified: boolean; resolvedName?: string }> {
    this.assertConfigured();
    return { verified: false };
  }

  async initiatePayout(req: PayoutRequest): Promise<PayoutResult> {
    this.assertConfigured();
    return { providerReference: `vc-pending-${req.idempotencyKey}`, status: 'queued' };
  }

  async getPayoutStatus(providerReference: string): Promise<PayoutResult> {
    this.assertConfigured();
    return { providerReference, status: 'processing' };
  }

  async verifyWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookEvent> {
    const event = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    return {
      providerReference: String(event['reference'] ?? ''),
      type: 'unknown',
      raw: event,
    };
  }
}
