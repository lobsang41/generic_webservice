import { nanoid } from 'nanoid';
import mysqlDB from '@database/mysql';
import { logger } from '@utils/logger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ClientTier {
    id: string;
    name: string;
    description: string | null;
    max_api_calls_per_month: number;
    max_api_calls_per_minute: number;
    max_users: number;
    features: Record<string, boolean> | null;
    price_monthly: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Client {
    id: string;
    name: string;
    slug: string;
    tier_id: string;
    contact_email: string;
    contact_name: string;
    api_calls_current_month: number;
    is_active: boolean;
    metadata: Record<string, unknown> | null;
    billing_cycle_start: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface ClientWithTier extends Client {
    tier: ClientTier;
}

export interface CreateClientData {
    name: string;
    slug: string;
    tier_id: string;
    contact_email: string;
    contact_name: string;
    metadata?: Record<string, unknown>;
}

export interface UpdateClientData {
    name?: string;
    tier_id?: string;
    contact_email?: string;
    contact_name?: string;
    metadata?: Record<string, unknown>;
    is_active?: boolean;
}

export interface ClientUsageStats {
    client: Client;
    tier: ClientTier;
    usage: {
        current_month_calls: number;
        limit_month_calls: number;
        percentage_used: number;
        remaining_calls: number;
    };
}

// ============================================================================
// CLIENT SERVICE
// ============================================================================

class ClientService {
    /**
     * Crear un nuevo cliente
     */
    async createClient(data: CreateClientData): Promise<Client> {
        const clientId = nanoid();
        const now = new Date();

        try {
            await mysqlDB.query(
                `INSERT INTO clients (
                    id, name, slug, tier_id, contact_email, contact_name, 
                    metadata, billing_cycle_start, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    clientId,
                    data.name,
                    data.slug,
                    data.tier_id,
                    data.contact_email,
                    data.contact_name,
                    data.metadata ? JSON.stringify(data.metadata) : null,
                    now,
                    now,
                    now,
                ],
            );

            const client = await this.getClientById(clientId);
            if (!client) {
                throw new Error('Failed to retrieve created client');
            }

            logger.info(`Client created: ${clientId} (${data.name})`);
            return client;
        } catch (error) {
            logger.error('Failed to create client', { data, error });
            throw error;
        }
    }

    /**
     * Obtener cliente por ID
     */
    async getClientById(id: string): Promise<Client | null> {
        try {
            const result = await mysqlDB.query<Client>(
                'SELECT * FROM clients WHERE id = ?',
                [id],
            );

            if (result.length === 0) {
                return null;
            }

            return this.parseClient(result[0]);
        } catch (error) {
            logger.error('Failed to get client by ID', { id, error });
            throw error;
        }
    }

    /**
     * Obtener cliente por slug
     */
    async getClientBySlug(slug: string): Promise<Client | null> {
        try {
            const result = await mysqlDB.query<Client>(
                'SELECT * FROM clients WHERE slug = ?',
                [slug],
            );

            if (result.length === 0) {
                return null;
            }

            return this.parseClient(result[0]);
        } catch (error) {
            logger.error('Failed to get client by slug', { slug, error });
            throw error;
        }
    }

    /**
     * Obtener cliente con información del tier
     */
    async getClientWithTier(id: string): Promise<ClientWithTier | null> {
        try {
            const result = await mysqlDB.query<ClientWithTier>(
                `SELECT 
                    c.*,
                    t.id as tier_id,
                    t.name as tier_name,
                    t.description as tier_description,
                    t.max_api_calls_per_month as tier_max_api_calls_per_month,
                    t.max_api_calls_per_minute as tier_max_api_calls_per_minute,
                    t.max_users as tier_max_users,
                    t.features as tier_features,
                    t.price_monthly as tier_price_monthly,
                    t.is_active as tier_is_active,
                    t.created_at as tier_created_at,
                    t.updated_at as tier_updated_at
                FROM clients c
                INNER JOIN client_tiers t ON c.tier_id = t.id
                WHERE c.id = ?`,
                [id],
            );

            if (result.length === 0) {
                return null;
            }

            const row = result[0] as any;
            return {
                id: row.id,
                name: row.name,
                slug: row.slug,
                tier_id: row.tier_id,
                contact_email: row.contact_email,
                contact_name: row.contact_name,
                api_calls_current_month: row.api_calls_current_month,
                is_active: Boolean(row.is_active),
                metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
                billing_cycle_start: row.billing_cycle_start,
                created_at: row.created_at,
                updated_at: row.updated_at,
                tier: {
                    id: row.tier_id,
                    name: row.tier_name,
                    description: row.tier_description,
                    max_api_calls_per_month: row.tier_max_api_calls_per_month,
                    max_api_calls_per_minute: row.tier_max_api_calls_per_minute,
                    max_users: row.tier_max_users,
                    features: typeof row.tier_features === 'string' ? JSON.parse(row.tier_features) : row.tier_features,
                    price_monthly: parseFloat(row.tier_price_monthly),
                    is_active: Boolean(row.tier_is_active),
                    created_at: row.tier_created_at,
                    updated_at: row.tier_updated_at,
                },
            };
        } catch (error) {
            logger.error('Failed to get client with tier', { id, error });
            throw error;
        }
    }

    /**
     * Actualizar cliente
     */
    async updateClient(id: string, data: UpdateClientData): Promise<Client | null> {
        try {
            const updates: string[] = [];
            const values: unknown[] = [];

            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name);
            }
            if (data.tier_id !== undefined) {
                updates.push('tier_id = ?');
                values.push(data.tier_id);
            }
            if (data.contact_email !== undefined) {
                updates.push('contact_email = ?');
                values.push(data.contact_email);
            }
            if (data.contact_name !== undefined) {
                updates.push('contact_name = ?');
                values.push(data.contact_name);
            }
            if (data.metadata !== undefined) {
                updates.push('metadata = ?');
                values.push(JSON.stringify(data.metadata));
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(data.is_active);
            }

            if (updates.length === 0) {
                return this.getClientById(id);
            }

            values.push(id);

            await mysqlDB.query(
                `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
                values,
            );

            logger.info(`Client updated: ${id}`);
            return this.getClientById(id);
        } catch (error) {
            logger.error('Failed to update client', { id, data, error });
            throw error;
        }
    }

    /**
     * Desactivar cliente
     */
    async deactivateClient(id: string): Promise<boolean> {
        try {
            await mysqlDB.query(
                'UPDATE clients SET is_active = FALSE WHERE id = ?',
                [id],
            );

            logger.info(`Client deactivated: ${id}`);
            return true;
        } catch (error) {
            logger.error('Failed to deactivate client', { id, error });
            throw error;
        }
    }

    /**
     * Listar clientes con paginación y filtros
     */
    async listClients(options: {
        page?: number;
        limit?: number;
        tier_id?: string;
        is_active?: boolean;
    } = {}): Promise<{ clients: Client[]; total: number; pages: number }> {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 10, 100); // Max 100
        const offset = (page - 1) * limit;

        try {
            const conditions: string[] = [];
            const filterValues: unknown[] = [];

            if (options.tier_id) {
                conditions.push('tier_id = ?');
                filterValues.push(options.tier_id);
            }
            if (options.is_active !== undefined) {
                conditions.push('is_active = ?');
                filterValues.push(options.is_active);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countResult = await mysqlDB.query<{ count: number }>(
                `SELECT COUNT(*) as count FROM clients ${whereClause}`,
                filterValues,
            );
            const total = (countResult[0] as any).count;

            // Get paginated results - usar interpolación para LIMIT y OFFSET
            const clients = await mysqlDB.query<Client>(
                `SELECT * FROM clients ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
                filterValues,
            );

            return {
                clients: clients.map(c => this.parseClient(c)),
                total,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('Failed to list clients', { options, error });
            throw error;
        }
    }

    /**
     * Obtener estadísticas de uso del cliente
     */
    async getClientUsageStats(id: string): Promise<ClientUsageStats | null> {
        try {
            const clientWithTier = await this.getClientWithTier(id);
            if (!clientWithTier) {
                return null;
            }

            const currentCalls = clientWithTier.api_calls_current_month;
            const limitCalls = clientWithTier.tier.max_api_calls_per_month;
            const percentageUsed = (currentCalls / limitCalls) * 100;
            const remainingCalls = Math.max(0, limitCalls - currentCalls);

            return {
                client: clientWithTier,
                tier: clientWithTier.tier,
                usage: {
                    current_month_calls: currentCalls,
                    limit_month_calls: limitCalls,
                    percentage_used: Math.round(percentageUsed * 100) / 100,
                    remaining_calls: remainingCalls,
                },
            };
        } catch (error) {
            logger.error('Failed to get client usage stats', { id, error });
            throw error;
        }
    }

    /**
     * Resetear uso mensual del cliente
     */
    async resetMonthlyUsage(id: string): Promise<boolean> {
        try {
            await mysqlDB.query(
                'UPDATE clients SET api_calls_current_month = 0, billing_cycle_start = ? WHERE id = ?',
                [new Date(), id],
            );

            logger.info(`Client monthly usage reset: ${id}`);
            return true;
        } catch (error) {
            logger.error('Failed to reset monthly usage', { id, error });
            throw error;
        }
    }

    /**
     * Incrementar contador de uso mensual
     */
    async incrementMonthlyUsage(id: string): Promise<number> {
        try {
            await mysqlDB.query(
                'UPDATE clients SET api_calls_current_month = api_calls_current_month + 1 WHERE id = ?',
                [id],
            );

            const client = await this.getClientById(id);
            return client?.api_calls_current_month || 0;
        } catch (error) {
            logger.error('Failed to increment monthly usage', { id, error });
            throw error;
        }
    }

    /**
     * Helper: Parsear cliente desde la base de datos
     */
    private parseClient(raw: any): Client {
        return {
            id: raw.id,
            name: raw.name,
            slug: raw.slug,
            tier_id: raw.tier_id,
            contact_email: raw.contact_email,
            contact_name: raw.contact_name,
            api_calls_current_month: raw.api_calls_current_month,
            is_active: Boolean(raw.is_active),
            metadata: typeof raw.metadata === 'string' ? JSON.parse(raw.metadata) : raw.metadata,
            billing_cycle_start: raw.billing_cycle_start,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
        };
    }
}

export const clientService = new ClientService();
export default clientService;
