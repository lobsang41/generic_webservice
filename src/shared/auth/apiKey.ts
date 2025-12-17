import { nanoid } from 'nanoid';
import { config } from '@config/index';
import postgresDB from '@database/postgres';
import bcrypt from 'bcrypt';
import { AuthenticationError } from '@middleware/errorHandler';

export interface APIKey {
    id: string;
    key: string;
    hashedKey: string;
    userId: string;
    name: string;
    permissions?: string[];
    lastUsedAt?: Date;
    expiresAt?: Date;
    createdAt: Date;
    isActive: boolean;
}

class APIKeyService {
    private readonly prefix = 'epk_'; // Enterprise API Key prefix

    async generateAPIKey(userId: string, name: string, expiresInDays?: number): Promise<{ key: string; apiKey: APIKey }> {
        // Generate unique key
        const randomPart = nanoid(config.apiKey.length);
        const key = `${this.prefix}${randomPart}`;

        // Hash the key for storage
        const hashedKey = await bcrypt.hash(key, 10);

        // Calculate expiration
        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : undefined;

        const id = nanoid();

        // Store in database
        await postgresDB.query(
            `INSERT INTO api_keys (id, hashed_key, user_id, name, expires_at, created_at, is_active)
       VALUES ($1, $2, $3, $4, $5, NOW(), true)`,
            [id, hashedKey, userId, name, expiresAt],
        );

        const apiKey: APIKey = {
            id,
            key, // Only returned once
            hashedKey,
            userId,
            name,
            expiresAt,
            createdAt: new Date(),
            isActive: true,
        };

        return { key, apiKey };
    }

    async validateAPIKey(key: string): Promise<APIKey | null> {
        try {
            // Get all active API keys
            const result = await postgresDB.query<APIKey>(
                `SELECT id, hashed_key, user_id, name, permissions, last_used_at, expires_at, created_at, is_active
         FROM api_keys
         WHERE is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())`,
            );

            // Check each key
            for (const apiKey of result.rows) {
                const isMatch = await bcrypt.compare(key, apiKey.hashedKey);
                if (isMatch) {
                    // Update last used timestamp
                    await this.updateLastUsed(apiKey.id);
                    return apiKey;
                }
            }

            return null;
        } catch (error) {
            throw new AuthenticationError('API key validation failed');
        }
    }

    async updateLastUsed(apiKeyId: string): Promise<void> {
        await postgresDB.query(
            'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
            [apiKeyId],
        );
    }

    async revokeAPIKey(apiKeyId: string, userId: string): Promise<boolean> {
        const result = await postgresDB.query(
            'UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2',
            [apiKeyId, userId],
        );

        return (result.rowCount ?? 0) > 0;
    }

    async listAPIKeys(userId: string): Promise<Omit<APIKey, 'hashedKey'>[]> {
        const result = await postgresDB.query<Omit<APIKey, 'hashedKey'>>(
            `SELECT id, user_id, name, permissions, last_used_at, expires_at, created_at, is_active
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
            [userId],
        );

        return result.rows;
    }

    async updateAPIKeyPermissions(apiKeyId: string, userId: string, permissions: string[]): Promise<boolean> {
        const result = await postgresDB.query(
            'UPDATE api_keys SET permissions = $1 WHERE id = $2 AND user_id = $3',
            [JSON.stringify(permissions), apiKeyId, userId],
        );

        return (result.rowCount ?? 0) > 0;
    }

    extractKeyFromHeader(header: string | undefined): string | null {
        if (!header) return null;

        // Support both "Bearer epk_xxx" and "epk_xxx" formats
        const matches = header.match(/(?:Bearer\s+)?(\w+_\w+)/);
        return matches ? matches[1] : null;
    }
}

export const apiKeyService = new APIKeyService();
export default apiKeyService;
