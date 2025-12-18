import NodeCache from 'node-cache';
import { logger } from '@utils/logger';

/**
 * NodeCache Service - Caché en memoria temporal
 * 
 * NOTA: Este es un reemplazo temporal de Redis.
 * Para producción, descomentar Redis en:
 * - docker-compose.yml
 * - src/shared/cache/redis.ts
 * - src/services/api-gateway/index.ts
 */
class NodeCacheService {
    private cache: NodeCache;
    private isConnected = true;

    constructor() {
        this.cache = new NodeCache({
            stdTTL: 600, // 10 minutos por defecto
            checkperiod: 120, // Verificar expiración cada 2 minutos
            useClones: false, // Mejor performance
        });

        logger.info('NodeCache initialized (in-memory cache)');
    }

    async get<T = string>(key: string): Promise<T | null> {
        try {
            const value = this.cache.get<T>(key);
            return value !== undefined ? value : null;
        } catch (error) {
            logger.error(`NodeCache GET failed for key: ${key}`, error);
            return null;
        }
    }

    async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
        try {
            return this.cache.set(key, value, ttl || 0);
        } catch (error) {
            logger.error(`NodeCache SET failed for key: ${key}`, error);
            return false;
        }
    }

    async del(key: string | string[]): Promise<number> {
        try {
            const keys = Array.isArray(key) ? key : [key];
            return this.cache.del(keys);
        } catch (error) {
            logger.error(`NodeCache DEL failed for key: ${key}`, error);
            return 0;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            return this.cache.has(key);
        } catch (error) {
            logger.error(`NodeCache EXISTS failed for key: ${key}`, error);
            return false;
        }
    }

    async expire(key: string, ttl: number): Promise<boolean> {
        try {
            return this.cache.ttl(key, ttl);
        } catch (error) {
            logger.error(`NodeCache EXPIRE failed for key: ${key}`, error);
            return false;
        }
    }

    async ttl(key: string): Promise<number> {
        try {
            const ttl = this.cache.getTtl(key);
            if (!ttl) return -2; // Key doesn't exist
            const remaining = Math.floor((ttl - Date.now()) / 1000);
            return remaining > 0 ? remaining : -1; // -1 = expired
        } catch (error) {
            logger.error(`NodeCache TTL failed for key: ${key}`, error);
            return -2;
        }
    }

    async incr(key: string): Promise<number> {
        try {
            const current = this.cache.get<number>(key) || 0;
            const newValue = current + 1;
            this.cache.set(key, newValue);
            return newValue;
        } catch (error) {
            logger.error(`NodeCache INCR failed for key: ${key}`, error);
            return 0;
        }
    }

    async decr(key: string): Promise<number> {
        try {
            const current = this.cache.get<number>(key) || 0;
            const newValue = current - 1;
            this.cache.set(key, newValue);
            return newValue;
        } catch (error) {
            logger.error(`NodeCache DECR failed for key: ${key}`, error);
            return 0;
        }
    }

    async keys(pattern: string): Promise<string[]> {
        try {
            const allKeys = this.cache.keys();
            // Simple pattern matching (supports * wildcard)
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return allKeys.filter(key => regex.test(key));
        } catch (error) {
            logger.error(`NodeCache KEYS failed for pattern: ${pattern}`, error);
            return [];
        }
    }

    async flushdb(): Promise<boolean> {
        try {
            this.cache.flushAll();
            return true;
        } catch (error) {
            logger.error('NodeCache FLUSHDB failed', error);
            return false;
        }
    }

    async healthCheck(): Promise<boolean> {
        // NodeCache is always available (in-memory)
        return this.isConnected;
    }

    async close(): Promise<void> {
        this.cache.close();
        this.isConnected = false;
        logger.info('NodeCache closed');
    }

    isReady(): boolean {
        return this.isConnected;
    }

    getClient(): NodeCache {
        return this.cache;
    }

    // Estadísticas útiles para debugging
    getStats() {
        return this.cache.getStats();
    }
}

export const nodeCache = new NodeCacheService();
export default nodeCache;
