import { logger } from '@utils/logger';
import {
    webhookConfigService,
    webhookDeliveryService,
    WebhookConfig,
} from './webhookService';
import { buildSignatureHeaders } from './webhookSigner';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WebhookQueueItem {
    delivery_id: string;
    webhook_config: WebhookConfig;
    payload: object;
    attempt: number;
}

export interface WebhookSendResult {
    success: boolean;
    status_code?: number;
    response_body?: string;
    error?: string;
    duration_ms: number;
}

// ============================================================================
// WEBHOOK QUEUE
// ============================================================================

class WebhookQueue {
    private queue: WebhookQueueItem[] = [];
    private processing: boolean = false;
    private processingInterval: NodeJS.Timeout | null = null;

    /**
     * Inicia el procesamiento de la cola
     */
    start(): void {
        if (this.processingInterval) {
            logger.warn('Webhook queue already running');
            return;
        }

        logger.info('📬 Starting webhook queue processor');

        // Procesar cola cada 5 segundos
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, 5000);

        // Procesar inmediatamente
        this.processQueue();
    }

    /**
     * Detiene el procesamiento de la cola
     */
    stop(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            logger.info('🛑 Webhook queue processor stopped');
        }
    }

    /**
     * Encola un webhook para envío
     */
    async enqueue(
        client_id: string,
        event_type: string,
        payload: object
    ): Promise<void> {
        try {
            // Obtener configuraciones activas para este evento
            const configs = await webhookConfigService.getActiveWebhookConfigsForEvent(
                client_id,
                event_type
            );

            if (configs.length === 0) {
                logger.debug('No active webhook configs for event', { client_id, event_type });
                return;
            }

            // Crear entregas para cada configuración
            for (const config of configs) {
                const delivery = await webhookDeliveryService.createDelivery(
                    config.id,
                    client_id,
                    event_type,
                    payload
                );

                this.queue.push({
                    delivery_id: delivery.id,
                    webhook_config: config,
                    payload,
                    attempt: 0,
                });

                logger.info('Webhook enqueued', {
                    delivery_id: delivery.id,
                    event_type,
                    url: config.url,
                });
            }

            // Procesar inmediatamente si no está procesando
            if (!this.processing) {
                setImmediate(() => this.processQueue());
            }
        } catch (error) {
            logger.error('Error enqueuing webhook', { error, client_id, event_type });
        }
    }

    /**
     * Procesa la cola de webhooks
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        try {
            // También procesar reintentos pendientes de la DB
            await this.processRetries();

            // Procesar items en cola
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                if (item) {
                    await this.processWebhook(item);
                }
            }
        } catch (error) {
            logger.error('Error processing webhook queue', { error });
        } finally {
            this.processing = false;
        }
    }

    /**
     * Procesa reintentos pendientes desde la DB
     */
    private async processRetries(): Promise<void> {
        try {
            const pendingRetries = await webhookDeliveryService.getPendingRetries();

            for (const delivery of pendingRetries) {
                const config = await webhookConfigService.getWebhookConfigById(
                    delivery.webhook_config_id
                );

                if (!config || !config.enabled) {
                    continue;
                }

                await this.processWebhook({
                    delivery_id: delivery.id,
                    webhook_config: config,
                    payload: delivery.payload,
                    attempt: delivery.attempts,
                });
            }
        } catch (error) {
            logger.error('Error processing retries', { error });
        }
    }

    /**
     * Procesa un webhook individual
     */
    private async processWebhook(item: WebhookQueueItem): Promise<void> {
        const { delivery_id, webhook_config, payload, attempt } = item;

        logger.info('Processing webhook', {
            delivery_id,
            url: webhook_config.url,
            attempt: attempt + 1,
        });

        try {
            // Enviar webhook
            const result = await this.sendWebhook(webhook_config, payload);

            if (result.success) {
                // Éxito
                await webhookDeliveryService.updateDeliveryStatus(delivery_id, 'success', {
                    response_status: result.status_code,
                    response_body: result.response_body,
                    duration_ms: result.duration_ms,
                });

                logger.info('✅ Webhook delivered successfully', {
                    delivery_id,
                    status: result.status_code,
                    duration: `${result.duration_ms}ms`,
                });
            } else {
                // Fallo - determinar si reintentar
                const delivery = await webhookDeliveryService.getDeliveryById(delivery_id);
                
                if (delivery && delivery.attempts + 1 < delivery.max_attempts) {
                    // Reintentar con backoff exponencial
                    const nextRetryDelay = this.calculateBackoff(delivery.attempts + 1);
                    const nextRetryAt = new Date(Date.now() + nextRetryDelay);

                    await webhookDeliveryService.updateDeliveryStatus(delivery_id, 'retrying', {
                        response_status: result.status_code,
                        error_message: result.error,
                        duration_ms: result.duration_ms,
                        next_retry_at: nextRetryAt,
                    });

                    logger.warn('⚠️ Webhook failed, will retry', {
                        delivery_id,
                        attempt: delivery.attempts + 1,
                        max_attempts: delivery.max_attempts,
                        next_retry: nextRetryAt.toISOString(),
                        error: result.error,
                    });
                } else {
                    // No más reintentos
                    await webhookDeliveryService.updateDeliveryStatus(delivery_id, 'failed', {
                        response_status: result.status_code,
                        error_message: result.error,
                        duration_ms: result.duration_ms,
                    });

                    logger.error('❌ Webhook failed permanently', {
                        delivery_id,
                        error: result.error,
                    });
                }
            }
        } catch (error) {
            logger.error('Error processing webhook', { error, delivery_id });
        }
    }

    /**
     * Envía un webhook HTTP
     */
    private async sendWebhook(
        config: WebhookConfig,
        payload: object
    ): Promise<WebhookSendResult> {
        const startTime = Date.now();

        try {
            // Construir headers con firma
            const signatureHeaders = buildSignatureHeaders(payload, config.secret);
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Enterprise-Webhook/1.0',
                ...signatureHeaders,
                ...config.custom_headers,
            };

            // Enviar request
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), config.timeout_ms);

            const response = await fetch(config.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            const duration_ms = Date.now() - startTime;
            const response_body = await response.text();

            // Considerar 2xx como éxito
            const success = response.status >= 200 && response.status < 300;

            return {
                success,
                status_code: response.status,
                response_body: response_body.substring(0, 1000), // Limitar tamaño
                duration_ms,
                error: success ? undefined : `HTTP ${response.status}`,
            };
        } catch (error: any) {
            const duration_ms = Date.now() - startTime;

            return {
                success: false,
                duration_ms,
                error: error.message || 'Unknown error',
            };
        }
    }

    /**
     * Calcula el delay de backoff exponencial
     */
    private calculateBackoff(attempt: number): number {
        // Backoff: 1s, 5s, 15s
        const delays = [1000, 5000, 15000];
        return delays[Math.min(attempt - 1, delays.length - 1)];
    }

    /**
     * Obtiene el estado de la cola
     */
    getStatus(): { running: boolean; queue_size: number } {
        return {
            running: this.processingInterval !== null,
            queue_size: this.queue.length,
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const webhookQueue = new WebhookQueue();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Encola un webhook de threshold de uso
 */
export async function sendUsageThresholdWebhook(
    client_id: string,
    threshold: number,
    usage_data: {
        current_usage: number;
        limit: number;
        percentage: number;
        billing_cycle_start: string;
    }
): Promise<void> {
    const event_type = `usage.threshold.${threshold}`;
    
    const payload = {
        event: event_type,
        client_id,
        threshold,
        timestamp: new Date().toISOString(),
        data: usage_data,
    };

    await webhookQueue.enqueue(client_id, event_type, payload);
}

/**
 * Encola un webhook de cuota excedida
 */
export async function sendQuotaExceededWebhook(
    client_id: string,
    usage_data: {
        current_usage: number;
        limit: number;
        overage: number;
        billing_cycle_start: string;
    }
): Promise<void> {
    const event_type = 'usage.quota.exceeded';
    
    const payload = {
        event: event_type,
        client_id,
        timestamp: new Date().toISOString(),
        data: usage_data,
    };

    await webhookQueue.enqueue(client_id, event_type, payload);
}
