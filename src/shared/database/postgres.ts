import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '@config/index';
import { logger } from '@utils/logger';

class PostgresDatabase {
    private pool: Pool | null = null;
    private isConnected = false;

    constructor() {
        this.initialize();
    }

    private initialize() {
        this.pool = new Pool({
            host: config.postgres.host,
            port: config.postgres.port,
            database: config.postgres.database,
            user: config.postgres.user,
            password: config.postgres.password,
            min: config.postgres.pool.min,
            max: config.postgres.pool.max,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        // Handle pool errors
        this.pool.on('error', (err) => {
            logger.error('Unexpected PostgreSQL pool error', err);
        });

        // Handle pool connection
        this.pool.on('connect', () => {
            if (!this.isConnected) {
                this.isConnected = true;
                logger.info('PostgreSQL pool connected successfully');
            }
        });

        // Handle pool disconnection
        this.pool.on('remove', () => {
            logger.warn('PostgreSQL client removed from pool');
        });
    }

    async connect(): Promise<void> {
        try {
            if (!this.pool) {
                throw new Error('PostgreSQL pool not initialized');
            }
            const client = await this.pool.connect();
            client.release();
            logger.info('PostgreSQL connection test successful');
        } catch (error) {
            logger.error('PostgreSQL connection failed', error);
            throw error;
        }
    }

    async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
        if (!this.pool) {
            throw new Error('PostgreSQL pool not initialized');
        }

        const start = Date.now();
        try {
            const result = await this.pool.query<T>(text, params);
            const duration = Date.now() - start;
            logger.debug(`Executed query in ${duration}ms`, { text, rows: result.rowCount });
            return result;
        } catch (error) {
            logger.error('Query execution failed', { text, params, error });
            throw error;
        }
    }

    async getClient(): Promise<PoolClient> {
        if (!this.pool) {
            throw new Error('PostgreSQL pool not initialized');
        }
        return this.pool.connect();
    }

    async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Transaction failed, rolled back', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            return true;
        } catch (error) {
            logger.error('PostgreSQL health check failed', error);
            return false;
        }
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            logger.info('PostgreSQL pool closed');
        }
    }

    getPoolStats() {
        if (!this.pool) {
            return null;
        }
        return {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount,
        };
    }
}

export const postgresDB = new PostgresDatabase();
export default postgresDB;
