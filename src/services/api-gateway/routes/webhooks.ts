import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@middleware/errorHandler';
import { validateRequest } from '@validation/middleware/validateRequest';
import {
    createWebhookConfigSchema,
    updateWebhookConfigSchema,
    getWebhookConfigParamsSchema,
    getWebhookDeliveriesQuerySchema,
    testWebhookSchema,
} from '@validation/schemas/webhook.schemas';
import {
    webhookConfigService,
    webhookDeliveryService,
} from '@shared/webhooks/webhookService';
import { generateWebhookSecret, buildSignatureHeaders } from '@shared/webhooks/webhookSigner';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================================================
// WEBHOOK CONFIGURATION ROUTES
// ============================================================================

/**
 * POST /api/v1/webhooks
 * Crear configuración de webhook
 */
router.post(
    '/',
    validateRequest({ body: createWebhookConfigSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { client_id, url, events, custom_headers, timeout_ms } = req.body;

        // Verificar que el usuario tenga acceso al cliente
        // (admin puede crear para cualquier cliente, otros solo para sus propios clientes)
        if (req.user?.role !== 'admin' && req.client?.id !== client_id) {
            throw new ValidationError('You can only create webhooks for your own client');
        }

        const config = await webhookConfigService.createWebhookConfig({
            client_id,
            url,
            events,
            custom_headers,
            timeout_ms,
            created_by: req.user?.userId,
        });

        res.status(201).json({
            success: true,
            data: {
                webhook: {
                    ...config,
                    secret: '***HIDDEN***',
                },
            },
        });
    })
);

/**
 * GET /api/v1/webhooks
 * Listar webhooks del cliente autenticado
 */
router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
        let client_id: string;

        if (req.user?.role === 'admin' && req.query.client_id) {
            // Admin puede ver webhooks de cualquier cliente
            client_id = req.query.client_id as string;
        } else if (req.client?.id) {
            // Cliente solo puede ver sus propios webhooks
            client_id = req.client.id;
        } else if (req.user?.role === 'admin') {
            // Admin sin client_id especificado - mostrar mensaje claro
            return res.json({
                success: true,
                data: {
                    webhooks: [],
                    count: 0,
                    message: 'Please provide a client_id query parameter to view webhooks'
                },
            });
        } else {
            throw new ValidationError('Client ID is required. Please authenticate with a valid client API key or provide client_id parameter.');
        }

        // Validación adicional
        if (!client_id) {
            throw new ValidationError('Invalid client_id');
        }

        const webhooks = await webhookConfigService.getWebhookConfigsByClient(client_id);

        // Ocultar secrets
        const sanitizedWebhooks = webhooks.map((w) => ({
            ...w,
            secret: '***HIDDEN***',
        }));

        res.json({
            success: true,
            data: {
                webhooks: sanitizedWebhooks,
                count: sanitizedWebhooks.length,
            },
        });
    })
);

/**
 * GET /api/v1/webhooks/:id
 * Obtener configuración de webhook por ID
 */
router.get(
    '/:id',
    validateRequest({ params: getWebhookConfigParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const webhook = await webhookConfigService.getWebhookConfigById(id);
        if (!webhook) {
            throw new NotFoundError('Webhook configuration not found');
        }

        // Verificar acceso
        if (req.user?.role !== 'admin' && req.client?.id !== webhook.client_id) {
            throw new ValidationError('Access denied');
        }

        res.json({
            success: true,
            data: {
                webhook: {
                    ...webhook,
                    secret: '***HIDDEN***',
                },
            },
        });
    })
);

/**
 * PATCH /api/v1/webhooks/:id
 * Actualizar configuración de webhook
 */
router.patch(
    '/:id',
    validateRequest({
        params: getWebhookConfigParamsSchema,
        body: updateWebhookConfigSchema,
    }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const updates = req.body;

        const webhook = await webhookConfigService.getWebhookConfigById(id);
        if (!webhook) {
            throw new NotFoundError('Webhook configuration not found');
        }

        // Verificar acceso
        if (req.user?.role !== 'admin' && req.client?.id !== webhook.client_id) {
            throw new ValidationError('Access denied');
        }

        const updated = await webhookConfigService.updateWebhookConfig(id, updates);

        res.json({
            success: true,
            data: {
                webhook: {
                    ...updated,
                    secret: '***HIDDEN***',
                },
            },
        });
    })
);

/**
 * DELETE /api/v1/webhooks/:id
 * Eliminar configuración de webhook
 */
router.delete(
    '/:id',
    validateRequest({ params: getWebhookConfigParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const webhook = await webhookConfigService.getWebhookConfigById(id);
        if (!webhook) {
            throw new NotFoundError('Webhook configuration not found');
        }

        // Verificar acceso
        if (req.user?.role !== 'admin' && req.client?.id !== webhook.client_id) {
            throw new ValidationError('Access denied');
        }

        await webhookConfigService.deleteWebhookConfig(id);

        res.json({
            success: true,
            message: 'Webhook configuration deleted successfully',
        });
    })
);

/**
 * POST /api/v1/webhooks/:id/regenerate-secret
 * Regenerar secret de webhook
 */
