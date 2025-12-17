import client from 'prom-client';
import { Request, Response } from 'express';
import { config } from '@config/index';

// Create a Registry
export const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
    register,
    prefix: 'enterprise_',
});

// Custom metrics
export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [register],
});

export const httpRequestTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

export const httpRequestErrors = new client.Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP request errors',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

export const activeConnections = new client.Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [register],
});

export const databaseQueryDuration = new client.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['database', 'operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
});

export const cacheHits = new client.Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type'],
    registers: [register],
});

export const cacheMisses = new client.Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type'],
    registers: [register],
});

export const queueMessageProcessed = new client.Counter({
    name: 'queue_messages_processed_total',
    help: 'Total number of queue messages processed',
    labelNames: ['queue_name', 'status'],
    registers: [register],
});

export const authenticationAttempts = new client.Counter({
    name: 'authentication_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['method', 'status'],
    registers: [register],
});

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: () => void) => {
    const start = Date.now();

    activeConnections.inc();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        const statusCode = res.statusCode.toString();

        httpRequestDuration.observe(
            { method: req.method, route, status_code: statusCode },
            duration,
        );

        httpRequestTotal.inc({
            method: req.method,
            route,
            status_code: statusCode,
        });

        if (res.statusCode >= 400) {
            httpRequestErrors.inc({
                method: req.method,
                route,
                status_code: statusCode,
            });
        }

        activeConnections.dec();
    });

    next();
};

// Metrics endpoint handler
export const metricsHandler = async (req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};

export default {
    register,
    metricsMiddleware,
    metricsHandler,
    httpRequestDuration,
    httpRequestTotal,
    httpRequestErrors,
    activeConnections,
    databaseQueryDuration,
    cacheHits,
    cacheMisses,
    queueMessageProcessed,
    authenticationAttempts,
};
