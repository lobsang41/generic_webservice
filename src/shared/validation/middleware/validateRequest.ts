import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ValidationError } from '@middleware/errorHandler';

/**
 * Options for request validation
 */
interface ValidationSchemas {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
}

/**
 * Middleware factory for validating requests with Zod schemas
 * 
 * @param schemas - Object containing Zod schemas for different parts of the request
 * @returns Express middleware function
 * 
 * @example
 * router.post('/users',
 *   validateRequest({ body: createUserSchema }),
 *   handler
 * );
 */
export function validateRequest(schemas: ValidationSchemas) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate body
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }

            // Validate query params
            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query);
            }

            // Validate URL params
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params);
            }

            // Validate headers
            if (schemas.headers) {
                req.headers = await schemas.headers.parseAsync(req.headers);
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Format Zod errors into a user-friendly structure
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }));

                // Throw ValidationError with formatted details
                const validationError = new ValidationError(
                    'Validation failed',
                    formattedErrors
                );
                next(validationError);
            } else {
                next(error);
            }
        }
    };
}

/**
 * Helper to validate a single value against a schema
 * Useful for manual validation in service layers
 */
export async function validateValue<T>(
    schema: ZodSchema<T>,
    value: unknown
): Promise<T> {
    try {
        return await schema.parseAsync(value);
    } catch (error) {
        if (error instanceof ZodError) {
            const formattedErrors = error.errors.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
            }));
            throw new ValidationError('Validation failed', formattedErrors);
        }
        throw error;
    }
}
