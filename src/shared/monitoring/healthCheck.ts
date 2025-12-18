import { Request, Response } from 'express';
// DESACTIVADO: Usando solo MySQL por ahora
// import postgresDB from '@database/postgres';
// import mongoDB from '@database/mongodb';
import mysqlDB from '@database/mysql';
import nodeCache from '@cache/nodeCache';

export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
        [key: string]: {
            status: 'up' | 'down';
            message?: string;
            latency?: number;
        };
    };
    uptime: number;
}

class HealthCheckService {
    private startTime: number;

    constructor() {
        this.startTime = Date.now();
    }

    // DESACTIVADO: PostgreSQL
    /*
    async checkPostgres(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
        const start = Date.now();
        try {
            const isHealthy = await postgresDB.healthCheck();
            const latency = Date.now() - start;
            return {
                status: isHealthy ? 'up' : 'down',
                latency,
            };
        } catch (error) {
            return {
                status: 'down',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    */

    async checkMySQL(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
        const start = Date.now();
        try {
            const isHealthy = await mysqlDB.healthCheck();
            const latency = Date.now() - start;
            return {
                status: isHealthy ? 'up' : 'down',
                latency,
            };
        } catch (error) {
            return {
                status: 'down',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // DESACTIVADO: MongoDB
    /*
    async checkMongoDB(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
        const start = Date.now();
        try {
            const isHealthy = await mongoDB.healthCheck();
            const latency = Date.now() - start;
            return {
                status: isHealthy ? 'up' : 'down',
                latency,
            };
        } catch (error) {
            return {
                status: 'down',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    */

    async checkCache(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
        const start = Date.now();
        try {
            const isHealthy = await nodeCache.healthCheck();
            const latency = Date.now() - start;
            return {
                status: isHealthy ? 'up' : 'down',
                latency,
            };
        } catch (error) {
            return {
                status: 'down',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async getFullHealthCheck(): Promise<HealthCheckResult> {
        const [mysql, cache] = await Promise.all([
            this.checkMySQL(),
            this.checkCache(),
        ]);

        const services = {
            mysql,
            cache,
        };

        // Determine overall status
        const allUp = Object.values(services).every((s) => s.status === 'up');
        const anyDown = Object.values(services).some((s) => s.status === 'down');

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (allUp) {
            status = 'healthy';
        } else if (anyDown) {
            // If MySQL is down, mark as unhealthy
            if (mysql.status === 'down') {
                status = 'unhealthy';
            } else {
                status = 'degraded';
            }
        } else {
            status = 'degraded';
        }

        return {
            status,
            timestamp: new Date().toISOString(),
            services,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
        };
    }

    // Simplified health check for liveness probe
    async isAlive(): Promise<boolean> {
        return true; // Service is running
    }

    // Readiness check - can the service handle requests?
    async isReady(): Promise<boolean> {
        const mysql = await this.checkMySQL();
        // Service is ready if MySQL is up
        return mysql.status === 'up';
    }

    getUptime(): number {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
}

export const healthCheckService = new HealthCheckService();

// Health check endpoint handler
export const healthCheckHandler = async (req: Request, res: Response) => {
    const healthCheck = await healthCheckService.getFullHealthCheck();
    const statusCode = healthCheck.status === 'healthy' ? 200 : healthCheck.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
};

// Liveness probe handler
export const livenessHandler = async (req: Request, res: Response) => {
    const isAlive = await healthCheckService.isAlive();
    res.status(isAlive ? 200 : 503).json({
        status: isAlive ? 'alive' : 'dead',
        timestamp: new Date().toISOString(),
    });
};

// Readiness probe handler
export const readinessHandler = async (req: Request, res: Response) => {
    const isReady = await healthCheckService.isReady();
    res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'not ready',
        timestamp: new Date().toISOString(),
    });
};

export default healthCheckService;
