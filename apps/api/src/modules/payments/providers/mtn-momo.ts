/**
 * MTN MoMo (Mobile Money) Disbursements API adapter.
 *
 * Docs: https://momodeveloper.mtn.com — Disbursements product
 *
 * Flow:
 *   1. POST /collection/token  — get OAuth bearer with X-Reference-Id
 *   2. POST /disbursement/v1_0/transfer (idempotent via X-Reference-Id)
 *   3. GET  /disbursement/v1_0/transfer/{referenceId} — status
 *
 * X-Reference-Id is a UUID — we use the payroll item's idempotencyKey
 * (must be UUID v4 or compatible). MTN's API requires UUID format.
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

export class MtnMomoProvider implements PaymentProvider {
  readonly name = 'mtn_momo';

  constructor(private readonly cfg = {
    apiUser: env.MTN_MOMO_API_USER ?? '',
    apiKey: env.MTN_MOMO_API_KEY ?? '',
    subKey: env.MTN_MOMO_SUBSCRIPTION_KEY ?? '',
    target: env.MTN_MOMO_TARGET_ENV,
  }) {}

  private assertConfigured(): void {
    if (!this.cfg.apiUser || !this.cfg.apiKey || !this.cfg.subKey) {
      throw ApiError.notImplemented('MTN MoMo not configured');
    }
  }

  async verifyBeneficiary(b: PayoutBeneficiary): Promise<{ verified: boolean; resolvedName?: string }> {
    this.assertConfigured();
    if (b.type !== 'mobile_money' || b.provider !== 'mtn') {
      throw ApiError.badRequest('MTN MoMo only supports MTN mobile-money payouts');
    }
    // TODO: GET /disbursement/v1_0/accountholder/msisdn/{phone}/basicuserinfo
    return { verified: false };
  }

  async initiatePayout(req: PayoutRequest): Promise<PayoutResult> {
    this.assertConfigured();
    // TODO: POST /disbursement/v1_0/transfer with X-Reference-Id = req.idempotencyKey
    return { providerReference: req.idempotencyKey, status: 'queued' };
  }

  async getPayoutStatus(providerReference: string): Promise<PayoutResult> {
    this.assertConfigured();
    return { providerReference, status: 'processing' };
  }

  async verifyWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookEvent> {
    // MTN uses callback URLs registered with the API user; signature
    // mechanism is currently basic — they send the X-Reference-Id and expect
    // a 200. For defence, we verify against our session lookup of issued
    // references in the webhook receiver, not just the payload.
    const event = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    return {
      providerReference: String(event['referenceId'] ?? ''),
      type:
        event['status'] === 'SUCCESSFUL'
          ? 'payout.success'
          : event['status'] === 'FAILED'
          ? 'payout.failed'
          : 'payout.pending',
      raw: event,
    };
  }
}
