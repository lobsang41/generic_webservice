import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerWithCorrelation } from '@utils/logger';

declare global {
    namespace Express {
        interface Request {
            correlationId: string;
            logger: LoggerWithCorrelation;
            startTime: number;
        }
    }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    // Generate or extract correlation ID
    req.correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    req.startTime = Date.now();

    // Create logger with correlation ID
    req.logger = new LoggerWithCorrelation(req.correlationId);

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', req.correlationId);

    // Log request
    req.logger.http(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        req.logger.http(`${req.method} ${req.path} - ${res.statusCode} [${duration}ms]`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            contentLength: res.get('content-length'),
        });
    });

    next();
};
