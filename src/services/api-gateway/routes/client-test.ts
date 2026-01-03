import { Router, Request, Response } from 'express';
import { authenticateClientAPIKey } from '@middleware/auth';
import { asyncHandler } from '@middleware/errorHandler';
import { clientRateLimiter } from '@middleware/clientRateLimiter';
import { clientUsageTracker } from '@middleware/clientUsageTracker';

const router = Router();

/**
 * Endpoint de prueba para Client API Keys
 * Usa autenticación de cliente, rate limiting y tracking de uso
 */
router.get(
    '/test',
    authenticateClientAPIKey,
    clientRateLimiter,
    clientUsageTracker,
    asyncHandler(async (req: Request, res: Response) => {
        res.json({
            success: true,
            message: 'Client API Key is valid!',
            data: {
                client: {
                    id: req.client?.id,
                    name: req.client?.name,
                    slug: req.client?.slug,
                    tier: req.client?.tier.name,
                },
                tier: {
                    name: req.client?.tier.name,
                    max_api_calls_per_month: req.client?.tier.max_api_calls_per_month,
                    max_api_calls_per_minute: req.client?.tier.max_api_calls_per_minute,
                },
                usage: {
                    current_month: req.client?.api_calls_current_month,
                    limit_month: req.client?.tier.max_api_calls_per_month,
                },
                apiKey: {
                    id: req.clientApiKey?.keyId,
                    environment: req.clientApiKey?.environment,
                    permissions: req.clientApiKey?.permissions,
                },
            },
        });
    }),
);

export default router;
