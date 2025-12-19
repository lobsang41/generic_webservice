import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
// DESACTIVADO: Usando almacenamiento en memoria por ahora
// import RedisStore from 'rate-limit-redis';
// import redisCache from '@cache/redis';
import { config } from '@config/index';
import { RateLimitError } from './errorHandler';

// DESACTIVADO: Redis store para rate limiting
// Para reactivar: descomentar imports arriba y descomentar esta función
/*
const createRedisStore = () => {
    const client = redisCache.getClient();
    if (!client) {
        throw new Error('Redis client not available for rate limiting');
    }

    return new RedisStore({
        // @ts-expect-error - Type mismatch between ioredis and expected type
        sendCommand: (...args: string[]) => client.call(...args),
        prefix: 'ratelimit:',
    });
};
*/

// Standard rate limiter for public endpoints
export const publicRateLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    // DESACTIVADO: Usando almacenamiento en memoria en lugar de Redis
    // store: createRedisStore(),
    message: 'Too many requests from this IP, please try again later',
    handler: (req: Request, res: Response) => {
        throw new RateLimitError('Rate limit exceeded');
    },
    skip: (req: Request) => {
        // Skip rate limiting in test environment
        return config.isTest;
    },
});

// Authenticated user rate limiter (higher limit)
export const authenticatedRateLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequestsAuth,
    standardHeaders: true,
    legacyHeaders: false,
    // DESACTIVADO: Usando almacenamiento en memoria en lugar de Redis
    // store: createRedisStore(),
    message: 'Too many requests, please try again later',
    keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.userId || req.ip || 'unknown';
    },
    handler: (req: Request, res: Response) => {
        throw new RateLimitError('Rate limit exceeded');
    },
    skip: (req: Request) => {
        return config.isTest;
    },
});

// Strict rate limiter for sensitive operations (e.g., login, registration)
export const strictRateLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Increased from 5 to 10 to reduce false positives
    standardHeaders: true,
    legacyHeaders: false,
    // DESACTIVADO: Usando almacenamiento en memoria en lugar de Redis
    // store: createRedisStore(),
    message: 'Too many attempts, please try again later',
    handler: (req: Request, res: Response) => {
        throw new RateLimitError('Too many attempts. Please try again in 15 minutes');
    },
    skip: (req: Request) => {
        return config.isTest;
    },
});

// Custom rate limiter factory
export const createCustomRateLimiter = (options: {
    windowMs: number;
    max: number;
    message?: string;
}): RateLimitRequestHandler => {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        // DESACTIVADO: Usando almacenamiento en memoria en lugar de Redis
        // store: createRedisStore(),
        message: options.message || 'Rate limit exceeded',
        handler: (req: Request, res: Response) => {
            throw new RateLimitError(options.message || 'Rate limit exceeded');
        },
        skip: (req: Request) => {
            return config.isTest;
        },
    });
};

// Middleware to apply different rate limits based on authentication
export const adaptiveRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
        return authenticatedRateLimiter(req, res, next);
    }
    return publicRateLimiter(req, res, next);
};

export default {
    publicRateLimiter,
    authenticatedRateLimiter,
    strictRateLimiter,
    adaptiveRateLimiter,
    createCustomRateLimiter,
};
