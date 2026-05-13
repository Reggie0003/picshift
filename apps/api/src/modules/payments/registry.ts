/**
 * Provider registry. Single source of truth for choosing a payment provider
 * by name. The payroll dispatcher resolves the provider per-payroll-item.
 */
import { FlutterwaveProvider } from '@/modules/payments/providers/flutterwave.js';
import { MtnMomoProvider } from '@/modules/payments/providers/mtn-momo.js';
import { PaystackProvider } from '@/modules/payments/providers/paystack.js';
import { VodafoneCashProvider } from '@/modules/payments/providers/vodafone-cash.js';
import type { PaymentProvider } from '@/modules/payments/types.js';

export type ProviderName = 'flutterwave' | 'paystack' | 'mtn_momo' | 'vodafone_cash';

let cache: Map<ProviderName, PaymentProvider> | null = null;

export function getProvider(name: ProviderName): PaymentProvider {
  if (!cache) {
    cache = new Map<ProviderName, PaymentProvider>([
      ['flutterwave', new FlutterwaveProvider()],
      ['paystack', new PaystackProvider()],
      ['mtn_momo', new MtnMomoProvider()],
      ['vodafone_cash', new VodafoneCashProvider()],
    ]);
  }
  const p = cache.get(name);
  if (!p) throw new Error(`Unknown payment provider: ${String(name)}`);
  return p;
}

export const ALL_PROVIDERS: readonly ProviderName[] = [
  'flutterwave',
  'paystack',
  'mtn_momo',
  'vodafone_cash',
];
