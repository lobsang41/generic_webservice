import { z } from 'zod';
import {
    emailSchema,
    passwordSchema,
    nameSchema,
    roleSchema,
    scopesArraySchema,
    uuidSchema,
    paginationQuerySchema,
} from './common.schemas';

/**
 * User validation schemas
 */

// Create user schema
export const createUserSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema.optional(),
    role: roleSchema.default('user'),
    scopes: scopesArraySchema,
});

// Update user schema
export const updateUserSchema = z.object({
    name: nameSchema.optional(),
    scopes: scopesArraySchema,
}).refine(
    (data) => data.name !== undefined || data.scopes !== undefined,
    {
        message: 'At least one field (name or scopes) must be provided',
    }
);

// Get user params schema
export const getUserParamsSchema = z.object({
    id: uuidSchema,
});

// List users query schema
export const listUsersQuerySchema = paginationQuerySchema;

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GetUserParams = z.infer<typeof getUserParamsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
