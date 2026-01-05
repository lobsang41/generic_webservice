import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@middleware/errorHandler';
import { clientService } from '@services/clientService';
import { requireScope, requireAnyScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';
import { getAuditMetadata } from '@shared/utils/auditLogger';

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
    asyncHandler(async (req: Request, res: Response) => {
        const { name, slug, tier_id, contact_email, contact_name, metadata } = req.body;

        // Validaciones
        if (!name || !slug || !tier_id || !contact_email || !contact_name) {
            throw new ValidationError('Missing required fields: name, slug, tier_id, contact_email, contact_name');
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact_email)) {
            throw new ValidationError('Invalid email format');
        }

        // Validar formato de slug (solo letras, números y guiones)
        const slugRegex = /^[a-z0-9-]+$/;
        if (!slugRegex.test(slug)) {
            throw new ValidationError('Invalid slug format. Use only lowercase letters, numbers, and hyphens');
        }

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
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, tier_id, contact_email, contact_name, metadata, is_active } = req.body;

        // Validar email si se proporciona
        if (contact_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                throw new ValidationError('Invalid email format');
            }
        }

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
 * Requiere: usage:read O clients:admin
 */
router.get('/:id/usage', 
    authenticate, 
    requireAnyScope([SCOPES.USAGE_READ, SCOPES.CLIENTS_ADMIN]),
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
 * Requiere: usage:write O clients:admin
 */
router.post('/:id/reset-usage', 
    authenticate, 
    requireAnyScope([SCOPES.USAGE_WRITE, SCOPES.CLIENTS_ADMIN]),
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
