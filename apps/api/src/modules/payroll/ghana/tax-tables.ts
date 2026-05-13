/**
 * Ghana PAYE tax tables — 2026 fiscal year.
 *
 * Source authority:
 *   - Income Tax Act 2015 (Act 896) as amended
 *   - Finance Act 2024, 2025 (any 2026 revisions applied below)
 *   - Ghana Revenue Authority (GRA) — Personal Income Tax: Monthly PAYE Schedule
 *
 * NOTE: Tax tables change annually with each Finance Act. The bands below
 * encode the most recent published GRA monthly PAYE schedule. Before each
 * tax year roll-over, run `npm run payroll:verify-tables` (see scripts) to
 * cross-check against the GRA's current schedule. The PayrollRun record
 * stores the band version used so historical payslips remain auditable.
 *
 * Amounts are in GHS (Ghana Cedis) major units (not pesewas) in this file
 * — converted to minor units at calculation time.
 */

export interface TaxBand {
  /** Lower bound (exclusive). For the first band, this is 0. */
  upTo: number;
  /** Rate applied to income up to `upTo` minus the previous band's `upTo`. */
  rate: number;
}

/**
 * Ghana PAYE — MONTHLY bands (GHS).
 *
 * The structure is cumulative-marginal: the first GHS 490/month is taxed at
 * 0%, the next GHS 110 at 5%, etc. The GRA monthly chargeable-income
 * schedule (effective 2024 Mid-Year Budget through 2026 update) is encoded
 * here. The 35% top band on chargeable income above GHS 50,000/month was
 * introduced by the Income Tax (Amendment) Act 2023 (Act 1094).
 */
export const GH_PAYE_MONTHLY_2026: readonly TaxBand[] = [
  { upTo: 490, rate: 0.00 },     // first GHS 490 — tax-free
  { upTo: 600, rate: 0.05 },     // next GHS 110 @ 5%
  { upTo: 730, rate: 0.10 },     // next GHS 130 @ 10%
  { upTo: 3_896.67, rate: 0.175 }, // next GHS 3,166.67 @ 17.5%
  { upTo: 19_896.67, rate: 0.25 }, // next GHS 16,000 @ 25%
  { upTo: 50_416.67, rate: 0.30 }, // next GHS 30,520 @ 30%
  { upTo: Infinity, rate: 0.35 },  // remainder @ 35%
] as const;

/**
 * Ghana SSNIT (Social Security and National Insurance Trust) contributions.
 *
 *   Tier 1: 13.5% of monthly basic salary → SSNIT (employer pays)
 *           Of this, 11% comes from a 13.5% employer remittance and 2.5%
 *           from the employee's 5.5%. Net: employee 5.5%, employer 13%
 *           — but GRA defines it as: 18.5% total → 13.5% to SSNIT (Tier 1),
 *             5% mandatory to private occupational pension (Tier 2).
 *   Tier 2: 5% of monthly basic salary → private fund manager (employer)
 *   Tier 3: voluntary, up to 16.5% combined employer + employee
 *
 * Employee contribution is deducted from gross salary BEFORE income tax —
 * National Pensions Act 2008 (Act 766) §3(1)(a).
 *
 * Reference: National Pensions Act 2008 (Act 766) §3, §1(a)(i)(ii)(iii).
 */
export const GH_SSNIT = {
  TIER1_EMPLOYER_RATE: 0.13,    // 13% of basic salary — employer pays to SSNIT
  TIER1_EMPLOYEE_RATE: 0.055,   // 5.5% — deducted from employee gross
  TIER2_EMPLOYER_RATE: 0.05,    // 5% — mandatory occupational pension
  TIER3_VOLUNTARY_MAX: 0.165,   // up to 16.5% combined (tax-deductible)
} as const;

/**
 * GRA reliefs (annual amounts in GHS). Applied AFTER computing chargeable
 * income but BEFORE looking up the band. Encoded here so payroll can claim
 * them automatically when the employee declares them via /employees PATCH.
 *
 * Reference: Income Tax Act 2015 (Act 896) §51, §52, First Schedule.
 */
export const GH_RELIEFS_ANNUAL = {
  MARRIAGE_OR_RESPONSIBILITY: 1_200,  // §51(1)(a)
  CHILD_EDUCATION_PER_CHILD: 600,     // up to 3 children
  CHILD_EDUCATION_MAX_CHILDREN: 3,
  AGED_DEPENDANT: 1_000,              // §51(1)(c)
  AGED_DEPENDANT_MAX: 2,
  DISABILITY: 0.25,                   // 25% of personal income — §51(1)(d)
  AGED: 1_500,                        // employee aged 60+ — §51(1)(e)
  PROFESSIONAL_TRAINING_MAX: 2_000,   // §51(1)(f)
} as const;

/**
 * National Health Insurance Levy (NHIL), GETFund Levy, and COVID-19 Health
 * Recovery Levy — applied at the POINT OF SALE on VAT-eligible goods, NOT on
 * payroll. Documented here for completeness so the payroll team doesn't
 * mistakenly add them to employee deductions.
 *
 *   NHIL          2.5%   (Act 651 + Health Insurance Act 852)
 *   GETFund Levy  2.5%   (Education Trust Fund Act 581)
 *   COVID-19      1.0%   (COVID-19 Health Recovery Levy Act 2021, Act 1068)
 *
 * These are EMPLOYER-side compliance items if Pic Shift sells subscriptions,
 * not payroll deductions.
 */
export const GH_NON_PAYROLL_LEVIES = {
  NHIL: 0.025,
  GETFUND: 0.025,
  COVID19: 0.01,
} as const;

/**
 * Ghana Labour Act 2003 (Act 651) §35 overtime:
 *   - 1.5× hourly rate for work beyond contractual hours on a normal day
 *   - 2× hourly rate for rest days and public holidays
 *
 * Standard work-week §33: 40 hours.
 */
export const GH_OVERTIME = {
  WEEKLY_STANDARD_HOURS: 40,
  RATE_WEEKDAY: 1.5,
  RATE_REST_DAY_OR_HOLIDAY: 2.0,
} as const;
