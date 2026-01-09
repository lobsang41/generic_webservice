import { nanoid } from 'nanoid';
import mysqlDB from '@database/mysql';
import { logger } from '@utils/logger';
import { generateWebhookSecret } from './webhookSigner';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WebhookConfig {
    id: string;
    client_id: string;
    url: string;
    secret: string;
    enabled: boolean;
    events: string[];
    custom_headers?: Record<string, string>;
    timeout_ms: number;
    created_at: Date;
    updated_at: Date;
    created_by?: string;
}

export interface WebhookDelivery {
    id: string;
    webhook_config_id: string;
    client_id: string;
    event_type: string;
    payload: object;
    status: 'pending' | 'success' | 'failed' | 'retrying';
    attempts: number;
    max_attempts: number;
    response_status?: number;
    response_body?: string;
    error_message?: string;
    duration_ms?: number;
    next_retry_at?: Date;
    delivered_at?: Date;
    created_at: Date;
    updated_at: Date;
}

export interface UsageNotification {
    id: string;
    client_id: string;
    threshold: number;
    billing_cycle_start: Date;
    notified_at: Date;
}

export interface CreateWebhookConfigInput {
    client_id: string;
    url: string;
    events?: string[];
    custom_headers?: Record<string, string>;
    timeout_ms?: number;
    created_by?: string;
}

export interface UpdateWebhookConfigInput {
    url?: string;
    enabled?: boolean;
    events?: string[];
    custom_headers?: Record<string, string>;
    timeout_ms?: number;
}

// ============================================================================
// WEBHOOK CONFIG SERVICE
// ============================================================================

export const webhookConfigService = {
    /**
     * Crea una nueva configuración de webhook
     */
    async createWebhookConfig(input: CreateWebhookConfigInput): Promise<WebhookConfig> {
        const id = nanoid();
        const secret = generateWebhookSecret();
        const events = input.events || ['usage.threshold.80', 'usage.threshold.100'];
        const timeout_ms = input.timeout_ms || 5000;

        const sql = `INSERT INTO webhook_configs 
            (id, client_id, url, secret, events, custom_headers, timeout_ms, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        await mysqlDB.query(sql, [
            id,
            input.client_id,
            input.url,
            secret,
            JSON.stringify(events),
            input.custom_headers ? JSON.stringify(input.custom_headers) : null,
            timeout_ms,
            input.created_by || null,
        ]);

        logger.info('Webhook config created', { id, client_id: input.client_id });

        return this.getWebhookConfigById(id) as Promise<WebhookConfig>;
    },

    /**
     * Obtiene configuración de webhook por ID
     */
    async getWebhookConfigById(id: string): Promise<WebhookConfig | null> {
        const rows = await mysqlDB.query<any>(
            'SELECT * FROM webhook_configs WHERE id = ?',
            [id]
        );

        if (rows.length === 0) return null;

        return this.mapRowToWebhookConfig(rows[0]);
    },

    /**
     * Obtiene configuraciones de webhook por cliente
     */
    async getWebhookConfigsByClient(client_id: string): Promise<WebhookConfig[]> {
        const rows = await mysqlDB.query<any>(
            'SELECT * FROM webhook_configs WHERE client_id = ? ORDER BY created_at DESC',
            [client_id]
        );

        return rows.map((row: any) => this.mapRowToWebhookConfig(row));
    },

    /**
     * Obtiene configuraciones activas para un evento específico
     */
    async getActiveWebhookConfigsForEvent(
        client_id: string,
        event_type: string
    ): Promise<WebhookConfig[]> {
        const rows = await mysqlDB.query<any>(
            `SELECT * FROM webhook_configs 
            WHERE client_id = ? 
            AND enabled = TRUE 
            AND JSON_CONTAINS(events, ?)`,
            [client_id, JSON.stringify(event_type)]
        );

        return rows.map((row: any) => this.mapRowToWebhookConfig(row));
    },

    /**
     * Actualiza configuración de webhook
     */
    async updateWebhookConfig(
        id: string,
        updates: UpdateWebhookConfigInput
    ): Promise<WebhookConfig | null> {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.url !== undefined) {
            fields.push('url = ?');
            values.push(updates.url);
        }
        if (updates.enabled !== undefined) {
            fields.push('enabled = ?');
            values.push(updates.enabled);
        }
        if (updates.events !== undefined) {
            fields.push('events = ?');
            values.push(JSON.stringify(updates.events));
        }
        if (updates.custom_headers !== undefined) {
            fields.push('custom_headers = ?');
            values.push(JSON.stringify(updates.custom_headers));
        }
        if (updates.timeout_ms !== undefined) {
            fields.push('timeout_ms = ?');
            values.push(updates.timeout_ms);
        }

        if (fields.length === 0) {
            return this.getWebhookConfigById(id);
        }

        values.push(id);

        await mysqlDB.query(
            `UPDATE webhook_configs SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        logger.info('Webhook config updated', { id, updates });

        return this.getWebhookConfigById(id);
    },

    /**
     * Elimina configuración de webhook
     */
    async deleteWebhookConfig(id: string): Promise<boolean> {
        await mysqlDB.query(
            'DELETE FROM webhook_configs WHERE id = ?',
            [id]
        );

        logger.info('Webhook config deleted', { id });

        return true;
    },

    /**
     * Regenera el secret de un webhook
     */
    async regenerateSecret(id: string): Promise<string> {
        const newSecret = generateWebhookSecret();

        await mysqlDB.query(
            'UPDATE webhook_configs SET secret = ? WHERE id = ?',
            [newSecret, id]
        );

        logger.info('Webhook secret regenerated', { id });

        return newSecret;
    },

    /**
     * Mapea row de DB a WebhookConfig
     */
    mapRowToWebhookConfig(row: any): WebhookConfig {
        return {
            id: row.id,
            client_id: row.client_id,
            url: row.url,
            secret: row.secret,
            enabled: Boolean(row.enabled),
            events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
            custom_headers: row.custom_headers 
                ? (typeof row.custom_headers === 'string' ? JSON.parse(row.custom_headers) : row.custom_headers)
                : undefined,
            timeout_ms: row.timeout_ms,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by: row.created_by,
        };
    },
};

