/**
 * Unit tests for Ghana payroll engine. Run via `npm test` in apps/api.
 *
 * These cases are derived from worked examples in the GRA's Monthly PAYE
 * Schedule. If you change the tax tables, re-run these tests AND verify
 * the expected values against a fresh GRA worked example.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateGhanaMonthlyPayroll,
  computeMonthlyPaye,
  formatGhs,
} from './calculator.js';

describe('Ghana monthly PAYE', () => {
  it('returns 0 PAYE for the tax-free band', () => {
    const { taxMinor } = computeMonthlyPaye(48_000n); // 480 GHS chargeable
    expect(taxMinor).toBe(0n);
  });

  it('taxes the 5% band correctly at 600 GHS chargeable', () => {
    // First 490 free → 0
    // Next 110 @ 5% = 5.50 GHS = 550 pesewas
    const { taxMinor } = computeMonthlyPaye(60_000n);
    expect(taxMinor).toBe(550n);
  });

  it('walks multiple bands for 1,000 GHS chargeable', () => {
    // 490 @ 0%   = 0
    // 110 @ 5%   = 5.50
    // 130 @ 10%  = 13.00
    // 270 @ 17.5% = 47.25
    // total: 65.75 GHS = 6,575 pesewas
    const { taxMinor } = computeMonthlyPaye(100_000n);
    expect(taxMinor).toBe(6_575n);
  });

  it('uses 35% on income above 50,416.67', () => {
    const { taxMinor } = computeMonthlyPaye(6_041_667n); // 60,416.67 GHS chargeable
    // The 35% band applies to (60,416.67 − 50,416.67) = 10,000 → 3,500
    // Plus all lower bands. We assert that the marginal portion is included.
    // The cumulative tax up to 50,416.67 is fixed by the schedule; the
    // delta vs. a value just below the top band should be 3,500 GHS.
    const below = computeMonthlyPaye(5_041_667n).taxMinor;
    expect(taxMinor - below).toBe(350_000n);
  });
});

describe('Full monthly payroll', () => {
  it('matches the GRA worked example for 5,000 GHS basic', () => {
    // Basic 5,000 GHS = 500,000 pesewas, no other comp
    const result = calculateGhanaMonthlyPayroll({
      basicSalaryMinor: 500_000n,
    });

    // SSNIT employee 5.5% × 5,000 = 275 → 27,500 pesewas
    expect(result.ssnitEmployeeMinor).toBe(27_500n);
    // Gross
    expect(result.grossMinor).toBe(500_000n);
    // Chargeable = 500,000 − 27,500 = 472,500 pesewas (4,725 GHS)
    expect(result.chargeableIncomeMinor).toBe(472_500n);
    // Employer Tier 1: 13% × 5,000 = 650 → 65,000 pesewas
    expect(result.ssnitTier1EmployerMinor).toBe(65_000n);
    // Employer Tier 2: 5% × 5,000 = 250 → 25,000 pesewas
    expect(result.ssnitTier2EmployerMinor).toBe(25_000n);
    // Net is positive
    expect(result.netMinor).toBeGreaterThan(0n);
    // The PAYE recorded is positive (we're in the 17.5% band)
    expect(result.payeMinor).toBeGreaterThan(0n);
  });

  it('applies marriage relief and reduces PAYE accordingly', () => {
    const without = calculateGhanaMonthlyPayroll({
      basicSalaryMinor: 500_000n,
    });
    const withRelief = calculateGhanaMonthlyPayroll({
      basicSalaryMinor: 500_000n,
      reliefs: { marriageOrResponsibility: true },
    });
    expect(withRelief.payeMinor).toBeLessThan(without.payeMinor);
    expect(withRelief.netMinor).toBeGreaterThan(without.netMinor);
  });

  it('caps Tier 3 voluntary at 11%', () => {
    const r = calculateGhanaMonthlyPayroll({
      basicSalaryMinor: 1_000_000n, // 10,000 GHS
      tier3VoluntaryRate: 0.5,       // attempted 50% should be capped
    });
    // Cap is 11%: 11% × 10,000 = 1,100 GHS = 110,000 pesewas
    expect(r.tier3VoluntaryMinor).toBe(110_000n);
  });

  it('rejects negative inputs', () => {
    expect(() =>
      calculateGhanaMonthlyPayroll({ basicSalaryMinor: -1n }),
    ).toThrow();
  });

  it('formats GHS amounts correctly', () => {
    expect(formatGhs(123_456n)).toBe('GH₵1,234.56');
    expect(formatGhs(0n)).toBe('GH₵0.00');
    expect(formatGhs(99n)).toBe('GH₵0.99');
  });
});
