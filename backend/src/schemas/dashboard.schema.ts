import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const date = z.string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()))
  .transform((value) => new Date(value));

const dateRange = {
  from: date.optional(),
  to: date.optional(),
};

function validDateRange(value: { from?: Date; to?: Date }): boolean {
  return !value.from || !value.to || value.from <= value.to;
}

export const DashboardDateRangeQuerySchema = z.object(dateRange)
  .refine(validDateRange);

export const PopularDishesQuerySchema = z.object({
  ...dateRange,
  limit: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default(10),
  type: z.enum(['KITCHEN', 'SERVICE']).optional(),
}).refine(validDateRange);

export const ActivityLogQuerySchema = z.object({
  ...dateRange,
  userId: objectId.optional(),
  type: z.enum(['ALL', 'KDS', 'POS', 'TAS', 'CUSTOMER']).optional(),
}).refine(validDateRange);
