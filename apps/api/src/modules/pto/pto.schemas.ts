import { z } from 'zod';

export const PtoCategorySchema = z.enum([
  'annual',
  'sick',
  'maternity',
  'paternity',
  'bereavement',
  'unpaid',
  'study',
  'other',
]);

export const CreatePolicySchema = z.object({
  name: z.string().min(2).max(120).trim(),
  category: PtoCategorySchema,
  defaultDaysPerYear: z.coerce.number().nonnegative().max(365).default(15),
  accrualMethod: z.enum(['anniversary', 'calendar', 'per_pay_period']).default('anniversary'),
  carryOverDays: z.coerce.number().nonnegative().max(365).default(0),
  maxBalanceDays: z.coerce.number().nonnegative().max(365).optional(),
  requiresApproval: z.boolean().default(true),
  appliesToTypes: z
    .array(z.enum(['full_time', 'part_time', 'contractor', 'intern', 'temporary']))
    .default(['full_time']),
});
export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;

export const RequestPtoSchema = z.object({
  employeeId: z.string().cuid(),
  policyId: z.string().cuid(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().max(500).optional(),
});
export type RequestPtoInput = z.infer<typeof RequestPtoSchema>;

export const DecidePtoSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
});
