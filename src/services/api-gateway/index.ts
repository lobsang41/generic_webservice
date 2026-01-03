import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '@config/index';
import { logger } from '@utils/logger';
import { requestLogger } from '@middleware/requestLogger';
import { errorHandler, notFoundHandler } from '@middleware/errorHandler';
import { metricsMiddleware, metricsHandler } from '@monitoring/prometheus';
import { healthCheckHandler, livenessHandler, readinessHandler } from '@monitoring/healthCheck';
// DESACTIVADO: Usando solo MySQL por ahora
// import postgresDB from '@database/postgres';
// import mongoDB from '@database/mongodb';
// import rabbitmqService from '@messaging/rabbitmq';

// Import routes
import apiRoutes from './routes/index';

class APIGateway {
    public app: Application;
    private server: unknown;

    constructor() {
        this.app = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddlewares() {
        // Security
        this.app.use(helmet({
            contentSecurityPolicy: false, // Permitir inline scripts para el dashboard
        }));
        this.app.use(cors({
            origin: config.cors.origin,
            credentials: config.cors.credentials,
        }));

        // Parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Compression
        this.app.use(compression());

        // Static files (dashboard)
        this.app.use(express.static('public'));

        // Logging
        this.app.use(requestLogger);

        // Metrics
        this.app.use(metricsMiddleware);
    }

    private initializeRoutes() {
        // Health checks
        this.app.get('/health', healthCheckHandler);
        this.app.get('/ready', readinessHandler);
        this.app.get('/live', livenessHandler);

        // Metrics
        this.app.get('/metrics', metricsHandler);

        // API routes
        this.app.use(`/api/${config.apiVersion}`, apiRoutes);

        // Root endpoint
        this.app.get('/', (req: Request, res: Response) => {
            res.json({
                name: 'Enterprise API Gateway',
                version: config.apiVersion,
                status: 'running',
                timestamp: new Date().toISOString(),
            });
        });
    }

    private initializeErrorHandling() {
        // 404 handler
        this.app.use(notFoundHandler);

        // Global error handler
        this.app.use(errorHandler);
    }

    async initializeDatabases() {
        try {
            logger.info('Connecting to databases...');
            // DESACTIVADO: Solo MySQL por ahora (se conecta automáticamente en las rutas)
            // await Promise.all([
            //     postgresDB.connect(),
            //     mongoDB.connect(),
            // ]);
            logger.info('MySQL will connect on first query');
        } catch (error) {
            logger.error('Database connection failed', error);
            throw error;
        }
    }

    async initializeMessaging() {
        try {
            // DESACTIVADO: Sin mensajería por ahora
            // logger.info('Connecting to message queue...');
            // await rabbitmqService.connect();
            // logger.info('Message queue connected successfully');
            logger.info('Message queue disabled');
        } catch (error) {
            logger.warn('Message queue connection failed, continuing without it', error);
        }
    }

    async start() {
        try {
            // Initialize databases
            await this.initializeDatabases();

            // Initialize messaging (non-critical)
            await this.initializeMessaging().catch(() => {
                logger.warn('Starting without message queue');
            });

            // Start server
            this.server = this.app.listen(config.port, () => {
                logger.info(`🚀 API Gateway listening on port ${config.port}`);
                logger.info(`📊 Environment: ${config.env}`);
                logger.info(`📡 Health check: http://localhost:${config.port}/health`);
                logger.info(`📈 Metrics: http://localhost:${config.port}/metrics`);
                logger.info(`🔗 API: http://localhost:${config.port}/api/${config.apiVersion}`);
            });

            this.setupGracefulShutdown();
        } catch (error) {
            logger.error('Failed to start API Gateway', error);
            process.exit(1);
        }
    }

    private setupGracefulShutdown() {
        const shutdown = async (signal: string) => {
            logger.info(`${signal} received, starting graceful shutdown...`);

            // Close server
            if (this.server && typeof (this.server as { close: (cb: () => void) => void }).close === 'function') {
                (this.server as { close: (cb: () => void) => void }).close(() => {
                    logger.info('HTTP server closed');
                });
            }

            // Close databases
            // DESACTIVADO: Solo MySQL por ahora
            // await Promise.all([
            //     postgresDB.close(),
            //     mongoDB.close(),
            //     rabbitmqService.close(),
            // ]);

            logger.info('Graceful shutdown completed');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}

// Create and start the API Gateway
const gateway = new APIGateway();

if (require.main === module) {
    gateway.start().catch((error) => {
        logger.error('Fatal error during startup', error);
        process.exit(1);
    });
}

export default gateway;
