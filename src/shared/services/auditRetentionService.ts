import mysqlDB from '@database/mysql';
import logger from '@utils/logger';

/**
 * Configuración de retención de audit logs
 */
export interface RetentionConfig {
    retentionDays: number;
    cleanupEnabled: boolean;
    cleanupHour: number;
    lastCleanup?: Date;
    lastCleanupDeleted?: number;
}

// Configuración en memoria (se puede mover a DB si se requiere persistencia)
let retentionConfig: RetentionConfig = {
    retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '180'),
    cleanupEnabled: process.env.AUDIT_CLEANUP_ENABLED === 'true',
    cleanupHour: parseInt(process.env.AUDIT_CLEANUP_HOUR || '2'),
};

/**
 * Obtiene la configuración actual de retención
 */
export function getRetentionConfig(): RetentionConfig {
    return { ...retentionConfig };
}

/**
 * Actualiza la configuración de retención
 */
export function updateRetentionConfig(config: Partial<RetentionConfig>): RetentionConfig {
    // Validaciones
    if (config.retentionDays !== undefined) {
        if (config.retentionDays < 30 || config.retentionDays > 730) {
            throw new Error('Retention days must be between 30 and 730');
        }
        retentionConfig.retentionDays = config.retentionDays;
    }

    if (config.cleanupEnabled !== undefined) {
        retentionConfig.cleanupEnabled = config.cleanupEnabled;
    }

    if (config.cleanupHour !== undefined) {
        if (config.cleanupHour < 0 || config.cleanupHour > 23) {
            throw new Error('Cleanup hour must be between 0 and 23');
        }
        retentionConfig.cleanupHour = config.cleanupHour;
    }

    logger.info('Retention config updated', { config: retentionConfig });
    return { ...retentionConfig };
}

/**
 * Limpia logs antiguos según la configuración de retención
 */
export async function cleanupOldLogs(): Promise<{ deletedRecords: number; cutoffDate: Date }> {
    try {
        const { retentionDays, cleanupEnabled } = retentionConfig;

        if (!cleanupEnabled) {
            logger.info('Cleanup is disabled, skipping');
            return { deletedRecords: 0, cutoffDate: new Date() };
        }

        // Calcular fecha de corte
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        logger.info(`Starting audit log cleanup`, {
            retentionDays,
            cutoffDate: cutoffDate.toISOString(),
        });

        // Eliminar logs antiguos
        const result = await mysqlDB.query(
            'DELETE FROM audit_log WHERE changed_at < ?',
            [cutoffDate]
        );

        const deletedRecords = (result as any).affectedRows || 0;

        // Actualizar estadísticas
        retentionConfig.lastCleanup = new Date();
        retentionConfig.lastCleanupDeleted = deletedRecords;

        logger.info(`Audit log cleanup completed`, {
            deletedRecords,
            cutoffDate: cutoffDate.toISOString(),
        });

        return { deletedRecords, cutoffDate };
    } catch (error) {
        logger.error('Error during audit log cleanup', { error });
        throw error;
    }
}

/**
 * Obtiene estadísticas de la última limpieza
 */
export function getCleanupStats(): {
    lastCleanup?: Date;
    lastCleanupDeleted?: number;
} {
    return {
        lastCleanup: retentionConfig.lastCleanup,
        lastCleanupDeleted: retentionConfig.lastCleanupDeleted,
    };
}
