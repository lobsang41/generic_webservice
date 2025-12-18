/**
 * RABBITMQ MESSAGING - DESACTIVADO TEMPORALMENTE
 * 
 * Sin mensajería por ahora.
 * Para reactivar RabbitMQ:
 * 1. Descomentar todo el código abajo
 * 2. Descomentar servicio 'rabbitmq' en docker-compose.yml
 * 3. Descomentar variables RABBITMQ_* en .env
 * 4. Descomentar inicialización en src/services/api-gateway/index.ts
 */

/*
import amqp from 'amqplib';
import type { Channel, Connection, ConsumeMessage } from 'amqplib';
import { config } from '@config/index';
import { logger } from '@utils/logger';
import { EventEmitter } from 'events';

export type MessageHandler = (message: unknown, rawMessage: ConsumeMessage) => Promise<void>;

class RabbitMQService extends EventEmitter {
    private connection: Connection | null = null;
    private channel: Channel | null = null;
    private isConnected = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    async connect(): Promise<void> {
        try {
            this.connection = await amqp.connect(config.rabbitmq.url) as any as Connection;
            this.channel = await (this.connection as any).createChannel();
            this.isConnected = true;

            if (this.channel) {
                await this.channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });
            }

            logger.info('RabbitMQ connected successfully');

            this.connection.on('error', (err) => {
                logger.error('RabbitMQ connection error', err);
                this.isConnected = false;
            });

            this.connection.on('close', () => {
                logger.warn('RabbitMQ connection closed');
                this.isConnected = false;
                this.reconnect();
            });

            this.emit('connected');
        } catch (error) {
            logger.error('RabbitMQ connection failed', error);
            this.reconnect();
            throw error;
        }
    }

    private reconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = setTimeout(() => {
            logger.info('Attempting to reconnect to RabbitMQ...');
            this.connect().catch((err) => {
                logger.error('RabbitMQ reconnection failed', err);
            });
        }, 5000);
    }

    async publish(routingKey: string, message: unknown): Promise<boolean> {
        try {
            if (!this.channel || !this.isConnected) {
                throw new Error('RabbitMQ not connected');
            }

            const content = Buffer.from(JSON.stringify(message));

            const published = this.channel.publish(
                config.rabbitmq.exchange,
                routingKey,
                content,
                { persistent: true },
            );

            logger.debug(`Published message to ${routingKey}`);
            return published;
        } catch (error) {
            logger.error(`Failed to publish message to ${routingKey}`, error);
            return false;
        }
    }

    async subscribe(queueName: string, routingKey: string, handler: MessageHandler): Promise<void> {
        try {
            if (!this.channel || !this.isConnected) {
                throw new Error('RabbitMQ not connected');
            }

            const fullQueueName = `${config.rabbitmq.queuePrefix}.${queueName}`;

            await this.channel.assertQueue(fullQueueName, {
                durable: true,
                deadLetterExchange: `${config.rabbitmq.exchange}.dlx`,
            });

            await this.channel.bindQueue(fullQueueName, config.rabbitmq.exchange, routingKey);

            await this.channel.consume(
                fullQueueName,
                async (msg) => {
                    if (!msg) return;

                    try {
                        const content = JSON.parse(msg.content.toString());
                        await handler(content, msg);
                        this.channel?.ack(msg);
                        logger.debug(`Processed message from ${queueName}`);
                    } catch (error) {
                        logger.error(`Failed to process message from ${queueName}`, error);
                        this.channel?.nack(msg, false, false);
                    }
                },
                { noAck: false },
            );

            logger.info(`Subscribed to queue: ${fullQueueName} with routing key: ${routingKey}`);
        } catch (error) {
            logger.error(`Failed to subscribe to queue: ${queueName}`, error);
            throw error;
        }
    }

    async createQueue(queueName: string): Promise<void> {
        if (!this.channel || !this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }

        const fullQueueName = `${config.rabbitmq.queuePrefix}.${queueName}`;
        await this.channel.assertQueue(fullQueueName, { durable: true });
        logger.info(`Created queue: ${fullQueueName}`);
    }

    async deleteQueue(queueName: string): Promise<void> {
        if (!this.channel || !this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }

        const fullQueueName = `${config.rabbitmq.queuePrefix}.${queueName}`;
        await this.channel.deleteQueue(fullQueueName);
        logger.info(`Deleted queue: ${fullQueueName}`);
    }

    async close(): Promise<void> {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        if (this.channel) {
            await this.channel.close();
        }

        if (this.connection) {
            await (this.connection as any).close();
        }

        this.isConnected = false;
        logger.info('RabbitMQ connection closed');
    }

    isReady(): boolean {
        return this.isConnected && this.channel !== null;
    }
}

export const rabbitmqService = new RabbitMQService();
export default rabbitmqService;
*/

// Mock export para evitar errores de importación
import { EventEmitter } from 'events';

export type MessageHandler = (message: unknown, rawMessage: any) => Promise<void>;

class RabbitMQServiceMock extends EventEmitter {
    async connect() {}
    async publish() { return false; }
    async subscribe() {}
    async createQueue() {}
    async deleteQueue() {}
    async close() {}
    isReady() { return false; }
}

export const rabbitmqService = new RabbitMQServiceMock();
export default rabbitmqService;
