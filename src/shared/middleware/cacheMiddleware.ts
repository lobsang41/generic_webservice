import { Request, Response, NextFunction } from 'express';
import redisCache from '@cache/redis';
import { logger } from '@utils/logger';
import crypto from 'crypto';

interface CacheOptions {
    ttl?: number;
    keyPrefix?: string;
    generateKey?: (req: Request) => string;
}

const defaultKeyGenerator = (req: Request): string => {
    const { method, originalUrl, query, body } = req;
    const dataToHash = JSON.stringify({ method, originalUrl, query, body });
    return crypto.createHash('md5').update(dataToHash).digest('hex');
};

export const cacheMiddleware = (options: CacheOptions = {}) => {
    const {
        ttl = 300, // 5 minutes default
        keyPrefix = 'cache:',
        generateKey = defaultKeyGenerator,
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const cacheKey = keyPrefix + generateKey(req);

        try {
            // Try to get cached response
            const cachedData = await redisCache.get<{ body: unknown; headers: Record<string, string> }>(cacheKey);

            if (cachedData) {
                logger.debug(`Cache hit for key: ${cacheKey}`);

                // Set cached headers
                if (cachedData.headers) {
                    Object.entries(cachedData.headers).forEach(([key, value]) => {
                        res.setHeader(key, value);
                    });
                }

                res.setHeader('X-Cache', 'HIT');
                return res.json(cachedData.body);
            }

            logger.debug(`Cache miss for key: ${cacheKey}`);
            res.setHeader('X-Cache', 'MISS');

            // Store original json method
            const originalJson = res.json.bind(res);

            // Override json method to cache response
            res.json = function (body: unknown) {
                // Don't cache error responses
                if (res.statusCode >= 400) {
                    return originalJson(body);
                }

                // Store in cache
                const dataToCache = {
                    body,
                    headers: {
                        'Content-Type': res.getHeader('Content-Type') as string,
                    },
                };

                redisCache.set(cacheKey, dataToCache, ttl).catch((err) => {
                    logger.error('Failed to cache response', err);
                });

                return originalJson(body);
            };

            next();
        } catch (error) {
            logger.error('Cache middleware error', error);
            // Continue without caching on error
            next();
        }
    };
};

export const invalidateCache = async (pattern: string): Promise<number> => {
    try {
        const keys = await redisCache.keys(pattern);
        if (keys.length === 0) {
            return 0;
        }
        return await redisCache.del(keys);
    } catch (error) {
        logger.error('Cache invalidation failed', error);
        return 0;
    }
};

export default cacheMiddleware;
