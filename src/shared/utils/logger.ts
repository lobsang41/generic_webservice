import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '@config/index';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Custom format for development
const devFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`,
    ),
);

// Custom format for production
const prodFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

// Create transports array
const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
        format: config.isDevelopment ? devFormat : prodFormat,
    }),
];

// Add file transports for production
if (!config.isTest) {
    // Error log file
    transports.push(
        new DailyRotateFile({
            filename: path.join(config.logging.dir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxFiles: '14d',
            maxSize: '20m',
            format: prodFormat,
        }),
    );

    // Combined log file
    transports.push(
        new DailyRotateFile({
            filename: path.join(config.logging.dir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: '14d',
            maxSize: '20m',
            format: prodFormat,
        }),
    );
}

// Create logger instance
export const logger = winston.createLogger({
    level: config.logging.level,
    levels,
    transports,
    exitOnError: false,
});

// Correlation ID tracking
export class LoggerWithCorrelation {
    private correlationId?: string;

    constructor(correlationId?: string) {
        this.correlationId = correlationId;
    }

    private formatMessage(message: string): string {
        return this.correlationId ? `[${this.correlationId}] ${message}` : message;
    }

    error(message: string, meta?: unknown) {
        logger.error(this.formatMessage(message), meta);
    }

    warn(message: string, meta?: unknown) {
        logger.warn(this.formatMessage(message), meta);
    }

    info(message: string, meta?: unknown) {
        logger.info(this.formatMessage(message), meta);
    }

    http(message: string, meta?: unknown) {
        logger.http(this.formatMessage(message), meta);
    }

    debug(message: string, meta?: unknown) {
        logger.debug(this.formatMessage(message), meta);
    }
}

export default logger;
