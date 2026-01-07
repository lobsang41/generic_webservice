import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, NotFoundError } from '@middleware/errorHandler';
import { requireScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';
import { ipWhitelistService } from '@services/ipWhitelistService';
import { validateRequest } from '@validation/middleware/validateRequest';
import {
    addIPWhitelistSchema,
    ipWhitelistClientParamsSchema,
    ipWhitelistEntryParamsSchema,
} from '@validation/schemas/ipWhitelist.schemas';

const router = Router();

/**
 * POST /api/v1/clients/:clientId/ip-whitelist
 * Add an IP or CIDR range to client's whitelist
 * Requires: clients:admin
 */
router.post('/:clientId/ip-whitelist',
    authenticate,
    requireScope(SCOPES.CLIENTS_ADMIN),
    validateRequest({
        params: ipWhitelistClientParamsSchema,
        body: addIPWhitelistSchema,
    }),
    asyncHandler(async (req: Request, res: Response) => {
        const { clientId } = req.params;
        const { ip_address, cidr_range, description } = req.body;

        const entry = await ipWhitelistService.addAllowedIP(clientId, {
            ip_address,
            cidr_range,
            description,
            created_by: req.user!.email,
        });

        res.status(201).json({
            success: true,
            data: { entry },
            message: 'IP whitelist entry added successfully',
        });
    })
);

/**
 * GET /api/v1/clients/:clientId/ip-whitelist
 * List all IP whitelist entries for a client
 * Requires: clients:read
 */
router.get('/:clientId/ip-whitelist',
    authenticate,
    requireScope(SCOPES.CLIENTS_READ),
    validateRequest({ params: ipWhitelistClientParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { clientId } = req.params;

        const entries = await ipWhitelistService.listClientIPs(clientId);

        res.json({
            success: true,
            data: {
                entries,
                total: entries.length,
            },
        });
    })
);

/**
 * DELETE /api/v1/clients/:clientId/ip-whitelist/:id
 * Remove an IP whitelist entry
 * Requires: clients:admin
 */
router.delete('/:clientId/ip-whitelist/:id',
    authenticate,
    requireScope(SCOPES.CLIENTS_ADMIN),
    validateRequest({ params: ipWhitelistEntryParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { clientId, id } = req.params;

        const removed = await ipWhitelistService.removeAllowedIP(id, clientId);

        if (!removed) {
            throw new NotFoundError('IP whitelist entry not found');
        }

        res.json({
            success: true,
            message: 'IP whitelist entry removed successfully',
        });
    })
);

export default router;
