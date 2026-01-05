import { nanoid } from 'nanoid';
import crypto from 'crypto';
import mysqlDB from '@database/mysql';
import { logger } from '@utils/logger';
import { clientService, ClientWithTier } from './clientService';
import { Scope, validateScopes, scopesToJSON, parseScopes } from '@auth/scopes';
import { logInsert } from '@utils/auditLogger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ClientAPIKey {
    id: string;
    client_id: string;
    hashed_key: string;
    name: string;
    environment: string;
    permissions: Scope[] | null;
    last_used_at: Date | null;
    expires_at: Date | null;
    is_active: boolean;
    created_by_user_id: string | null;
    created_at: Date;
}

export interface ValidatedAPIKey {
    keyId: string;
    clientId: string;
    client: ClientWithTier;
    permissions: Scope[];
    environment: string;
}

export interface CreateClientAPIKeyData {
    client_id: string;
    name: string;
    environment?: string;
    scopes?: Scope[]; // Usar scopes en lugar de permissions
    expires_in_days?: number;
    created_by_user_id?: string;
}

// ============================================================================
// CLIENT API KEY SERVICE
// ============================================================================

class ClientAPIKeyService {
    private readonly KEY_PREFIX = 'mk_'; // Mad Kitty prefix
    private readonly KEY_LENGTH = 32;

    /**
     * Generar una nueva API key para un cliente
     */
    async generateClientAPIKey(data: CreateClientAPIKeyData): Promise<{ key: string; apiKey: ClientAPIKey }> {
        const keyId = nanoid();
        const rawKey = this.generateRawKey();
        const hashedKey = this.hashKey(rawKey);
        const now = new Date();

        const expiresAt = data.expires_in_days
            ? new Date(now.getTime() + data.expires_in_days * 24 * 60 * 60 * 1000)
            : null;

        // Validar scopes si se proporcionan
        let permissionsJSON: string | null = null;
        if (data.scopes && data.scopes.length > 0) {
            const validation = validateScopes(data.scopes);
            if (!validation.valid) {
                throw new Error(`Invalid scopes: ${validation.invalid.join(', ')}`);
            }
            permissionsJSON = scopesToJSON(data.scopes);
        }

        try {
            await mysqlDB.query(
                `INSERT INTO client_api_keys (
                    id, client_id, hashed_key, name, environment, 
                    permissions, expires_at, created_by_user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    keyId,
                    data.client_id,
                    hashedKey,
                    data.name,
                    data.environment || 'production',
                    permissionsJSON,
                    expiresAt,
                    data.created_by_user_id || null,
                    now,
                ],
            );

            const apiKey = await this.getAPIKeyById(keyId);
            if (!apiKey) {
                throw new Error('Failed to retrieve created API key');
            }

            // Log audit
            await logInsert('client_api_keys', keyId, {
                client_id: data.client_id,
                name: data.name,
                environment: data.environment || 'production',
                permissions: data.scopes,
                expires_at: expiresAt,
                created_by_user_id: data.created_by_user_id,
                is_active: true,
            });

            logger.info(`Client API key created: ${keyId} for client ${data.client_id}`, {
                scopes: data.scopes,
                environment: data.environment,
            });

            // Return the raw key (only shown once!)
            return {
                key: `${this.KEY_PREFIX}${rawKey}`,
                apiKey,
            };
        } catch (error) {
            logger.error('Failed to generate client API key', { data, error });
            throw error;
        }
    }

    /**
     * Validar una API key y retornar información del cliente
     */
    async validateClientAPIKey(key: string): Promise<ValidatedAPIKey | null> {
        try {
            // Verificar formato
            if (!key.startsWith(this.KEY_PREFIX)) {
                return null;
            }

            const rawKey = key.substring(this.KEY_PREFIX.length);
            const hashedKey = this.hashKey(rawKey);

            // Buscar la key en la base de datos
            const result = await mysqlDB.query<ClientAPIKey>(
                `SELECT * FROM client_api_keys 
                WHERE hashed_key = ? AND is_active = TRUE`,
                [hashedKey],
            );

            if (result.length === 0) {
                return null;
            }

            const apiKey = this.parseAPIKey(result[0]);

            // Verificar expiración
            if (apiKey.expires_at && new Date() > apiKey.expires_at) {
                logger.warn(`Expired API key used: ${apiKey.id}`);
                return null;
            }

            // Obtener información del cliente con tier
            const client = await clientService.getClientWithTier(apiKey.client_id);
            if (!client || !client.is_active) {
                logger.warn(`Inactive client attempted to use API key: ${apiKey.client_id}`);
                return null;
            }

            // Actualizar last_used_at (no bloqueante)
            this.updateLastUsed(apiKey.id).catch(err => {
                logger.error('Failed to update API key last_used_at', err);
            });

            return {
                keyId: apiKey.id,
                clientId: apiKey.client_id,
                client,
                permissions: apiKey.permissions || [],
                environment: apiKey.environment,
            };
        } catch (error) {
            logger.error('Failed to validate client API key', error);
            return null;
        }
    }

    /**
     * Revocar una API key
     */
    async revokeClientAPIKey(id: string, clientId: string): Promise<boolean> {
        try {
            await mysqlDB.query(
                'UPDATE client_api_keys SET is_active = FALSE WHERE id = ? AND client_id = ?',
                [id, clientId],
            );

            logger.info(`Client API key revoked: ${id}`);
            return true;
        } catch (error) {
            logger.error('Failed to revoke client API key', { id, clientId, error });
            throw error;
        }
    }

    /**
     * Listar API keys de un cliente
     */
    async listClientAPIKeys(clientId: string): Promise<ClientAPIKey[]> {
        try {
            const keys = await mysqlDB.query<ClientAPIKey>(
                'SELECT * FROM client_api_keys WHERE client_id = ? ORDER BY created_at DESC',
                [clientId],
            );

            return keys.map(k => this.parseAPIKey(k));
        } catch (error) {
            logger.error('Failed to list client API keys', { clientId, error });
            throw error;
        }
    }

    /**
     * Obtener API key por ID
     */
    async getAPIKeyById(id: string): Promise<ClientAPIKey | null> {
        try {
            const result = await mysqlDB.query<ClientAPIKey>(
                'SELECT * FROM client_api_keys WHERE id = ?',
                [id],
            );

            if (result.length === 0) {
                return null;
            }

            return this.parseAPIKey(result[0]);
        } catch (error) {
            logger.error('Failed to get API key by ID', { id, error });
            throw error;
        }
    }

    /**
     * Actualizar last_used_at de una API key
     */
    private async updateLastUsed(id: string): Promise<void> {
        await mysqlDB.query(
            'UPDATE client_api_keys SET last_used_at = ? WHERE id = ?',
            [new Date(), id],
        );
    }

    /**
     * Generar una key aleatoria
     */
    private generateRawKey(): string {
        return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
    }

    /**
     * Hashear una key para almacenamiento seguro
     */
    private hashKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    /**
     * Helper: Parsear API key desde la base de datos
     */
    private parseAPIKey(raw: any): ClientAPIKey {
        return {
            id: raw.id,
            client_id: raw.client_id,
            hashed_key: raw.hashed_key,
            name: raw.name,
            environment: raw.environment,
            permissions: parseScopes(raw.permissions),
            last_used_at: raw.last_used_at,
            expires_at: raw.expires_at,
            is_active: Boolean(raw.is_active),
            created_by_user_id: raw.created_by_user_id,
            created_at: raw.created_at,
        };
    }
}

export const clientAPIKeyService = new ClientAPIKeyService();
export default clientAPIKeyService;
