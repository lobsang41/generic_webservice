import mysql from 'mysql2/promise';
import { config } from '@config/index';
import { logger } from '@utils/logger';

class MySQLDatabase {
    private pool: mysql.Pool | null = null;
    private isConnected = false;

    constructor() {
        this.initialize();
    }

    private initialize() {
        this.pool = mysql.createPool({
            host: config.mysql.host,
            port: config.mysql.port,
            database: config.mysql.database,
            user: config.mysql.user,
            password: config.mysql.password,
            connectionLimit: config.mysql.pool.max,
            waitForConnections: true,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });

        // Test connection
        this.pool.getConnection()
            .then((connection) => {
                this.isConnected = true;
                logger.info('MySQL pool connected successfully');
                connection.release();
            })
            .catch((error) => {
                logger.error('MySQL pool initialization failed', error);
            });
    }

    async connect(): Promise<void> {
        try {
            if (!this.pool) {
                throw new Error('MySQL pool not initialized');
            }
            const connection = await this.pool.getConnection();
            connection.release();
            logger.info('MySQL connection test successful');
            this.isConnected = true;
        } catch (error) {
            logger.error('MySQL connection failed', error);
            throw error;
        }
    }

    async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        if (!this.pool) {
            throw new Error('MySQL pool not initialized');
        }

        const start = Date.now();
        try {
            const [rows] = await this.pool.execute(sql, params);
            const duration = Date.now() - start;
            logger.debug(`Executed MySQL query in ${duration}ms`, { sql });
            return rows as T[];
        } catch (error) {
            logger.error('MySQL query execution failed', { sql, params, error });
            throw error;
        }
    }

    async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
        const rows = await this.query<T>(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }

    async insert(sql: string, params?: unknown[]): Promise<number> {
        if (!this.pool) {
            throw new Error('MySQL pool not initialized');
        }

        try {
            const [result] = await this.pool.execute(sql, params);
            const insertResult = result as mysql.ResultSetHeader;
            return insertResult.insertId;
        } catch (error) {
            logger.error('MySQL insert failed', { sql, params, error });
            throw error;
        }
    }

    async transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
        if (!this.pool) {
            throw new Error('MySQL pool not initialized');
        }

        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            logger.error('MySQL transaction failed, rolled back', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            return true;
        } catch (error) {
            logger.error('MySQL health check failed', error);
            return false;
        }
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            logger.info('MySQL pool closed');
        }
    }

    isReady(): boolean {
        return this.isConnected;
    }

    getPool(): mysql.Pool | null {
        return this.pool;
    }
}

export const mysqlDB = new MySQLDatabase();
export default mysqlDB;