router.post(
    '/:id/regenerate-secret',
    validateRequest({ params: getWebhookConfigParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const webhook = await webhookConfigService.getWebhookConfigById(id);
        if (!webhook) {
            throw new NotFoundError('Webhook configuration not found');
        }

        // Verificar acceso
        if (req.user?.role !== 'admin' && req.client?.id !== webhook.client_id) {
            throw new ValidationError('Access denied');
        }

        const newSecret = await webhookConfigService.regenerateSecret(id);

        res.json({
            success: true,
            message: 'Webhook secret regenerated successfully',
            data: {
                secret: newSecret,
                warning: 'Save this secret securely. It will not be shown again.',
            },
        });
    })
);

// ============================================================================
// WEBHOOK DELIVERY ROUTES
// ============================================================================

/**
 * GET /api/v1/webhooks/deliveries
 * Listar entregas de webhooks
 */
router.get(
    '/deliveries/list',
    validateRequest({ query: getWebhookDeliveriesQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { client_id, status, event_type, limit } = req.query;

        let targetClientId: string;

        if (req.user?.role === 'admin' && client_id) {
            targetClientId = client_id as string;
        } else if (req.client?.id) {
            targetClientId = req.client.id;
        } else if (req.user?.role === 'admin') {
            // Admin sin client_id - mostrar mensaje claro
            return res.json({
                success: true,
                data: {
                    deliveries: [],
                    count: 0,
                    message: 'Please provide a client_id query parameter to view deliveries'
                },
            });
        } else {
            throw new ValidationError('Client ID is required. Please authenticate with a valid client API key or provide client_id parameter.');
        }

        // Validación adicional
        if (!targetClientId) {
            throw new ValidationError('Invalid client_id');
        }

        const deliveries = await webhookDeliveryService.getDeliveriesByClient(
            targetClientId,
            Number(limit) || 50
        );

        // Filtrar por status y event_type si se especificaron
        let filtered = deliveries;
        if (status) {
            filtered = filtered.filter((d) => d.status === status);
        }
        if (event_type) {
            filtered = filtered.filter((d) => d.event_type === event_type);
        }

        res.json({
            success: true,
            data: {
                deliveries: filtered,
                count: filtered.length,
            },
        });
    })
);

/**
 * GET /api/v1/webhooks/deliveries/:id
 * Obtener detalles de una entrega específica
 */
router.get(
    '/deliveries/:id',
    validateRequest({ params: getWebhookConfigParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const delivery = await webhookDeliveryService.getDeliveryById(id);
        if (!delivery) {
            throw new NotFoundError('Webhook delivery not found');
        }

        // Verificar acceso
        if (req.user?.role !== 'admin' && req.client?.id !== delivery.client_id) {
            throw new ValidationError('Access denied');
        }

        res.json({
            success: true,
            data: { delivery },
        });
    })
);

// ============================================================================
// TESTING ROUTES
// ============================================================================

/**
 * POST /api/v1/webhooks/test
 * Enviar webhook de prueba
 */
router.post(
    '/test',
    validateRequest({ body: testWebhookSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { url, payload } = req.body;

        // Generar secret temporal para la prueba
        const testSecret = generateWebhookSecret();
        const testPayload = payload || {
            event: 'test.webhook',
            timestamp: new Date().toISOString(),
            message: 'This is a test webhook',
        };

        // Construir headers con firma
        const signatureHeaders = buildSignatureHeaders(testPayload, testSecret);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Enterprise-Webhook-Test/1.0',
                    ...signatureHeaders,
                },
                body: JSON.stringify(testPayload),
                signal: AbortSignal.timeout(5000),
            });

            const responseBody = await response.text();

            res.json({
                success: true,
                message: 'Test webhook sent successfully',
                data: {
                    status_code: response.status,
                    response_body: responseBody.substring(0, 500),
                    test_secret: testSecret,
                    headers_sent: signatureHeaders,
                },
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: 'Failed to send test webhook',
                error: error.message,
            });
        }
    })
);

/**
 * POST /api/v1/webhooks/simulate-threshold
 * Simular disparo de webhook de threshold (para testing)
 * Solo para admins
 */
router.post(
    '/simulate-threshold',
    asyncHandler(async (req: Request, res: Response) => {
        // Solo admins pueden simular
        if (req.user?.role !== 'admin') {
            throw new ValidationError('Only admins can simulate threshold webhooks');
        }

        const { client_id, threshold } = req.body;

        if (!client_id || !threshold) {
            throw new ValidationError('client_id and threshold are required');
        }

        if (![80, 100].includes(threshold)) {
            throw new ValidationError('threshold must be 80 or 100');
        }

        // Importar la función de envío de webhooks
        const { sendUsageThresholdWebhook } = await import('@shared/webhooks/webhookQueue');

        // Simular datos de uso
        const mockUsageData = {
            current_usage: threshold === 80 ? 8000 : 10000,
            limit: 10000,
            percentage: threshold,
            billing_cycle_start: new Date().toISOString().split('T')[0],
        };

        // Enviar webhook (esto creará el registro de entrega)
        await sendUsageThresholdWebhook(client_id, threshold, mockUsageData);

        res.json({
            success: true,
            message: `Simulated ${threshold}% threshold webhook for client ${client_id}`,
            data: {
                client_id,
                threshold,
                mock_data: mockUsageData,
            },
        });
    })
);

export default router;
