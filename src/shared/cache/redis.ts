import Redis from 'ioredis';
import { config } from '@config/index';
import { logger } from '@utils/logger';

class RedisCache {
    private client: Redis | null = null;
    private isConnected = false;

    constructor() {
        this.initialize();
    }

    private initialize() {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password || undefined,
            db: config.redis.db,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                logger.warn(`Redis reconnecting... attempt ${times}`);
                return delay;
            },
            maxRetriesPerRequest: 3,
        });

        this.client.on('connect', () => {
            this.isConnected = true;
            logger.info('Redis connected successfully');
        });

        this.client.on('error', (err) => {
            logger.error('Redis connection error', err);
            this.isConnected = false;
        });

        this.client.on('close', () => {
            this.isConnected = false;
            logger.warn('Redis connection closed');
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis reconnecting...');
        });
    }

    async get<T = string>(key: string): Promise<T | null> {
        try {
            if (!this.client) return null;
            const value = await this.client.get(key);
            if (!value) return null;

            try {
                return JSON.parse(value) as T;
            } catch {
                return value as T;
            }
        } catch (error) {
            logger.error(`Redis GET failed for key: ${key}`, error);
            return null;
        }
    }

    async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
        try {
            if (!this.client) return false;
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

            if (ttl) {
                await this.client.setex(key, ttl, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }
            return true;
        } catch (error) {
            logger.error(`Redis SET failed for key: ${key}`, error);
            return false;
        }
    }

    async del(key: string | string[]): Promise<number> {
        try {
            if (!this.client) return 0;
            return await this.client.del(key);
        } catch (error) {
            logger.error(`Redis DEL failed for key: ${key}`, error);
            return 0;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            if (!this.client) return false;
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            logger.error(`Redis EXISTS failed for key: ${key}`, error);
            return false;
        }
    }

    async expire(key: string, ttl: number): Promise<boolean> {
        try {
            if (!this.client) return false;
            const result = await this.client.expire(key, ttl);
            return result === 1;
        } catch (error) {
            logger.error(`Redis EXPIRE failed for key: ${key}`, error);
            return false;
        }
    }

    async ttl(key: string): Promise<number> {
        try {
            if (!this.client) return -2;
            return await this.client.ttl(key);
        } catch (error) {
            logger.error(`Redis TTL failed for key: ${key}`, error);
            return -2;
        }
    }

    async incr(key: string): Promise<number> {
        try {
            if (!this.client) return 0;
            return await this.client.incr(key);
        } catch (error) {
            logger.error(`Redis INCR failed for key: ${key}`, error);
            return 0;
        }
    }

    async decr(key: string): Promise<number> {
        try {
            if (!this.client) return 0;
            return await this.client.decr(key);
        } catch (error) {
            logger.error(`Redis DECR failed for key: ${key}`, error);
            return 0;
        }
    }

    async keys(pattern: string): Promise<string[]> {
        try {
            if (!this.client) return [];
            return await this.client.keys(pattern);
        } catch (error) {
            logger.error(`Redis KEYS failed for pattern: ${pattern}`, error);
            return [];
        }
    }

    async flushdb(): Promise<boolean> {
        try {
            if (!this.client) return false;
            await this.client.flushdb();
            return true;
        } catch (error) {
            logger.error('Redis FLUSHDB failed', error);
            return false;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.client) return false;
            const result = await this.client.ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('Redis health check failed', error);
            return false;
        }
    }

    async close(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            logger.info('Redis connection closed');
        }
    }

    isReady(): boolean {
        return this.isConnected && this.client?.status === 'ready';
    }

    getClient(): Redis | null {
        return this.client;
    }
}

export const redisCache = new RedisCache();
export default redisCache;
