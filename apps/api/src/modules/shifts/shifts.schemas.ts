import { z } from 'zod';

export const CreateShiftSchema = z.object({
  title: z.string().min(1).max(160).trim(),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().max(160).optional(),
  assignedEmployeeId: z.string().cuid().optional(),
});
export type CreateShiftInput = z.infer<typeof CreateShiftSchema>;

export const UpdateShiftSchema = CreateShiftSchema.partial();

export const ListShiftsQuerySchema = z.object({
  status: z.enum(['open', 'claimed', 'assigned', 'completed', 'cancelled']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  assignedTo: z.string().cuid().optional(),
});
