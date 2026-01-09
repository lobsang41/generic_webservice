import { z } from 'zod';
import {
    nameSchema,
    slugSchema,
    emailSchema,
    uuidSchema,
    nanoidSchema,
    paginationQuerySchema,
} from './common.schemas';

/**
 * Client validation schemas
 */

// Create client schema
export const createClientSchema = z.object({
    name: nameSchema,
    slug: slugSchema,
    tier_id: uuidSchema, // Los tier IDs son UUIDs
    contact_email: emailSchema,
    contact_name: nameSchema,
});

// Update client schema
export const updateClientSchema = z.object({
    name: nameSchema.optional(),
    tier_id: uuidSchema.optional(), // Los tier IDs son UUIDs
    contact_email: emailSchema.optional(),
    contact_name: nameSchema.optional(),
    is_active: z.boolean().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    {
        message: 'At least one field must be provided for update',
    }
);

// Get client params schema
export const getClientParamsSchema = z.object({
    id: nanoidSchema, // Los client IDs son nanoids
});

// List clients query schema
export const listClientsQuerySchema = paginationQuerySchema.extend({
    tier_id: uuidSchema.optional(),
    is_active: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
});

// Get client usage params schema
export const getClientUsageParamsSchema = z.object({
    id: nanoidSchema, // Los client IDs son nanoids
});

// Reset usage params schema
export const resetUsageParamsSchema = z.object({
    id: nanoidSchema, // Los client IDs son nanoids
});

// Type exports
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type GetClientParams = z.infer<typeof getClientParamsSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
