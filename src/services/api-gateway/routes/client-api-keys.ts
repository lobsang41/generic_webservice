import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@middleware/errorHandler';
import { clientAPIKeyService } from '@services/clientApiKeyService';
import { clientService } from '@services/clientService';
import { Scope, validateScopes, SCOPE_GROUPS, getAllScopesWithDescriptions, SCOPES } from '@auth/scopes';
import { requireScope, requireAnyScope } from '@middleware/scopeValidator';

const router = Router({ mergeParams: true }); // Para acceder a :clientId del parent router

// ============================================================================
// RUTAS PARA GESTIÓN DE API KEYS DE CLIENTES
// ============================================================================

/**
 * POST /api/v1/clients/:clientId/api-keys
 * Generar una nueva API key para un cliente con scopes específicos
 * 
 * Body:
 * {
 *   "name": "Production Key",
 *   "environment": "production",
 *   "scopes": ["clients:read", "usage:read"],  // Array de scopes
 *   "expires_in_days": 365
 * }
 */
router.post('/:clientId/api-keys', authenticate, requireScope(SCOPES.API_KEYS_WRITE), asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const { name, environment, scopes, expires_in_days } = req.body;

    // Validaciones
    if (!name) {
        throw new ValidationError('API key name is required');
    }

    // Validar scopes si se proporcionan
    if (scopes) {
        if (!Array.isArray(scopes)) {
            throw new ValidationError('Scopes must be an array');
        }

        const validation = validateScopes(scopes);
        if (!validation.valid) {
            throw new ValidationError(`Invalid scopes: ${validation.invalid.join(', ')}`);
        }
    }

    // Verificar que el cliente existe
    const client = await clientService.getClientById(clientId);
    if (!client) {
        throw new NotFoundError('Client not found');
    }

    // Generar la API key
    const result = await clientAPIKeyService.generateClientAPIKey({
        client_id: clientId,
        name,
        environment: environment || 'production',
        scopes: scopes as Scope[],
        expires_in_days,
        created_by_user_id: req.user?.userId,
    });

    res.status(201).json({
        success: true,
        data: {
            key: result.key, // Solo se muestra una vez!
            apiKey: {
                id: result.apiKey.id,
                name: result.apiKey.name,
                environment: result.apiKey.environment,
                scopes: result.apiKey.permissions, // Retornar scopes
                expires_at: result.apiKey.expires_at,
                created_at: result.apiKey.created_at,
            },
        },
        message: 'API key created successfully. Save it securely - it will not be shown again.',
    });
}));

/**
 * GET /api/v1/clients/:clientId/api-keys/scopes
 * Listar todos los scopes disponibles y grupos predefinidos
 */
router.get('/:clientId/api-keys/scopes', authenticate, requireScope(SCOPES.API_KEYS_READ), asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;

    // Verificar que el cliente existe
    const client = await clientService.getClientById(clientId);
    if (!client) {
        throw new NotFoundError('Client not found');
    }

    // Obtener todos los scopes con descripciones
    const allScopes = getAllScopesWithDescriptions();

    res.json({
        success: true,
        data: {
            scopes: allScopes,
            groups: {
                READONLY: {
                    name: 'Read Only',
                    description: 'Solo lectura de recursos básicos',
                    scopes: SCOPE_GROUPS.READONLY,
                },
                DEVELOPER: {
                    name: 'Developer',
                    description: 'Acceso completo para desarrollo',
                    scopes: SCOPE_GROUPS.DEVELOPER,
                },
                ADMIN: {
                    name: 'Admin',
                    description: 'Control administrativo (sin eliminación)',
                    scopes: SCOPE_GROUPS.ADMIN,
                },
                SUPER_ADMIN: {
                    name: 'Super Admin',
                    description: 'Control total sin restricciones',
                    scopes: SCOPE_GROUPS.SUPER_ADMIN,
                },
            },
        },
    });
}));

/**
 * GET /api/v1/clients/:clientId/api-keys
 * Listar API keys de un cliente
 */
router.get('/:clientId/api-keys', authenticate, requireScope(SCOPES.API_KEYS_READ), asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;

    // Verificar que el cliente existe
    const client = await clientService.getClientById(clientId);
    if (!client) {
        throw new NotFoundError('Client not found');
    }

    const apiKeys = await clientAPIKeyService.listClientAPIKeys(clientId);

    // No retornar el hashed_key
    const sanitizedKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        environment: key.environment,
        scopes: key.permissions, // Retornar como scopes
        last_used_at: key.last_used_at,
        expires_at: key.expires_at,
        is_active: key.is_active,
        created_at: key.created_at,
    }));

    res.json({
        success: true,
        data: { apiKeys: sanitizedKeys },
    });
}));

/**
 * DELETE /api/v1/clients/:clientId/api-keys/:keyId
 * Revocar una API key
 */
router.delete('/:clientId/api-keys/:keyId', authenticate, requireAnyScope([SCOPES.API_KEYS_DELETE, SCOPES.API_KEYS_ADMIN]), asyncHandler(async (req: Request, res: Response) => {
    const { clientId, keyId } = req.params;

    // Verificar que el cliente existe
    const client = await clientService.getClientById(clientId);
    if (!client) {
        throw new NotFoundError('Client not found');
    }

    await clientAPIKeyService.revokeClientAPIKey(keyId, clientId);

    res.json({
        success: true,
        message: 'API key revoked successfully',
    });
}));

export default router;
