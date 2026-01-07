import { Request, Response, NextFunction } from 'express';
import { ipWhitelistService } from '@services/ipWhitelistService';
import { getClientIP, isLocalhost } from '@utils/ipUtils';
import { logger } from '@utils/logger';
import { AuthorizationError } from './errorHandler';

/**
 * Middleware to validate IP whitelist for authenticated clients
 * 
 * Usage:
 * router.get('/protected', authenticate, validateIPWhitelist, handler);
 * 
 * Configuration via environment variables:
 * - IP_WHITELIST_ENABLED: Enable/disable IP whitelisting (default: true)
 * - IP_WHITELIST_BYPASS_LOCALHOST: Bypass check for localhost (default: true in dev)
 */

interface IPWhitelistConfig {
    enabled: boolean;
    bypassLocalhost: boolean;
}

const config: IPWhitelistConfig = {
    enabled: process.env.IP_WHITELIST_ENABLED !== 'false',
    bypassLocalhost: process.env.IP_WHITELIST_BYPASS_LOCALHOST !== 'false' || process.env.NODE_ENV === 'development',
};

/**
 * Middleware function to validate IP whitelist
 */
export async function validateIPWhitelist(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    // Skip if disabled
    if (!config.enabled) {
        return next();
    }

    try {
        // Get client IP
        const clientIP = getClientIP(req);

        // Bypass localhost in development
        if (config.bypassLocalhost && isLocalhost(clientIP)) {
            logger.debug('IP whitelist bypassed for localhost', { ip: clientIP });
            return next();
        }

        // Get client ID from request context
        // This assumes the request has been authenticated and has client info
        const clientId = (req as any).client?.id || (req as any).user?.client_id;

        if (!clientId) {
            logger.warn('IP whitelist check skipped: no client ID in request', {
                ip: clientIP,
                path: req.path,
            });
            // If no client ID, we can't check whitelist, so allow
            // (This means IP whitelist only applies to client-authenticated requests)
            return next();
        }

        // Check if IP is allowed
        const isAllowed = await ipWhitelistService.isIPAllowed(clientId, clientIP);

        if (!isAllowed) {
            // Log blocked attempt to audit log
            logger.warn('IP whitelist: Access denied', {
                clientId,
                ip: clientIP,
                path: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'],
            });

            // You could also log to audit_log table here
            // await logAuditEvent('IP_BLOCKED', { clientId, ip: clientIP, ... });

            throw new AuthorizationError(
                'Access denied: IP address not in whitelist'
            );
        }

        // IP is allowed, continue
        logger.debug('IP whitelist: Access granted', {
            clientId,
            ip: clientIP,
        });

        next();
    } catch (error) {
        if (error instanceof AuthorizationError) {
            // Re-throw authorization errors
            next(error);
        } else {
            // Log unexpected errors but allow access (fail-open for availability)
            logger.error('IP whitelist check failed', {
                error,
                ip: getClientIP(req),
                path: req.path,
            });
            
            // In production, you might want to fail-closed (deny access on error)
            // For now, we fail-open to avoid blocking legitimate traffic on errors
            next();
        }
    }
}

/**
 * Strict version that fails-closed (denies access on error)
 */
export async function validateIPWhitelistStrict(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    if (!config.enabled) {
        return next();
    }

    try {
        const clientIP = getClientIP(req);

        if (config.bypassLocalhost && isLocalhost(clientIP)) {
            return next();
        }

        const clientId = (req as any).client?.id || (req as any).user?.client_id;

        if (!clientId) {
            throw new AuthorizationError('Client authentication required for IP whitelist');
        }

        const isAllowed = await ipWhitelistService.isIPAllowed(clientId, clientIP);

        if (!isAllowed) {
            logger.warn('IP whitelist (strict): Access denied', {
                clientId,
                ip: clientIP,
                path: req.path,
            });

            throw new AuthorizationError(
                'Access denied: IP address not in whitelist'
            );
        }

        next();
    } catch (error) {
        // Fail-closed: deny access on any error
        if (error instanceof AuthorizationError) {
            next(error);
        } else {
            logger.error('IP whitelist (strict) check failed', {
                error,
                ip: getClientIP(req),
            });
            next(new AuthorizationError('IP whitelist validation failed'));
        }
    }
}
