/**
 * Payment provider abstraction. Every adapter implements PaymentProvider so
 * the payroll dispatcher is provider-agnostic. Idempotency keys are
 * mandatory on every operation — the GRA / banks WILL retry network errors,
 * and we never want to debit twice.
 */

export type Currency = 'GHS' | 'NGN' | 'USD' | 'EUR' | 'GBP';

export interface PayoutRequest {
  /** Idempotency key (ulid recommended). MUST be unique per payroll item. */
  idempotencyKey: string;
  amountMinor: bigint;
  currency: Currency;
  beneficiary: PayoutBeneficiary;
  narration: string;
  metadata?: Record<string, string>;
}

export type PayoutBeneficiary =
  | { type: 'bank_account'; bankCode: string; accountNumber: string; accountName: string; country: 'GH' | 'NG' | 'KE' | 'ZA' }
  | { type: 'mobile_money'; provider: 'mtn' | 'vodafone' | 'airteltigo' | 'mpesa'; phone: string; accountName: string; country: 'GH' | 'NG' | 'KE' };

export interface PayoutResult {
  providerReference: string;
  status: 'queued' | 'processing' | 'success' | 'failed';
  /** Provider-reported settlement timestamp, if known. */
  settledAt?: Date;
  /** Provider's own error code, if applicable. */
  errorCode?: string;
  errorMessage?: string;
  /** The raw response. Stored for audit; never returned to clients. */
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  /** Verify the beneficiary identity (name match, account exists). */
  verifyBeneficiary(beneficiary: PayoutBeneficiary): Promise<{ verified: boolean; resolvedName?: string }>;
  /** Initiate a disbursement. MUST be idempotent on idempotencyKey. */
  initiatePayout(req: PayoutRequest): Promise<PayoutResult>;
  /** Poll for the final state of an in-flight payout. */
  getPayoutStatus(providerReference: string): Promise<PayoutResult>;
  /** Verify a webhook callback signature. Returns the parsed event or throws. */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): Promise<WebhookEvent>;
}

export interface WebhookEvent {
  providerReference: string;
  type: 'payout.success' | 'payout.failed' | 'payout.pending' | 'unknown';
  amountMinor?: bigint;
  currency?: Currency;
  raw: unknown;
}
