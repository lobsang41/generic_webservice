import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@middleware/errorHandler';
import { clientTierService } from '@services/clientTierService';
import { requireScope, requireAnyScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';

const router = Router();

// ============================================================================
// RUTAS PARA GESTIÓN DE TIERS
// ============================================================================

/**
 * POST /api/v1/client-tiers
 * Crear un nuevo tier
 * Requiere: tiers:write
 */
router.post('/', 
    authenticate, 
    requireScope(SCOPES.TIERS_WRITE),
    asyncHandler(async (req: Request, res: Response) => {
        const { id, name, description, max_api_calls_per_month, max_api_calls_per_minute, max_users, features, price_monthly } = req.body;

        // Validaciones
        if (!id || !name || max_api_calls_per_month === undefined || max_api_calls_per_minute === undefined || max_users === undefined || price_monthly === undefined) {
            throw new ValidationError('Missing required fields: id, name, max_api_calls_per_month, max_api_calls_per_minute, max_users, price_monthly');
        }

        // Validar que los valores numéricos sean positivos
        if (max_api_calls_per_month < 0 || max_api_calls_per_minute < 0 || max_users < 0 || price_monthly < 0) {
            throw new ValidationError('Numeric values must be positive');
        }

        const tier = await clientTierService.createTier({
            id,
            name,
            description,
            max_api_calls_per_month,
            max_api_calls_per_minute,
            max_users,
            features,
            price_monthly,
        });

        res.status(201).json({
            success: true,
            data: { tier },
        });
    })
);

/**
 * GET /api/v1/client-tiers
 * Listar todos los tiers
 * Público (no requiere autenticación)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { active_only } = req.query;

    const tiers = active_only === 'true'
        ? await clientTierService.listActiveTiers()
        : await clientTierService.listAllTiers();

    res.json({
        success: true,
        data: { tiers },
    });
}));

/**
 * GET /api/v1/client-tiers/:id
 * Obtener un tier por ID
 * Público (no requiere autenticación)
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const tier = await clientTierService.getTierById(id);
    if (!tier) {
        throw new NotFoundError('Tier not found');
    }

    res.json({
        success: true,
        data: { tier },
    });
}));

/**
 * PATCH /api/v1/client-tiers/:id
 * Actualizar un tier
 * Requiere: tiers:write
 */
router.patch('/:id', 
    authenticate, 
    requireScope(SCOPES.TIERS_WRITE),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, description, max_api_calls_per_month, max_api_calls_per_minute, max_users, features, price_monthly, is_active } = req.body;

        // Validar valores numéricos si se proporcionan
        if (max_api_calls_per_month !== undefined && max_api_calls_per_month < 0) {
            throw new ValidationError('max_api_calls_per_month must be positive');
        }
        if (max_api_calls_per_minute !== undefined && max_api_calls_per_minute < 0) {
            throw new ValidationError('max_api_calls_per_minute must be positive');
        }
        if (max_users !== undefined && max_users < 0) {
            throw new ValidationError('max_users must be positive');
        }
        if (price_monthly !== undefined && price_monthly < 0) {
            throw new ValidationError('price_monthly must be positive');
        }

        const tier = await clientTierService.updateTier(id, {
            name,
            description,
            max_api_calls_per_month,
            max_api_calls_per_minute,
            max_users,
            features,
            price_monthly,
            is_active,
        });

        if (!tier) {
            throw new NotFoundError('Tier not found');
        }

        res.json({
            success: true,
            data: { tier },
        });
    })
);

/**
 * DELETE /api/v1/client-tiers/:id
 * Desactivar un tier
 * Requiere: tiers:delete O tiers:admin
 */
router.delete('/:id', 
    authenticate, 
    requireAnyScope([SCOPES.TIERS_DELETE, SCOPES.TIERS_ADMIN]),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        try {
            await clientTierService.deactivateTier(id);

            res.json({
                success: true,
                message: 'Tier deactivated successfully',
            });
        } catch (error: any) {
            if (error.message?.includes('active clients')) {
                throw new ValidationError(error.message);
            }
            throw error;
        }
    })
);

export default router;
