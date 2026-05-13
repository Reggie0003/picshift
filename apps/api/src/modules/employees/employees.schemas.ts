import { z } from 'zod';
import {
  BvnSchema,
  GhanaCardSchema,
  GhanaTinSchema,
  GhMomoSchema,
  NinSchema,
  NgPhoneSchema,
  SsnitSchema,
} from '@/lib/validators-gh-ng.js';

const BankAccountSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6,20}$/, 'Bank account must be 6–20 digits');

export const EmploymentTypeSchema = z.enum([
  'full_time',
  'part_time',
  'contractor',
  'intern',
  'temporary',
]);
export const PayFrequencySchema = z.enum(['weekly', 'biweekly', 'monthly', 'quarterly']);

export const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  preferredName: z.string().max(80).trim().optional(),
  workEmail: z.string().email().toLowerCase().optional(),
  workPhone: z.string().max(40).trim().optional(),

  // PII (will be encrypted before storage)
  ghanaCard: GhanaCardSchema.optional(),
  ssnitNumber: SsnitSchema.optional(),
  tin: GhanaTinSchema.optional(),
  bvn: BvnSchema.optional(),
  nin: NinSchema.optional(),
  passport: z.string().min(4).max(40).trim().optional(),
  dob: z.string().date().optional(), // ISO yyyy-mm-dd
  address: z.string().max(500).trim().optional(),
  emergencyContact: z.string().max(500).trim().optional(),

  // Banking
  bankName: z.string().max(120).trim().optional(),
  bankAccount: BankAccountSchema.optional(),
  bankBranch: z.string().max(120).trim().optional(),
  swiftCode: z.string().max(11).trim().optional(),

  // MoMo (Ghana priority)
  momoProvider: z.enum(['mtn', 'vodafone', 'airteltigo', 'mpesa']).optional(),
  momoNumber: z
    .union([GhMomoSchema, NgPhoneSchema])
    .optional(),

  // Employment
  employmentType: EmploymentTypeSchema.default('full_time'),
  jobTitle: z.string().max(160).trim().optional(),
  department: z.string().max(120).trim().optional(),
  managerId: z.string().cuid().optional(),
  hiredAt: z.string().datetime().optional(),
  baseSalaryMinor: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Salary in minor units (pesewas/kobo) — multiply major × 100'),
  payFrequency: PayFrequencySchema.default('monthly'),
  currency: z.enum(['GHS', 'NGN', 'USD', 'EUR', 'GBP']).default('GHS'),
});
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial();
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

export const ListEmployeesQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['pending', 'active', 'on_leave', 'suspended', 'terminated']).optional(),
  department: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
export type ListEmployeesQuery = z.infer<typeof ListEmployeesQuerySchema>;