// ============================================================================
// WEBHOOK DELIVERY SERVICE
// ============================================================================

export const webhookDeliveryService = {
    /**
     * Crea un registro de entrega de webhook
     */
    async createDelivery(
        webhook_config_id: string,
        client_id: string,
        event_type: string,
        payload: object,
        max_attempts: number = 3
    ): Promise<WebhookDelivery> {
        const id = nanoid();

        await mysqlDB.query(
            `INSERT INTO webhook_deliveries 
            (id, webhook_config_id, client_id, event_type, payload, max_attempts) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [id, webhook_config_id, client_id, event_type, JSON.stringify(payload), max_attempts]
        );

        logger.info('Webhook delivery created', { id, event_type, client_id });

        return this.getDeliveryById(id) as Promise<WebhookDelivery>;
    },

    /**
     * Obtiene entrega por ID
     */
    async getDeliveryById(id: string): Promise<WebhookDelivery | null> {
        const rows = await mysqlDB.query<any>(
            'SELECT * FROM webhook_deliveries WHERE id = ?',
            [id]
        );

        if (rows.length === 0) return null;

        return this.mapRowToDelivery(rows[0]);
    },

    /**
     * Obtiene entregas por cliente
     */
    async getDeliveriesByClient(
        client_id: string,
        limit: number = 50
    ): Promise<WebhookDelivery[]> {
        // Validar y sanitizar limit
        const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 1000);
        
        const rows = await mysqlDB.query<any>(
            `SELECT * FROM webhook_deliveries 
            WHERE client_id = ? 
            ORDER BY created_at DESC 
            LIMIT ${safeLimit}`,
            [client_id]
        );

        return rows.map((row: any) => this.mapRowToDelivery(row));
    },

    /**
     * Obtiene entregas pendientes de reintento
     */
    async getPendingRetries(): Promise<WebhookDelivery[]> {
        const rows = await mysqlDB.query<any>(
            `SELECT * FROM webhook_deliveries 
            WHERE status IN ('pending', 'retrying') 
            AND attempts < max_attempts 
            AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY created_at ASC 
            LIMIT 100`
        );

        return rows.map((row: any) => this.mapRowToDelivery(row));
    },

    /**
     * Actualiza el estado de una entrega
     */
    async updateDeliveryStatus(
        id: string,
        status: 'success' | 'failed' | 'retrying',
        details: {
            response_status?: number;
            response_body?: string;
            error_message?: string;
            duration_ms?: number;
            next_retry_at?: Date;
        }
    ): Promise<void> {
        const fields: string[] = ['status = ?', 'attempts = attempts + 1'];
        const values: any[] = [status];

        if (details.response_status !== undefined) {
            fields.push('response_status = ?');
            values.push(details.response_status);
        }
        if (details.response_body !== undefined) {
            fields.push('response_body = ?');
            values.push(details.response_body);
        }
        if (details.error_message !== undefined) {
            fields.push('error_message = ?');
            values.push(details.error_message);
        }
        if (details.duration_ms !== undefined) {
            fields.push('duration_ms = ?');
            values.push(details.duration_ms);
        }
        if (details.next_retry_at !== undefined) {
            fields.push('next_retry_at = ?');
            values.push(details.next_retry_at);
        }
        if (status === 'success') {
            fields.push('delivered_at = NOW()');
        }

        values.push(id);

        await mysqlDB.query(
            `UPDATE webhook_deliveries SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        logger.info('Webhook delivery updated', { id, status });
    },

    /**
     * Mapea row de DB a WebhookDelivery
     */
    mapRowToDelivery(row: any): WebhookDelivery {
        return {
            id: row.id,
            webhook_config_id: row.webhook_config_id,
            client_id: row.client_id,
            event_type: row.event_type,
            payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
            status: row.status,
            attempts: row.attempts,
            max_attempts: row.max_attempts,
            response_status: row.response_status,
            response_body: row.response_body,
            error_message: row.error_message,
            duration_ms: row.duration_ms,
            next_retry_at: row.next_retry_at,
            delivered_at: row.delivered_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    },
};

// ============================================================================
// USAGE NOTIFICATION SERVICE
// ============================================================================

export const usageNotificationService = {
    /**
     * Verifica si ya se envió notificación para este threshold
     */
    async hasBeenNotified(
        client_id: string,
        threshold: number,
        billing_cycle_start: Date
    ): Promise<boolean> {
        const rows = await mysqlDB.query<any>(
            `SELECT id FROM usage_notifications 
            WHERE client_id = ? AND threshold = ? AND billing_cycle_start = ?`,
            [client_id, threshold, billing_cycle_start]
        );

        return rows.length > 0;
    },

    /**
     * Registra que se envió una notificación
     */
    async markAsNotified(
        client_id: string,
        threshold: number,
        billing_cycle_start: Date
    ): Promise<void> {
        const id = nanoid();

        await mysqlDB.query(
            `INSERT INTO usage_notifications 
            (id, client_id, threshold, billing_cycle_start) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE notified_at = NOW()`,
            [id, client_id, threshold, billing_cycle_start]
        );

        logger.info('Usage notification marked', { client_id, threshold });
    },
};
