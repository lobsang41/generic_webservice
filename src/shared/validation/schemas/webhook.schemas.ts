import { z } from 'zod';
import { nanoidSchema } from './common.schemas';

/**
 * Webhook validation schemas
 */

// Validación de URL de webhook
export const webhookUrlSchema = z
    .string()
    .url('Invalid URL format')
    .refine(
        (url) => {
            // En producción, solo permitir HTTPS
            if (process.env.NODE_ENV === 'production') {
                return url.startsWith('https://');
            }
            // En desarrollo, permitir HTTP para testing local
            return url.startsWith('http://') || url.startsWith('https://');
        },
        {
            message: 'Webhook URL must use HTTPS in production',
        }
    )
    .refine(
        (url) => {
            // No permitir localhost/127.0.0.1 en producción
            if (process.env.NODE_ENV === 'production') {
                return !url.includes('localhost') && !url.includes('127.0.0.1');
            }
            return true;
        },
        {
            message: 'Localhost URLs are not allowed in production',
        }
    );

// Eventos de webhook válidos
export const webhookEventSchema = z.enum([
    'usage.threshold.80',
    'usage.threshold.100',
    'usage.quota.exceeded',
    'usage.reset',
]);

// Custom headers
export const customHeadersSchema = z
    .record(z.string(), z.string())
    .optional()
    .refine(
        (headers) => {
            if (!headers) return true;
            // No permitir override de headers críticos
            const forbiddenHeaders = [
                'content-type',
                'user-agent',
                'x-webhook-timestamp',
                'x-webhook-signature',
                'x-webhook-signature-version',
            ];
            return !Object.keys(headers).some((key) =>
                forbiddenHeaders.includes(key.toLowerCase())
            );
        },
        {
            message: 'Cannot override system headers',
        }
    );

// Create webhook config schema
export const createWebhookConfigSchema = z.object({
    client_id: nanoidSchema,
    url: webhookUrlSchema,
    events: z.array(webhookEventSchema).min(1, 'At least one event is required').optional(),
    custom_headers: customHeadersSchema,
    timeout_ms: z
        .number()
        .int('Timeout must be an integer')
        .min(1000, 'Minimum timeout is 1000ms')
        .max(30000, 'Maximum timeout is 30000ms')
        .optional(),
});

// Update webhook config schema
export const updateWebhookConfigSchema = z.object({
    url: webhookUrlSchema.optional(),
    enabled: z.boolean().optional(),
    events: z.array(webhookEventSchema).min(1, 'At least one event is required').optional(),
    custom_headers: customHeadersSchema,
    timeout_ms: z
        .number()
        .int('Timeout must be an integer')
        .min(1000, 'Minimum timeout is 1000ms')
        .max(30000, 'Maximum timeout is 30000ms')
        .optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    {
        message: 'At least one field must be provided for update',
    }
);

// Get webhook config params
export const getWebhookConfigParamsSchema = z.object({
    id: nanoidSchema,
});

// Get webhook deliveries query
export const getWebhookDeliveriesQuerySchema = z.object({
    client_id: nanoidSchema.optional(),
    status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
    event_type: webhookEventSchema.optional(),
    limit: z.coerce.number().int().positive().max(100).default(50),
});

// Test webhook schema
export const testWebhookSchema = z.object({
    url: webhookUrlSchema,
    payload: z.record(z.any()).optional(),
});

// Type exports
export type CreateWebhookConfigInput = z.infer<typeof createWebhookConfigSchema>;
export type UpdateWebhookConfigInput = z.infer<typeof updateWebhookConfigSchema>;
export type GetWebhookConfigParams = z.infer<typeof getWebhookConfigParamsSchema>;
export type GetWebhookDeliveriesQuery = z.infer<typeof getWebhookDeliveriesQuerySchema>;
export type TestWebhookInput = z.infer<typeof testWebhookSchema>;
