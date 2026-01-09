/**
 * Jobs Module - Centralized Cron Job Management
 * 
 * Este módulo gestiona todos los trabajos programados (cron jobs) del sistema:
 * - Reset mensual de cuotas de clientes
 * - Limpieza automática de audit logs
 * - Sistema de notificaciones
 * - Scheduler central con health checks
 */

// Scheduler principal
export {
    startScheduler,
    stopScheduler,
    restartScheduler,
    getSchedulerStatus,
    healthCheck,
    gracefulShutdown,
} from './scheduler';

// Monthly Reset Job
export {
    executeMonthlyReset,
    startMonthlyResetJob,
    stopMonthlyResetJob,
    restartMonthlyResetJob,
    getMonthlyResetConfig,
    getLastExecution,
    isJobRunning,
} from './monthlyResetJob';

export type { MonthlyResetConfig, ResetJobResult } from './monthlyResetJob';

// Audit Cleanup Job
export {
    startAuditCleanupJob,
    stopAuditCleanupJob,
    restartAuditCleanupJob,
} from './auditCleanupJob';

// Notification Service
export {
    sendJobNotification,
    sendTestNotification,
    getNotificationConfig,
} from './notificationService';

export type { NotificationConfig, JobType, JobNotification } from './notificationService';
