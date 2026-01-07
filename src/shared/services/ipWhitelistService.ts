import { nanoid } from 'nanoid';
import mysqlDB from '@database/mysql';
import { logger } from '@utils/logger';
import { ipInRange } from '@utils/ipUtils';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IPWhitelistEntry {
    id: string;
    client_id: string;
    ip_address: string | null;
    cidr_range: string | null;
    description: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface AddIPWhitelistData {
    ip_address?: string;
    cidr_range?: string;
    description?: string;
    created_by: string;
}

// ============================================================================
// IP WHITELIST SERVICE
// ============================================================================

class IPWhitelistService {
    // Cache for client IPs (in-memory, TTL 5 minutes)
    private cache: Map<string, { entries: IPWhitelistEntry[]; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Add an allowed IP or CIDR range for a client
     */
    async addAllowedIP(clientId: string, data: AddIPWhitelistData): Promise<IPWhitelistEntry> {
        const id = nanoid();

        try {
            await mysqlDB.query(
                `INSERT INTO client_ip_whitelist (
                    id, client_id, ip_address, cidr_range, description, created_by
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    clientId,
                    data.ip_address || null,
                    data.cidr_range || null,
                    data.description || null,
                    data.created_by,
                ]
            );

            // Invalidate cache for this client
            this.cache.delete(clientId);

            const entry = await this.getEntryById(id);
            if (!entry) {
                throw new Error('Failed to retrieve created IP whitelist entry');
            }

            logger.info(`IP whitelist entry added for client ${clientId}`, {
                id,
                ip: data.ip_address,
                cidr: data.cidr_range,
            });

            return entry;
        } catch (error) {
            logger.error('Failed to add IP whitelist entry', { clientId, data, error });
            throw error;
        }
    }

    /**
     * Get all active IP whitelist entries for a client
     */
    async listClientIPs(clientId: string): Promise<IPWhitelistEntry[]> {
        try {
            const result = await mysqlDB.query<IPWhitelistEntry>(
                `SELECT * FROM client_ip_whitelist 
                 WHERE client_id = ? AND is_active = TRUE 
                 ORDER BY created_at DESC`,
                [clientId]
            );

            return result;
        } catch (error) {
            logger.error('Failed to list client IPs', { clientId, error });
            throw error;
        }
    }

    /**
     * Remove (deactivate) an IP whitelist entry
     */
    async removeAllowedIP(id: string, clientId: string): Promise<boolean> {
        try {
            const result = await mysqlDB.query(
                `UPDATE client_ip_whitelist 
                 SET is_active = FALSE 
                 WHERE id = ? AND client_id = ?`,
                [id, clientId]
            );

            // Invalidate cache
            this.cache.delete(clientId);

            const affectedRows = (result as any).affectedRows || 0;
            
            if (affectedRows > 0) {
                logger.info(`IP whitelist entry removed`, { id, clientId });
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Failed to remove IP whitelist entry', { id, clientId, error });
            throw error;
        }
    }

    /**
     * Check if an IP is allowed for a client
     * Uses cache for performance
     */
    async isIPAllowed(clientId: string, ip: string): Promise<boolean> {
        try {
            const entries = await this.getActiveIPsForClient(clientId);

            // Check each entry
            for (const entry of entries) {
                // Check individual IP
                if (entry.ip_address && entry.ip_address === ip) {
                    return true;
                }

                // Check CIDR range
                if (entry.cidr_range && ipInRange(ip, entry.cidr_range)) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Failed to check IP whitelist', { clientId, ip, error });
            // On error, deny access for security
            return false;
        }
    }

    /**
     * Get active IPs for a client (with caching)
     */
    async getActiveIPsForClient(clientId: string): Promise<IPWhitelistEntry[]> {
        // Check cache
        const cached = this.cache.get(clientId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.entries;
        }

        // Fetch from database
        const entries = await this.listClientIPs(clientId);

        // Update cache
        this.cache.set(clientId, {
            entries,
            timestamp: Date.now(),
        });

        return entries;
    }

    /**
     * Get a single entry by ID
     */
    private async getEntryById(id: string): Promise<IPWhitelistEntry | null> {
        try {
            const result = await mysqlDB.query<IPWhitelistEntry>(
                'SELECT * FROM client_ip_whitelist WHERE id = ?',
                [id]
            );

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            logger.error('Failed to get IP whitelist entry by ID', { id, error });
            throw error;
        }
    }

    /**
     * Clear cache (useful for testing or manual refresh)
     */
    clearCache(clientId?: string): void {
        if (clientId) {
            this.cache.delete(clientId);
        } else {
            this.cache.clear();
        }
    }
}

export const ipWhitelistService = new IPWhitelistService();
export default ipWhitelistService;
