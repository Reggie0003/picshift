/**
 * TOTP (RFC 6238) for multi-factor authentication.
 * Compatible with Google Authenticator, Authy, 1Password, Microsoft
 * Authenticator, and any other RFC 6238 client.
 */
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

authenticator.options = { window: 1, digits: 6, step: 30 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUri(opts: { secret: string; account: string; issuer: string }): string {
  return authenticator.keyuri(opts.account, opts.issuer, opts.secret);
}

export async function buildTotpQrPng(uri: string): Promise<string> {
  return qrcode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1, scale: 6 });
}

export function verifyTotp(secret: string, token: string): boolean {
  // Normalise: strip whitespace, must be 6 digits
  const cleaned = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    return authenticator.verify({ secret, token: cleaned });
  } catch {
    return false;
  }
}
