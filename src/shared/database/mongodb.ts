/**
 * MONGODB DATABASE - DESACTIVADO TEMPORALMENTE
 * 
 * Usando solo MySQL por ahora.
 * Para reactivar MongoDB:
 * 1. Descomentar todo el código abajo
 * 2. Descomentar servicio 'mongodb' en docker-compose.yml
 * 3. Descomentar variables MONGODB_* en .env
 * 4. Descomentar inicialización en src/services/api-gateway/index.ts
 */

/*
import mongoose from 'mongoose';
import { config } from '@config/index';
import { logger } from '@utils/logger';

class MongoDatabase {
    private isConnected = false;

    async connect(): Promise<void> {
        if (this.isConnected) {
            logger.info('MongoDB already connected');
            return;
        }

        try {
            await mongoose.connect(config.mongodb.uri, {
                maxPoolSize: config.mongodb.poolSize,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
            });

            this.isConnected = true;
            logger.info('MongoDB connected successfully');

            mongoose.connection.on('error', (err) => {
                logger.error('MongoDB connection error', err);
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('MongoDB reconnected');
                this.isConnected = true;
            });

            process.on('SIGINT', async () => {
                await this.close();
                process.exit(0);
            });
        } catch (error) {
            logger.error('MongoDB connection failed', error);
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.isConnected || !mongoose.connection.db) {
                return false;
            }
            await mongoose.connection.db.admin().ping();
            return true;
        } catch (error) {
            logger.error('MongoDB health check failed', error);
            return false;
        }
    }

    async close(): Promise<void> {
        if (this.isConnected) {
            await mongoose.connection.close();
            this.isConnected = false;
            logger.info('MongoDB connection closed');
        }
    }

    getConnectionState(): string {
        const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        return states[mongoose.connection.readyState] || 'unknown';
    }

    isReady(): boolean {
        return this.isConnected && mongoose.connection.readyState === 1;
    }
}

export const mongoDB = new MongoDatabase();
export default mongoDB;

export { mongoose };
*/

// Mock export para evitar errores de importación
export const mongoDB = {
    connect: async () => {},
    healthCheck: async () => false,
    close: async () => {},
    getConnectionState: () => 'disconnected',
    isReady: () => false,
};
export default mongoDB;

// Mock mongoose export
export const mongoose = null;
