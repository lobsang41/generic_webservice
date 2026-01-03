import { Request, Response, NextFunction } from 'express';
import { nodeCache } from '@cache/nodeCache';
import { logger } from '@utils/logger';
import { RateLimitError } from './errorHandler';

/**
 * Middleware de rate limiting basado en el tier del cliente
 * Usa node-cache para tracking en memoria
 */
export const clientRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Solo aplicar si hay un cliente autenticado
        if (!req.client || !req.clientApiKey) {
            return next();
        }

        const client = req.client;
        const tier = client.tier;
        const limit = tier.max_api_calls_per_minute;

        // Clave única para este cliente en el cache
        const cacheKey = `ratelimit:client:${client.id}:minute`;

        // Obtener contador actual
        const currentCount = await nodeCache.get<number>(cacheKey) || 0;

        // Verificar si se excedió el límite
        if (currentCount >= limit) {
            logger.warn(`Rate limit exceeded for client ${client.id} (${client.name})`, {
                current: currentCount,
                limit,
                tier: tier.name,
            });

            // Agregar headers de rate limit
            res.setHeader('X-RateLimit-Limit', limit.toString());
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', '60'); // Segundos hasta reset

            throw new RateLimitError(
                `Rate limit exceeded. Your plan allows ${limit} requests per minute. Please upgrade or wait.`,
            );
        }

        // Incrementar contador
        const newCount = currentCount + 1;
        await nodeCache.set(cacheKey, newCount, 60); // TTL de 60 segundos

        // Agregar headers de rate limit
        const remaining = Math.max(0, limit - newCount);
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', '60');

        logger.debug(`Rate limit check passed for client ${client.id}`, {
            current: newCount,
            limit,
            remaining,
        });

        next();
    } catch (error) {
        if (error instanceof RateLimitError) {
            next(error);
        } else {
            logger.error('Rate limiter error', error);
            // En caso de error del cache, permitir la request
            next();
        }
    }
};

/**
 * Factory para crear rate limiters personalizados por endpoint
 */
export const createClientRateLimiter = (options: {
    requestsPerMinute?: number;
    message?: string;
}) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.client || !req.clientApiKey) {
                return next();
            }

            const client = req.client;
            const limit = options.requestsPerMinute || client.tier.max_api_calls_per_minute;
            const cacheKey = `ratelimit:client:${client.id}:custom:${req.path}`;

            const currentCount = await nodeCache.get<number>(cacheKey) || 0;

            if (currentCount >= limit) {
                res.setHeader('X-RateLimit-Limit', limit.toString());
                res.setHeader('X-RateLimit-Remaining', '0');
                res.setHeader('X-RateLimit-Reset', '60');

                throw new RateLimitError(
                    options.message || `Rate limit exceeded for this endpoint (${limit}/min)`,
                );
            }

            const newCount = currentCount + 1;
            await nodeCache.set(cacheKey, newCount, 60);

            const remaining = Math.max(0, limit - newCount);
            res.setHeader('X-RateLimit-Limit', limit.toString());
            res.setHeader('X-RateLimit-Remaining', remaining.toString());
            res.setHeader('X-RateLimit-Reset', '60');

            next();
        } catch (error) {
            if (error instanceof RateLimitError) {
                next(error);
            } else {
                logger.error('Custom rate limiter error', error);
                next();
            }
        }
    };
};

export default {
    clientRateLimiter,
    createClientRateLimiter,
};
