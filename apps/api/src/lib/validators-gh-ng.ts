/**
 * Region-specific identifier validators for Ghana and Nigeria.
 *
 * Sources:
 *   - Ghana Card: National Identification Authority (NIA) format GHA-XXXXXXXXX-X
 *   - SSNIT: 13-character alphanumeric (e.g. C123456789012)
 *   - TIN (Ghana): 11 chars, starts with P/C/G/Q (Ghana Revenue Authority)
 *   - BVN (Nigeria): 11 numeric digits issued by CBN
 *   - NIN (Nigeria): 11 numeric digits issued by NIMC
 *   - Mobile money:
 *       MTN GH    : 024, 054, 055, 059
 *       Vodafone  : 020, 050
 *       AirtelTigo: 026, 027, 056, 057
 *       MTN NG    : 0703, 0706, 0803, 0806, 0810, 0813, 0814, 0816, 0903, 0906
 */
import { z } from 'zod';

export const GhanaCardRegex = /^GHA-\d{9}-\d$/;
export const SsnitRegex = /^[A-Z]\d{12}$/;          // e.g. C123456789012
export const GhanaTinRegex = /^[PCGQ]\d{10}$/;       // P/C/G/Q + 10 digits
export const NigeriaBvnRegex = /^\d{11}$/;
export const NigeriaNinRegex = /^\d{11}$/;

export const GhanaMobileMoneyRegex = /^0(20|24|26|27|50|54|55|56|57|59)\d{7}$/;
export const NigeriaPhoneRegex = /^0(70[1-9]|80[2-9]|81[0-9]|90[1-9])\d{7}$/;

export const GhanaCardSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GhanaCardRegex, 'Ghana Card must be in format GHA-XXXXXXXXX-X');

export const SsnitSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SsnitRegex, 'SSNIT number must be a letter followed by 12 digits');

export const GhanaTinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GhanaTinRegex, 'TIN must start with P/C/G/Q followed by 10 digits');

export const BvnSchema = z
  .string()
  .trim()
  .regex(NigeriaBvnRegex, 'BVN must be 11 digits');

export const NinSchema = z
  .string()
  .trim()
  .regex(NigeriaNinRegex, 'NIN must be 11 digits');

export const GhMomoSchema = z
  .string()
  .trim()
  .regex(GhanaMobileMoneyRegex, 'Invalid Ghana mobile-money number');

export const NgPhoneSchema = z
  .string()
  .trim()
  .regex(NigeriaPhoneRegex, 'Invalid Nigeria phone number');

export type CountryCode = 'GH' | 'NG' | 'KE' | 'ZA' | 'US' | 'GB';

export function detectMoMoProvider(phone: string): 'mtn' | 'vodafone' | 'airteltigo' | null {
  const m = phone.match(/^0(\d{2})/);
  if (!m) return null;
  const prefix = m[1];
  if (!prefix) return null;
  if (['24', '54', '55', '59'].includes(prefix)) return 'mtn';
  if (['20', '50'].includes(prefix)) return 'vodafone';
  if (['26', '27', '56', '57'].includes(prefix)) return 'airteltigo';
  return null;
}
