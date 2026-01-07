import { z } from 'zod';

/**
 * Common validation schemas used across the application
 */

// Email validation with proper regex
export const emailSchema = z
    .string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email is too long');

// UUID v4 validation
export const uuidSchema = z
    .string()
    .uuid('Invalid UUID format');

// Password validation
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long');

// Name validation
export const nameSchema = z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name is too long')
    .trim();

// Pagination schemas
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
});

// Date range validation
export const dateRangeSchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
}).refine(
    (data) => {
        if (data.startDate && data.endDate) {
            return data.startDate <= data.endDate;
        }
        return true;
    },
    {
        message: 'Start date must be before or equal to end date',
    }
);

// Scopes array validation
export const scopesArraySchema = z
    .array(z.string().regex(/^[a-z_]+:[a-z_]+$/, 'Invalid scope format'))
    .min(1, 'At least one scope is required')
    .optional();

// Role validation
export const roleSchema = z.enum(['admin', 'user'], {
    errorMap: () => ({ message: 'Role must be either "admin" or "user"' }),
});

// ISO date string
export const isoDateSchema = z
    .string()
    .datetime('Invalid ISO date format');

// Positive integer
export const positiveIntSchema = z
    .number()
    .int('Must be an integer')
    .positive('Must be a positive number');

// Non-negative integer (includes 0)
export const nonNegativeIntSchema = z
    .number()
    .int('Must be an integer')
    .nonnegative('Must be a non-negative number');

// Boolean from string (for query params)
export const booleanFromString = z
    .enum(['true', 'false'])
    .transform((val) => val === 'true');

// Slug validation (lowercase, alphanumeric with hyphens)
export const slugSchema = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
    .min(1, 'Slug is required')
    .max(100, 'Slug is too long');

// API Key name validation
export const apiKeyNameSchema = z
    .string()
    .min(1, 'API key name is required')
    .max(100, 'API key name is too long')
    .trim();

// Expiration days (for API keys)
export const expirationDaysSchema = z
    .number()
    .int('Must be an integer')
    .positive('Must be a positive number')
    .max(365, 'Maximum expiration is 365 days')
    .optional();
