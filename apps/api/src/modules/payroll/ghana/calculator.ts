/**
 * Ghana monthly payroll calculator.
 *
 * Pure function. Given an employee compensation profile, returns a fully
 * itemised breakdown of gross, statutory deductions, reliefs, PAYE, and net.
 *
 * All amounts INPUT and OUTPUT are in MINOR units (pesewas = 1/100 GHS) so we
 * avoid floating-point rounding bugs that would compound across thousands of
 * paychecks. We use BigInt arithmetic exclusively.
 *
 * Order of operations (mandated by GRA + Act 896):
 *   1. Gross = basic + allowances + bonuses
 *   2. Compute Tier-1 employee SSNIT contribution (5.5% of basic)
 *   3. Compute Tier-3 voluntary (capped at 16.5% combined)
 *   4. Chargeable income = Gross − SSNIT employee − Tier 3 voluntary − reliefs
 *   5. PAYE = lookup in monthly band schedule
 *   6. Net = Gross − SSNIT employee − Tier 3 voluntary − PAYE − other deductions
 *
 * The output also includes employer-side costs (Tier 1 employer, Tier 2)
 * so accounting can book the full cost of employment.
 */
import {
  GH_PAYE_MONTHLY_2026,
  GH_RELIEFS_ANNUAL,
  GH_SSNIT,
  type TaxBand,
} from '@/modules/payroll/ghana/tax-tables.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReliefsClaim {
  marriageOrResponsibility?: boolean;
  childrenInEducation?: number;     // 0..3
  agedDependants?: number;          // 0..2
  hasDisability?: boolean;
  isAged?: boolean;                 // 60+
  professionalTrainingMinor?: bigint; // up to 2,000 GHS annual
}

export interface PayrollInputMinor {
  basicSalaryMinor: bigint;     // monthly basic
  allowancesMinor?: bigint;     // taxable allowances
  bonusesMinor?: bigint;        // monthly bonus / commission
  tier3VoluntaryRate?: number;  // 0..0.11 (employee voluntary Tier 3)
  reliefs?: ReliefsClaim;
  otherDeductionsMinor?: bigint; // garnishments, loan repayments, etc.
}

export interface PayrollResultMinor {
  // Inputs echoed back for audit
  basicSalaryMinor: bigint;
  allowancesMinor: bigint;
  bonusesMinor: bigint;
  grossMinor: bigint;

  // Employee statutory deductions
  ssnitEmployeeMinor: bigint;       // 5.5% × basic
  tier3VoluntaryMinor: bigint;      // employee voluntary
  reliefsMinor: bigint;             // monthly relief total
  chargeableIncomeMinor: bigint;    // base for PAYE lookup
  payeMinor: bigint;                // income tax
  otherDeductionsMinor: bigint;

  netMinor: bigint;

  // Employer cost
  ssnitTier1EmployerMinor: bigint;  // 13% × basic
  ssnitTier2EmployerMinor: bigint;  // 5% × basic
  employerTotalCostMinor: bigint;   // gross + tier1 + tier2

