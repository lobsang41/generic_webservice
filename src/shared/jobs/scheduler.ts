import { logger } from '@utils/logger';
import { startMonthlyResetJob, stopMonthlyResetJob, getMonthlyResetConfig, getLastExecution as getMonthlyResetLastExecution } from './monthlyResetJob';
import { startAuditCleanupJob, stopAuditCleanupJob } from './auditCleanupJob';

// ============================================================================
// INTERFACES
// ============================================================================

export interface JobStatus {
    name: string;
    enabled: boolean;
    running: boolean;
    lastExecution: Date | null;
    nextExecution: string | null;
    config: Record<string, unknown>;
}

export interface SchedulerStatus {
    running: boolean;
    jobs: JobStatus[];
    startedAt: Date | null;
}

// ============================================================================
// STATE
// ============================================================================

let schedulerRunning = false;
let schedulerStartedAt: Date | null = null;

// ============================================================================
// MAIN SCHEDULER FUNCTIONS
// ============================================================================

/**
 * Inicia todos los jobs programados
 */
export function startScheduler(): void {
    if (schedulerRunning) {
        logger.warn('⚠️ Scheduler is already running');
        return;
    }

    logger.info('🚀 Starting Job Scheduler');

    try {
        // Iniciar job de reset mensual
        startMonthlyResetJob();

        // Iniciar job de limpieza de audit logs
        startAuditCleanupJob();

        schedulerRunning = true;
        schedulerStartedAt = new Date();

        logger.info('✅ Job Scheduler started successfully', {
            startedAt: schedulerStartedAt,
        });
    } catch (error) {
        logger.error('❌ Failed to start Job Scheduler', { error });
        throw error;
    }
}

/**
 * Detiene todos los jobs programados
 */
export function stopScheduler(): void {
    if (!schedulerRunning) {
        logger.warn('⚠️ Scheduler is not running');
        return;
    }

    logger.info('🛑 Stopping Job Scheduler');

    try {
        // Detener todos los jobs
        stopMonthlyResetJob();
        stopAuditCleanupJob();

        schedulerRunning = false;
        schedulerStartedAt = null;

        logger.info('✅ Job Scheduler stopped successfully');
    } catch (error) {
        logger.error('❌ Failed to stop Job Scheduler', { error });
        throw error;
    }
}

/**
 * Reinicia el scheduler
 */
export function restartScheduler(): void {
    logger.info('🔄 Restarting Job Scheduler');
    stopScheduler();
    startScheduler();
}

// ============================================================================
// STATUS FUNCTIONS
// ============================================================================

/**
 * Obtiene el estado del scheduler y todos los jobs
 */
export function getSchedulerStatus(): SchedulerStatus {
    const monthlyResetConfig = getMonthlyResetConfig();
    const monthlyResetLastExec = getMonthlyResetLastExecution();

    const jobs: JobStatus[] = [
        {
            name: 'monthly-reset',
            enabled: monthlyResetConfig.enabled,
            running: schedulerRunning,
            lastExecution: monthlyResetLastExec?.timestamp || null,
            nextExecution: monthlyResetConfig.enabled ? calculateNextExecution(monthlyResetConfig.cronExpression) : null,
            config: {
                cronExpression: monthlyResetConfig.cronExpression,
                timezone: monthlyResetConfig.timezone,
                retryAttempts: monthlyResetConfig.retryAttempts,
            },
        },
        {
            name: 'audit-cleanup',
            enabled: process.env.AUDIT_CLEANUP_ENABLED === 'true',
            running: schedulerRunning,
            lastExecution: null, // TODO: Implementar en auditCleanupJob
            nextExecution: process.env.AUDIT_CLEANUP_ENABLED === 'true' 
                ? `Daily at ${process.env.AUDIT_CLEANUP_HOUR || 2}:00` 
                : null,
            config: {
                retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '180', 10),
                cleanupHour: parseInt(process.env.AUDIT_CLEANUP_HOUR || '2', 10),
            },
        },
    ];

    return {
        running: schedulerRunning,
        jobs,
        startedAt: schedulerStartedAt,
    };
}

/**
 * Calcula la próxima ejecución basada en la expresión cron
 * Nota: Esta es una implementación simplificada
 */
function calculateNextExecution(cronExpression: string): string {
    // Para '0 0 1 * *' (primer día del mes a medianoche)
    if (cronExpression === '0 0 1 * *') {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
        return nextMonth.toISOString();
    }

    // Para otras expresiones, retornar descripción genérica
    return `Next execution based on: ${cronExpression}`;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Verifica la salud del scheduler
 */
export function healthCheck(): {
    healthy: boolean;
    scheduler: {
        running: boolean;
        uptime: number | null;
    };
    jobs: {
        total: number;
        enabled: number;
        running: number;
    };
} {
    const status = getSchedulerStatus();
    const uptime = schedulerStartedAt 
        ? Date.now() - schedulerStartedAt.getTime() 
        : null;

    return {
        healthy: schedulerRunning,
        scheduler: {
            running: schedulerRunning,
            uptime,
        },
        jobs: {
            total: status.jobs.length,
            enabled: status.jobs.filter(j => j.enabled).length,
            running: status.jobs.filter(j => j.running).length,
        },
    };
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Maneja el cierre graceful del scheduler
 */
export function gracefulShutdown(): void {
    logger.info('🔄 Graceful shutdown initiated for Job Scheduler');
    
    try {
        stopScheduler();
        logger.info('✅ Job Scheduler shutdown completed');
    } catch (error) {
        logger.error('❌ Error during Job Scheduler shutdown', { error });
    }
}

// Registrar handlers para señales de sistema
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
