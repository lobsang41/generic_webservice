import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@middleware/errorHandler';
import { clientService } from '@services/clientService';
import { requireScope, requireAnyScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';
import { getAuditMetadata } from '@shared/utils/auditLogger';
import { validateRequest } from '@validation/middleware/validateRequest';
import {
    createClientSchema,
    updateClientSchema,
    getClientParamsSchema,
    listClientsQuerySchema,
    getClientUsageParamsSchema,
    resetUsageParamsSchema,
} from '@validation/schemas/client.schemas';

const router = Router();

// ============================================================================
// RUTAS PARA GESTIÓN DE CLIENTES
// ============================================================================

/**
 * POST /api/v1/clients
 * Crear un nuevo cliente
 * Requiere: clients:write
 */
router.post('/', 
    authenticate, 
    requireScope(SCOPES.CLIENTS_WRITE),
    validateRequest({ body: createClientSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, slug, tier_id, contact_email, contact_name, metadata } = req.body;

        // Verificar que el slug no esté en uso
        const existingClient = await clientService.getClientBySlug(slug);
        if (existingClient) {
            throw new ValidationError(`Slug "${slug}" is already in use`);
        }

        const client = await clientService.createClient({
            name,
            slug,
            tier_id,
            contact_email,
            contact_name,
            metadata,
            auditMetadata: getAuditMetadata(req),
        });

        res.status(201).json({
            success: true,
            data: { client },
        });
    })
);

/**
 * GET /api/v1/clients
 * Listar clientes con paginación
 * Requiere: clients:read
 */
router.get('/', 
    authenticate, 
    requireScope(SCOPES.CLIENTS_READ),
    validateRequest({ query: listClientsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { page, limit, tier_id, is_active } = req.query;

        const result = await clientService.listClients({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            tier_id: tier_id as string,
            is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
        });

        res.json({
            success: true,
            data: result,
        });
    })
);

/**
 * GET /api/v1/clients/:id
 * Obtener un cliente por ID
 * Requiere: clients:read
 */
router.get('/:id', 
    authenticate, 
    requireScope(SCOPES.CLIENTS_READ),
    validateRequest({ params: getClientParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const client = await clientService.getClientWithTier(id);
        if (!client) {
            throw new NotFoundError('Client not found');
        }

        res.json({
            success: true,
            data: { client },
        });
    })
);

/**
 * PATCH /api/v1/clients/:id
 * Actualizar un cliente
 * Requiere: clients:write
 */
router.patch('/:id', 
    authenticate, 
    requireScope(SCOPES.CLIENTS_WRITE),
    validateRequest({
        params: getClientParamsSchema,
        body: updateClientSchema,
    }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, tier_id, contact_email, contact_name, metadata, is_active } = req.body;

        const client = await clientService.updateClient(id, {
            name,
            tier_id,
            contact_email,
            contact_name,
            metadata,
            is_active,
            auditMetadata: getAuditMetadata(req),
        });

        if (!client) {
            throw new NotFoundError('Client not found');
        }

        res.json({
            success: true,
            data: { client },
        });
    })
);

/**
 * DELETE /api/v1/clients/:id
 * Desactivar un cliente
 * Requiere: clients:delete O clients:admin
 */
router.delete('/:id', 
    authenticate, 
    requireAnyScope([SCOPES.CLIENTS_DELETE, SCOPES.CLIENTS_ADMIN]),
    validateRequest({ params: getClientParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const client = await clientService.getClientById(id);
        if (!client) {
            throw new NotFoundError('Client not found');
        }

        await clientService.deactivateClient(id);

        res.json({
            success: true,
            message: 'Client deactivated successfully',
        });
    })
);

/**
 * GET /api/v1/clients/:id/usage
 * Obtener estadísticas de uso del cliente
 * Requiere: usage:read O clients:admin O ser admin
 */
router.get('/:id/usage', 
    authenticate, 
    // Los admins tienen acceso automático, otros usuarios necesitan scopes
    (req, res, next) => {
        if (req.user?.role === 'admin') {
            return next();
        }
        return requireAnyScope([SCOPES.USAGE_READ, SCOPES.CLIENTS_ADMIN])(req, res, next);
    },
    validateRequest({ params: getClientUsageParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const stats = await clientService.getClientUsageStats(id);
        if (!stats) {
            throw new NotFoundError('Client not found');
        }

        res.json({
            success: true,
            data: stats,
        });
    })
);

/**
 * POST /api/v1/clients/:id/reset-usage
 * Resetear uso mensual del cliente
 * Requiere: usage:write O clients:admin O ser admin
 */
router.post('/:id/reset-usage', 
    authenticate, 
    // Los admins tienen acceso automático, otros usuarios necesitan scopes
    (req, res, next) => {
        if (req.user?.role === 'admin') {
            return next();
        }
        return requireAnyScope([SCOPES.USAGE_WRITE, SCOPES.CLIENTS_ADMIN])(req, res, next);
    },
    validateRequest({ params: resetUsageParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const client = await clientService.getClientById(id);
        if (!client) {
            throw new NotFoundError('Client not found');
        }

        await clientService.resetMonthlyUsage(id);

        res.json({
            success: true,
            message: 'Monthly usage reset successfully',
        });
    })
);

export default router;
