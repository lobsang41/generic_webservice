import { Request, Response, NextFunction } from 'express';
import { Scope, hasPermission, hasAnyPermission, hasAllPermissions, parseScopes } from '@auth/scopes';
import { ForbiddenError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Extiende el tipo Request para incluir scopes
 */
declare global {
    namespace Express {
        interface Request {
            scopes?: Scope[];
            clientId?: string;
            userId?: string;
        }
    }
}

/**
 * Middleware para requerir un scope específico
 * 
 * @param requiredScope - El scope requerido para acceder al endpoint
 * 
 * @example
 * router.get('/clients', requireScope(SCOPES.CLIENTS_READ), handler);
 */
export function requireScope(requiredScope: Scope) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const userScopes = req.scopes || [];

            if (!hasPermission(userScopes, requiredScope)) {
                logger.warn('Scope permission denied', {
                    userId: req.userId,
                    clientId: req.clientId,
                    requiredScope,
                    userScopes,
                });

                throw new ForbiddenError(
                    `Insufficient permissions. Required scope: ${requiredScope}`
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Middleware para requerir al menos uno de varios scopes
 * 
 * @param requiredScopes - Array de scopes, al menos uno debe estar presente
 * 
 * @example
 * router.get('/data', requireAnyScope([SCOPES.CLIENTS_READ, SCOPES.CLIENTS_ADMIN]), handler);
 */
export function requireAnyScope(requiredScopes: Scope[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const userScopes = req.scopes || [];

            if (!hasAnyPermission(userScopes, requiredScopes)) {
                logger.warn('Scope permission denied (any)', {
                    userId: req.userId,
                    clientId: req.clientId,
                    requiredScopes,
                    userScopes,
                });

                throw new ForbiddenError(
                    `Insufficient permissions. Required any of: ${requiredScopes.join(', ')}`
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Middleware para requerir todos los scopes especificados
 * 
 * @param requiredScopes - Array de scopes, todos deben estar presentes
 * 
 * @example
 * router.delete('/clients/:id', requireAllScopes([SCOPES.CLIENTS_DELETE, SCOPES.CLIENTS_ADMIN]), handler);
 */
export function requireAllScopes(requiredScopes: Scope[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const userScopes = req.scopes || [];

            if (!hasAllPermissions(userScopes, requiredScopes)) {
                logger.warn('Scope permission denied (all)', {
                    userId: req.userId,
                    clientId: req.clientId,
                    requiredScopes,
                    userScopes,
                });

                throw new ForbiddenError(
                    `Insufficient permissions. Required all of: ${requiredScopes.join(', ')}`
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Middleware para validar y cargar scopes desde la API Key
 * Debe ejecutarse después del middleware de autenticación
 */
export function loadScopes() {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Si ya hay scopes cargados, continuar
            if (req.scopes) {
                return next();
            }

            // Cargar scopes desde el objeto user/client que fue añadido por el middleware de auth
            const authUser = (req as any).user;
            const authClient = (req as any).client;

            if (authUser?.permissions) {
                req.scopes = parseScopes(authUser.permissions);
                req.userId = authUser.id;
            } else if (authClient?.permissions) {
                req.scopes = parseScopes(authClient.permissions);
                req.clientId = authClient.id;
            } else {
                // Sin permisos definidos, array vacío
                req.scopes = [];
            }

            logger.debug('Scopes loaded', {
                userId: req.userId,
                clientId: req.clientId,
                scopes: req.scopes,
            });

            next();
        } catch (error) {
            logger.error('Failed to load scopes', { error });
            next(error);
        }
    };
}

/**
 * Middleware opcional: permite el acceso si tiene el scope, pero no falla si no lo tiene
 * Útil para endpoints que tienen funcionalidad adicional con ciertos permisos
 * 
 * @param scope - El scope a verificar
 * 
 * @example
 * router.get('/data', optionalScope(SCOPES.ANALYTICS_READ), (req, res) => {
 *   if (req.scopes?.includes(SCOPES.ANALYTICS_READ)) {
 *     // Retornar datos adicionales
 *   }
 *   // Retornar datos básicos
 * });
 */
export function optionalScope(scope: Scope) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const userScopes = req.scopes || [];
            (req as any).hasOptionalScope = hasPermission(userScopes, scope);
            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Helper para verificar scopes en el código del handler
 * 
 * @example
 * if (checkScope(req, SCOPES.CLIENTS_ADMIN)) {
 *   // Hacer algo solo para admins
 * }
 */
export function checkScope(req: Request, requiredScope: Scope): boolean {
    const userScopes = req.scopes || [];
    return hasPermission(userScopes, requiredScope);
}

/**
 * Helper para verificar múltiples scopes en el código del handler
 */
export function checkAnyScope(req: Request, requiredScopes: Scope[]): boolean {
    const userScopes = req.scopes || [];
    return hasAnyPermission(userScopes, requiredScopes);
}

/**
 * Helper para verificar que tiene todos los scopes
 */
export function checkAllScopes(req: Request, requiredScopes: Scope[]): boolean {
    const userScopes = req.scopes || [];
    return hasAllPermissions(userScopes, requiredScopes);
}
