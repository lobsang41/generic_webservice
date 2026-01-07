import { z } from 'zod';
import {
    apiKeyNameSchema,
    expirationDaysSchema,
    uuidSchema,
} from './common.schemas';

/**
 * API Key validation schemas
 */

// Create client API key schema
export const createClientApiKeySchema = z.object({
    name: apiKeyNameSchema,
    environment: z.enum(['development', 'staging', 'production']).default('production'),
    expiresInDays: expirationDaysSchema,
});

// Client ID params schema
export const clientIdParamsSchema = z.object({
    clientId: uuidSchema,
});

// Revoke client API key params schema
export const revokeClientApiKeyParamsSchema = z.object({
    clientId: uuidSchema,
    keyId: uuidSchema,
});

// Type exports
export type CreateClientApiKeyInput = z.infer<typeof createClientApiKeySchema>;
export type ClientIdParams = z.infer<typeof clientIdParamsSchema>;
export type RevokeClientApiKeyParams = z.infer<typeof revokeClientApiKeyParamsSchema>;