  // Diagnostics
  payeBandsApplied: Array<{ upTo: string; rate: number; amountMinor: string }>;
  tablesVersion: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PESEWAS_PER_CEDI = 100n;

function toMinor(major: number): bigint {
  // Round to nearest pesewa to avoid surprise sub-pesewa drift.
  return BigInt(Math.round(major * 100));
}

function applyPctMinor(amountMinor: bigint, rate: number): bigint {
  // bigint × number requires care. Multiply by 10_000 to keep precision,
  // do integer math, then divide back.
  const scaled = BigInt(Math.round(rate * 10_000));
  return (amountMinor * scaled) / 10_000n;
}

function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

// ---------------------------------------------------------------------------
// Reliefs
// ---------------------------------------------------------------------------

export function computeMonthlyReliefsMinor(
  reliefs: ReliefsClaim | undefined,
  grossMonthlyMinor: bigint,
): bigint {
  if (!reliefs) return 0n;
  let annualMajor = 0;

  if (reliefs.marriageOrResponsibility) {
    annualMajor += GH_RELIEFS_ANNUAL.MARRIAGE_OR_RESPONSIBILITY;
  }
  if (reliefs.childrenInEducation && reliefs.childrenInEducation > 0) {
    const n = Math.min(reliefs.childrenInEducation, GH_RELIEFS_ANNUAL.CHILD_EDUCATION_MAX_CHILDREN);
    annualMajor += n * GH_RELIEFS_ANNUAL.CHILD_EDUCATION_PER_CHILD;
  }
  if (reliefs.agedDependants && reliefs.agedDependants > 0) {
    const n = Math.min(reliefs.agedDependants, GH_RELIEFS_ANNUAL.AGED_DEPENDANT_MAX);
    annualMajor += n * GH_RELIEFS_ANNUAL.AGED_DEPENDANT;
  }
  if (reliefs.isAged) {
    annualMajor += GH_RELIEFS_ANNUAL.AGED;
  }

  let monthlyReliefMinor = toMinor(annualMajor) / 12n;

  if (reliefs.hasDisability) {
    // Disability relief is 25% of personal income (annualised: ×12 of monthly)
    monthlyReliefMinor += applyPctMinor(grossMonthlyMinor, GH_RELIEFS_ANNUAL.DISABILITY);
  }
  if (reliefs.professionalTrainingMinor && reliefs.professionalTrainingMinor > 0n) {
    const annualCap = toMinor(GH_RELIEFS_ANNUAL.PROFESSIONAL_TRAINING_MAX);
    const claim = reliefs.professionalTrainingMinor > annualCap ? annualCap : reliefs.professionalTrainingMinor;
    monthlyReliefMinor += claim / 12n;
  }

  return monthlyReliefMinor;
}

// ---------------------------------------------------------------------------
// PAYE band lookup (cumulative-marginal)
// ---------------------------------------------------------------------------

export function computeMonthlyPaye(
  chargeableIncomeMinor: bigint,
  bands: readonly TaxBand[] = GH_PAYE_MONTHLY_2026,
): { taxMinor: bigint; breakdown: Array<{ upTo: string; rate: number; amountMinor: string }> } {
  if (chargeableIncomeMinor <= 0n) {
    return { taxMinor: 0n, breakdown: [] };
  }

  let remaining = chargeableIncomeMinor;
  let lowerBoundMinor = 0n;
  let tax = 0n;
  const breakdown: Array<{ upTo: string; rate: number; amountMinor: string }> = [];

  for (const band of bands) {
    const upToMinor = band.upTo === Infinity ? null : toMinor(band.upTo);
    const bandWidth =
      upToMinor === null
        ? remaining
        : upToMinor - lowerBoundMinor;
    if (bandWidth <= 0n) {
      if (upToMinor !== null) lowerBoundMinor = upToMinor;
      continue;
    }
    const taxedInBand = remaining > bandWidth ? bandWidth : remaining;
    const taxInBand = applyPctMinor(taxedInBand, band.rate);
    if (taxedInBand > 0n) {
      breakdown.push({
        upTo: band.upTo === Infinity ? 'Infinity' : band.upTo.toString(),
        rate: band.rate,
        amountMinor: taxInBand.toString(),
      });
    }
    tax += taxInBand;
    remaining -= taxedInBand;
    if (upToMinor !== null) lowerBoundMinor = upToMinor;
    if (remaining <= 0n) break;
  }

  return { taxMinor: tax, breakdown };
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

export const GH_TABLES_VERSION = '2026.01';

export function calculateGhanaMonthlyPayroll(
  input: PayrollInputMinor,
): PayrollResultMinor {
  const basic = input.basicSalaryMinor;
  const allowances = input.allowancesMinor ?? 0n;
  const bonuses = input.bonusesMinor ?? 0n;
  const other = input.otherDeductionsMinor ?? 0n;

  if (basic < 0n || allowances < 0n || bonuses < 0n || other < 0n) {
    throw new Error('Payroll inputs must be non-negative');
  }

  const gross = basic + allowances + bonuses;

  // -- SSNIT (Tier 1) -------------------------------------------------------
  // Employee deduction is 5.5% of BASIC SALARY (not gross). See Act 766 §3.
  const ssnitEmployee = applyPctMinor(basic, GH_SSNIT.TIER1_EMPLOYEE_RATE);
  const ssnitTier1Employer = applyPctMinor(basic, GH_SSNIT.TIER1_EMPLOYER_RATE);
  const ssnitTier2Employer = applyPctMinor(basic, GH_SSNIT.TIER2_EMPLOYER_RATE);

  // -- Tier 3 voluntary (employee) -----------------------------------------
  // Capped so combined employer + employee ≤ 16.5%. Employer side already
  // covers 18% (13% + 5%) — so employee voluntary is effectively limited
  // by the GRA tax-deductibility cap of 16.5% combined, leaving ≤ 11% for
  // the employee in practice. We allow up to 11% here.
  const t3Rate = Math.max(0, Math.min(0.11, input.tier3VoluntaryRate ?? 0));
  const tier3Voluntary = applyPctMinor(basic, t3Rate);

  // -- Reliefs --------------------------------------------------------------
  const reliefs = computeMonthlyReliefsMinor(input.reliefs, gross);

  // -- Chargeable income & PAYE --------------------------------------------
  const preTaxDeductions = ssnitEmployee + tier3Voluntary + reliefs;
  const chargeable = maxBigInt(0n, gross - preTaxDeductions);
  const paye = computeMonthlyPaye(chargeable);

  // -- Net ------------------------------------------------------------------
  const net = gross - ssnitEmployee - tier3Voluntary - paye.taxMinor - other;
  const netNonNegative = net < 0n ? 0n : net;

  return {
    basicSalaryMinor: basic,
    allowancesMinor: allowances,
    bonusesMinor: bonuses,
    grossMinor: gross,

    ssnitEmployeeMinor: ssnitEmployee,
    tier3VoluntaryMinor: tier3Voluntary,
    reliefsMinor: reliefs,
    chargeableIncomeMinor: chargeable,
    payeMinor: paye.taxMinor,
    otherDeductionsMinor: other,

    netMinor: netNonNegative,

    ssnitTier1EmployerMinor: ssnitTier1Employer,
    ssnitTier2EmployerMinor: ssnitTier2Employer,
    employerTotalCostMinor: gross + ssnitTier1Employer + ssnitTier2Employer,

    payeBandsApplied: paye.breakdown,
    tablesVersion: GH_TABLES_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Convenience: formatter for payslips
// ---------------------------------------------------------------------------

export function formatGhs(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const cedis = abs / PESEWAS_PER_CEDI;
  const pesewas = abs % PESEWAS_PER_CEDI;
  const cedisStr = cedis.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}GH₵${cedisStr}.${pesewas.toString().padStart(2, '0')}`;
}
