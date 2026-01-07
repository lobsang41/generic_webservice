import { z } from 'zod';
import {
    nameSchema,
    positiveIntSchema,
    nonNegativeIntSchema,
    uuidSchema,
} from './common.schemas';

/**
 * Tier validation schemas
 */

// Create tier schema
export const createTierSchema = z.object({
    name: nameSchema,
    max_api_calls_per_month: positiveIntSchema.nullable(),
    max_api_calls_per_minute: positiveIntSchema,
    price_monthly: nonNegativeIntSchema.default(0),
});

// Update tier schema
export const updateTierSchema = z.object({
    name: nameSchema.optional(),
    max_api_calls_per_month: positiveIntSchema.nullable().optional(),
    max_api_calls_per_minute: positiveIntSchema.optional(),
    price_monthly: nonNegativeIntSchema.optional(),
    is_active: z.boolean().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    {
        message: 'At least one field must be provided for update',
    }
);

// Get tier params schema
export const getTierParamsSchema = z.object({
    id: uuidSchema,
});

// Type exports
export type CreateTierInput = z.infer<typeof createTierSchema>;
export type UpdateTierInput = z.infer<typeof updateTierSchema>;
export type GetTierParams = z.infer<typeof getTierParamsSchema>;
