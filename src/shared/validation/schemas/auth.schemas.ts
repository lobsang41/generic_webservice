import { z } from 'zod';
import {
    emailSchema,
    passwordSchema,
    nameSchema,
    apiKeyNameSchema,
    expirationDaysSchema,
} from './common.schemas';

/**
 * Authentication validation schemas
 */

// Register schema
export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
});

// Login schema
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

// Refresh token schema
export const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Create API key schema
export const createApiKeySchema = z.object({
    name: apiKeyNameSchema,
    expiresInDays: expirationDaysSchema,
});

// Revoke API key params schema
export const revokeApiKeyParamsSchema = z.object({
    id: z.string().min(1, 'API key ID is required'),
});

// Type exports for TypeScript
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
