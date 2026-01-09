import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';
import { usageNotificationService } from '@shared/webhooks/webhookService';
import { sendUsageThresholdWebhook, sendQuotaExceededWebhook } from '@shared/webhooks/webhookQueue';

/**
 * Middleware para monitorear uso y disparar webhooks de threshold
 * Se ejecuta después de que se incrementa el contador de uso
 */
export async function usageWebhookMonitor(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    // Solo procesar si hay un cliente autenticado
    if (!req.client) {
        return next();
    }

    const client = req.client;
    const currentUsage = client.api_calls_current_month;
    // Obtener el límite del tier o usar un valor por defecto
    const limit = (client.tier as any)?.rate_limit_per_month || 1000;
    const billingCycleStart = client.billing_cycle_start;

    // Verificar que billing_cycle_start existe
    if (!billingCycleStart) {
        return next();
    }

    // Calcular porcentaje de uso
    const usagePercentage = (currentUsage / limit) * 100;

    try {
        const billingDate = new Date(billingCycleStart);
        const billingDateString = billingDate.toISOString().split('T')[0];

        // Verificar threshold de 80%
        if (usagePercentage >= 80 && usagePercentage < 100) {
            const alreadyNotified = await usageNotificationService.hasBeenNotified(
                client.id,
                80,
                billingDate
            );

            if (!alreadyNotified) {
                logger.info('🔔 Client reached 80% usage threshold', {
                    client_id: client.id,
                    usage: currentUsage,
                    limit,
                    percentage: usagePercentage.toFixed(2),
                });

                // Enviar webhook
                await sendUsageThresholdWebhook(client.id, 80, {
                    current_usage: currentUsage,
                    limit,
                    percentage: parseFloat(usagePercentage.toFixed(2)),
                    billing_cycle_start: billingDateString,
                });

                // Marcar como notificado
                await usageNotificationService.markAsNotified(
                    client.id,
                    80,
                    billingDate
                );
            }
        }

        // Verificar threshold de 100%
        if (usagePercentage >= 100) {
            const alreadyNotified = await usageNotificationService.hasBeenNotified(
                client.id,
                100,
                billingDate
            );

            if (!alreadyNotified) {
                logger.warn('⚠️ Client reached 100% usage threshold', {
                    client_id: client.id,
                    usage: currentUsage,
                    limit,
                    percentage: usagePercentage.toFixed(2),
                });

                // Enviar webhook de 100%
                await sendUsageThresholdWebhook(client.id, 100, {
                    current_usage: currentUsage,
                    limit,
                    percentage: parseFloat(usagePercentage.toFixed(2)),
                    billing_cycle_start: billingDateString,
                });

                // Si excedió el límite, también enviar webhook de quota exceeded
                if (currentUsage > limit) {
                    await sendQuotaExceededWebhook(client.id, {
                        current_usage: currentUsage,
                        limit,
                        overage: currentUsage - limit,
                        billing_cycle_start: billingDateString,
                    });
                }

                // Marcar como notificado
                await usageNotificationService.markAsNotified(
                    client.id,
                    100,
                    billingDate
                );
            }
        }
    } catch (error) {
        // No bloquear la request si falla el webhook
        logger.error('Error in usage webhook monitor', {
            error,
            client_id: client.id,
        });
    }

    next();
}

/**
 * Verifica manualmente los thresholds de un cliente
 * Útil para testing o verificación manual
 */
export async function checkClientUsageThresholds(
    client_id: string,
    current_usage: number,
    limit: number,
    billing_cycle_start: Date
): Promise<void> {
    const usagePercentage = (current_usage / limit) * 100;
    const billingDateString = billing_cycle_start.toISOString().split('T')[0];

    // Verificar 80%
    if (usagePercentage >= 80 && usagePercentage < 100) {
        const alreadyNotified = await usageNotificationService.hasBeenNotified(
            client_id,
            80,
            billing_cycle_start
        );

        if (!alreadyNotified) {
            await sendUsageThresholdWebhook(client_id, 80, {
                current_usage,
                limit,
                percentage: parseFloat(usagePercentage.toFixed(2)),
                billing_cycle_start: billingDateString,
            });

            await usageNotificationService.markAsNotified(
                client_id,
                80,
                billing_cycle_start
            );
        }
    }

    // Verificar 100%
    if (usagePercentage >= 100) {
        const alreadyNotified = await usageNotificationService.hasBeenNotified(
            client_id,
            100,
            billing_cycle_start
        );

        if (!alreadyNotified) {
            await sendUsageThresholdWebhook(client_id, 100, {
                current_usage,
                limit,
                percentage: parseFloat(usagePercentage.toFixed(2)),
                billing_cycle_start: billingDateString,
            });

            if (current_usage > limit) {
                await sendQuotaExceededWebhook(client_id, {
                    current_usage,
                    limit,
                    overage: current_usage - limit,
                    billing_cycle_start: billingDateString,
                });
            }

            await usageNotificationService.markAsNotified(
                client_id,
                100,
                billing_cycle_start
            );
        }
    }
}
