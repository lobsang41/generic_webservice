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

export interface CreateTierData {
    id: string;
    name: string;
    description?: string;
    max_api_calls_per_month: number;
    max_api_calls_per_minute: number;
    max_users: number;
    features?: Record<string, boolean>;
    price_monthly: number;
}

export interface UpdateTierData {
    name?: string;
    description?: string;
    max_api_calls_per_month?: number;
    max_api_calls_per_minute?: number;
    max_users?: number;
    features?: Record<string, boolean>;
    price_monthly?: number;
    is_active?: boolean;
}

// ============================================================================
// CLIENT TIER SERVICE
// ============================================================================

class ClientTierService {
    /**
     * Crear un nuevo tier
     */
    async createTier(data: CreateTierData): Promise<ClientTier> {
        const now = new Date();

        try {
            await mysqlDB.query(
                `INSERT INTO client_tiers (
                    id, name, description, max_api_calls_per_month, 
                    max_api_calls_per_minute, max_users, features, 
                    price_monthly, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.id,
                    data.name,
                    data.description || null,
                    data.max_api_calls_per_month,
                    data.max_api_calls_per_minute,
                    data.max_users,
                    data.features ? JSON.stringify(data.features) : null,
                    data.price_monthly,
                    now,
                    now,
                ],
            );

            const tier = await this.getTierById(data.id);
            if (!tier) {
                throw new Error('Failed to retrieve created tier');
            }

            logger.info(`Client tier created: ${data.id} (${data.name})`);
            return tier;
        } catch (error) {
            logger.error('Failed to create tier', { data, error });
            throw error;
        }
    }

    /**
     * Obtener tier por ID
     */
    async getTierById(id: string): Promise<ClientTier | null> {
        try {
            const result = await mysqlDB.query<ClientTier>(
                'SELECT * FROM client_tiers WHERE id = ?',
                [id],
            );

            if (result.length === 0) {
                return null;
            }

            return this.parseTier(result[0]);
        } catch (error) {
            logger.error('Failed to get tier by ID', { id, error });
            throw error;
        }
    }

    /**
     * Actualizar tier
     */
    async updateTier(id: string, data: UpdateTierData): Promise<ClientTier | null> {
        try {
            const updates: string[] = [];
            const values: unknown[] = [];

            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name);
            }
            if (data.description !== undefined) {
                updates.push('description = ?');
                values.push(data.description);
            }
            if (data.max_api_calls_per_month !== undefined) {
                updates.push('max_api_calls_per_month = ?');
                values.push(data.max_api_calls_per_month);
            }
            if (data.max_api_calls_per_minute !== undefined) {
                updates.push('max_api_calls_per_minute = ?');
                values.push(data.max_api_calls_per_minute);
            }
            if (data.max_users !== undefined) {
                updates.push('max_users = ?');
                values.push(data.max_users);
            }
            if (data.features !== undefined) {
                updates.push('features = ?');
                values.push(JSON.stringify(data.features));
            }
            if (data.price_monthly !== undefined) {
                updates.push('price_monthly = ?');
                values.push(data.price_monthly);
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(data.is_active);
            }

            if (updates.length === 0) {
                return this.getTierById(id);
            }

            values.push(id);

            await mysqlDB.query(
                `UPDATE client_tiers SET ${updates.join(', ')} WHERE id = ?`,
                values,
            );

            logger.info(`Client tier updated: ${id}`);
            return this.getTierById(id);
        } catch (error) {
            logger.error('Failed to update tier', { id, data, error });
            throw error;
        }
    }

    /**
     * Listar tiers activos
     */
    async listActiveTiers(): Promise<ClientTier[]> {
        try {
            const tiers = await mysqlDB.query<ClientTier>(
                'SELECT * FROM client_tiers WHERE is_active = TRUE ORDER BY price_monthly ASC',
            );

            return tiers.map(t => this.parseTier(t));
        } catch (error) {
            logger.error('Failed to list active tiers', error);
            throw error;
        }
    }

    /**
     * Listar todos los tiers
     */
    async listAllTiers(): Promise<ClientTier[]> {
        try {
            const tiers = await mysqlDB.query<ClientTier>(
                'SELECT * FROM client_tiers ORDER BY price_monthly ASC',
            );

            return tiers.map(t => this.parseTier(t));
        } catch (error) {
            logger.error('Failed to list all tiers', error);
            throw error;
        }
    }

    /**
     * Desactivar tier
     */
    async deactivateTier(id: string): Promise<boolean> {
        try {
            // Verificar que no haya clientes usando este tier
            const clientsCount = await mysqlDB.query<{ count: number }>(
                'SELECT COUNT(*) as count FROM clients WHERE tier_id = ? AND is_active = TRUE',
                [id],
            );

            if (clientsCount[0].count > 0) {
                throw new Error(`Cannot deactivate tier ${id}: ${clientsCount[0].count} active clients are using it`);
            }

            await mysqlDB.query(
                'UPDATE client_tiers SET is_active = FALSE WHERE id = ?',
                [id],
            );

            logger.info(`Client tier deactivated: ${id}`);
            return true;
        } catch (error) {
            logger.error('Failed to deactivate tier', { id, error });
            throw error;
        }
    }

    /**
     * Helper: Parsear tier desde la base de datos
     */
    private parseTier(raw: any): ClientTier {
        return {
            id: raw.id,
            name: raw.name,
            description: raw.description,
            max_api_calls_per_month: raw.max_api_calls_per_month,
            max_api_calls_per_minute: raw.max_api_calls_per_minute,
            max_users: raw.max_users,
            features: typeof raw.features === 'string' ? JSON.parse(raw.features) : raw.features,
            price_monthly: parseFloat(raw.price_monthly),
            is_active: Boolean(raw.is_active),
            created_at: raw.created_at,
            updated_at: raw.updated_at,
        };
    }
}

export const clientTierService = new ClientTierService();
export default clientTierService;
