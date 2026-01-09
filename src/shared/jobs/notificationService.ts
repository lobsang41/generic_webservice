import { logger } from '@utils/logger';
import { ResetJobResult } from './monthlyResetJob';

// ============================================================================
// INTERFACES
// ============================================================================

export interface NotificationConfig {
    enabled: boolean;
    webhookUrl?: string; // Slack, Discord, Teams, etc.
    emailRecipients?: string[];
    minFailureThreshold: number; // Minimum failures to trigger alert
}

export type JobType = 'monthly-reset' | 'audit-cleanup' | 'custom';

export interface JobNotification {
    jobType: JobType;
    timestamp: Date;
    success: boolean;
    summary: string;
    details: Record<string, unknown>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const notificationConfig: NotificationConfig = {
    enabled: process.env.JOB_NOTIFICATIONS_ENABLED === 'true',
    webhookUrl: process.env.JOB_NOTIFICATION_WEBHOOK_URL,
    emailRecipients: process.env.JOB_NOTIFICATION_EMAILS?.split(','),
    minFailureThreshold: parseInt(process.env.JOB_NOTIFICATION_MIN_FAILURES || '1', 10),
};

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Envía una notificación sobre la ejecución de un job
 */
export async function sendJobNotification(
    jobType: JobType,
    result: ResetJobResult | any,
): Promise<void> {
    if (!notificationConfig.enabled) {
        logger.debug('Job notifications are disabled');
        return;
    }

    const notification = buildNotification(jobType, result);

    try {
        // Log la notificación
        logNotification(notification);

        // Enviar a webhook si está configurado
        if (notificationConfig.webhookUrl) {
            await sendWebhookNotification(notification);
        }

        // Enviar email si está configurado (placeholder para futura implementación)
        if (notificationConfig.emailRecipients && notificationConfig.emailRecipients.length > 0) {
            await sendEmailNotification(notification);
        }
    } catch (error) {
        logger.error('Failed to send job notification', { error, notification });
    }
}

/**
 * Construye el objeto de notificación
 */
function buildNotification(jobType: JobType, result: any): JobNotification {
    let summary = '';
    let details: Record<string, unknown> = {};

    switch (jobType) {
        case 'monthly-reset':
            summary = result.success
                ? `✅ Monthly reset completed successfully (${result.successCount}/${result.totalClients} clients)`
                : `❌ Monthly reset failed (${result.failureCount}/${result.totalClients} failures)`;
            
            details = {
                totalClients: result.totalClients,
                successCount: result.successCount,
                failureCount: result.failureCount,
                duration: `${result.duration}ms`,
                errors: result.errors,
            };
            break;

        case 'audit-cleanup':
            summary = result.success
                ? `✅ Audit cleanup completed (${result.deletedCount} logs removed)`
                : `❌ Audit cleanup failed`;
            
            details = {
                deletedCount: result.deletedCount || 0,
                retentionDays: result.retentionDays,
                duration: `${result.duration}ms`,
            };
            break;

        default:
            summary = result.success ? '✅ Job completed' : '❌ Job failed';
            details = result;
    }

    return {
        jobType,
        timestamp: new Date(),
        success: result.success,
        summary,
        details,
    };
}

/**
 * Registra la notificación en los logs
 */
function logNotification(notification: JobNotification): void {
    const logLevel = notification.success ? 'info' : 'error';
    
    logger[logLevel]('📬 Job Notification', {
        jobType: notification.jobType,
        summary: notification.summary,
        timestamp: notification.timestamp,
        details: notification.details,
    });
}

/**
 * Envía notificación a webhook (Slack, Discord, Teams, etc.)
 */
async function sendWebhookNotification(notification: JobNotification): Promise<void> {
    if (!notificationConfig.webhookUrl) {
        return;
    }

    try {
        // Determinar si debe enviar basado en el threshold de fallos
        const shouldSend = notification.success || 
            (notification.details.failureCount as number || 0) >= notificationConfig.minFailureThreshold;

        if (!shouldSend) {
            logger.debug('Skipping webhook notification (below failure threshold)');
            return;
        }

        // Formato genérico para webhooks (compatible con Slack, Discord, etc.)
        const payload = {
            text: notification.summary,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `${notification.success ? '✅' : '❌'} ${notification.jobType.toUpperCase()} Job`,
                    },
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: notification.summary,
                    },
                },
                {
                    type: 'section',
                    fields: Object.entries(notification.details).map(([key, value]) => ({
                        type: 'mrkdwn',
                        text: `*${key}:*\n${JSON.stringify(value)}`,
                    })),
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `Timestamp: ${notification.timestamp.toISOString()}`,
                        },
                    ],
                },
            ],
        };

        const response = await fetch(notificationConfig.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
        }

        logger.info('✅ Webhook notification sent successfully');
    } catch (error) {
        logger.error('Failed to send webhook notification', { error });
        throw error;
    }
}

/**
 * Envía notificación por email
 * TODO: Implementar integración con servicio de email (SendGrid, SES, etc.)
 */
async function sendEmailNotification(notification: JobNotification): Promise<void> {
    logger.info('📧 Email notification (not implemented yet)', {
        recipients: notificationConfig.emailRecipients,
        notification,
    });

    // Placeholder para futura implementación
    // Aquí se integraría con SendGrid, AWS SES, Nodemailer, etc.
}

/**
 * Envía una notificación de prueba
 */
export async function sendTestNotification(): Promise<void> {
    const testResult: ResetJobResult = {
        success: true,
        timestamp: new Date(),
        totalClients: 10,
        successCount: 10,
        failureCount: 0,
        errors: [],
        duration: 1234,
    };

    await sendJobNotification('monthly-reset', testResult);
}

/**
 * Obtiene la configuración de notificaciones
 */
export function getNotificationConfig(): NotificationConfig {
    return { ...notificationConfig };
}
