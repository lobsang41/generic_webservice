import { z } from 'zod';
import {
    paginationQuerySchema,
    uuidSchema,
    positiveIntSchema,
} from './common.schemas';

/**
 * Audit log validation schemas
 */

// List audit logs query schema
export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
    table: z.string().optional(),
    record_id: uuidSchema.optional(),
    action: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
    changed_by: z.string().optional(),
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
}).refine(
    (data) => {
        if (data.start_date && data.end_date) {
            return data.start_date <= data.end_date;
        }
        return true;
    },
    {
        message: 'Start date must be before or equal to end date',
    }
);

// Get audit log params schema
export const getAuditLogParamsSchema = z.object({
    id: uuidSchema,
});

// Retention configuration schema
export const retentionConfigSchema = z.object({
    retentionDays: positiveIntSchema
        .min(30, 'Minimum retention is 30 days')
        .max(730, 'Maximum retention is 730 days (2 years)'),
    cleanupEnabled: z.boolean(),
    cleanupHour: z.number()
        .int('Hour must be an integer')
        .min(0, 'Hour must be between 0 and 23')
        .max(23, 'Hour must be between 0 and 23'),
});

// Type exports
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type GetAuditLogParams = z.infer<typeof getAuditLogParamsSchema>;
export type RetentionConfigInput = z.infer<typeof retentionConfigSchema>;
