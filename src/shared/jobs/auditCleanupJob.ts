import cron, { ScheduledTask } from 'node-cron';
import { cleanupOldLogs, getRetentionConfig } from '@services/auditRetentionService';
import logger from '@utils/logger';

let cleanupJob: ScheduledTask | null = null;

/**
 * Inicia el job de limpieza automática de audit logs
 */
export function startAuditCleanupJob(): void {
    const config = getRetentionConfig();

    if (!config.cleanupEnabled) {
        logger.info('Audit cleanup job is disabled');
        return;
    }

    // Detener job existente si hay uno
    if (cleanupJob) {
        cleanupJob.stop();
    }

    // Crear expresión cron para ejecutar diariamente a la hora configurada
    // Formato: minuto hora * * *
    const cronExpression = `0 ${config.cleanupHour} * * *`;

    logger.info(`Starting audit cleanup job`, {
        cronExpression,
        cleanupHour: config.cleanupHour,
        retentionDays: config.retentionDays,
    });

    // Crear y programar el job
    cleanupJob = cron.schedule(cronExpression, async () => {
        logger.info('Running scheduled audit log cleanup');
        try {
            const result = await cleanupOldLogs();
            logger.info('Scheduled cleanup completed', result);
        } catch (error) {
            logger.error('Scheduled cleanup failed', { error });
        }
    });

    logger.info('Audit cleanup job started successfully');
}

/**
 * Detiene el job de limpieza automática
 */
export function stopAuditCleanupJob(): void {
    if (cleanupJob) {
        cleanupJob.stop();
        cleanupJob = null;
        logger.info('Audit cleanup job stopped');
    }
}

/**
 * Reinicia el job con la nueva configuración
 */
export function restartAuditCleanupJob(): void {
    stopAuditCleanupJob();
    startAuditCleanupJob();
}
