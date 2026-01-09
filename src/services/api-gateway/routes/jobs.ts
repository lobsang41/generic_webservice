import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@middleware/auth';
import { asyncHandler } from '@middleware/errorHandler';
import {
    getSchedulerStatus,
    healthCheck,
    restartScheduler,
} from '@shared/jobs/scheduler';
import {
    executeMonthlyReset,
    getMonthlyResetConfig,
    getLastExecution,
    restartMonthlyResetJob,
} from '@shared/jobs/monthlyResetJob';
import { sendTestNotification } from '@shared/jobs/notificationService';

const router = Router();

// Todas las rutas requieren autenticación de admin
router.use(authenticate);
router.use(authorize('admin'));

// ============================================================================
// SCHEDULER STATUS
// ============================================================================

/**
 * GET /api/v1/jobs/status
 * Obtiene el estado del scheduler y todos los jobs
 */
router.get(
    '/status',
    asyncHandler(async (req: Request, res: Response) => {
        const status = getSchedulerStatus();
        const health = healthCheck();

        res.json({
            success: true,
            data: {
                scheduler: status,
                health,
            },
        });
    }),
);

// ============================================================================
// MONTHLY RESET JOB
// ============================================================================

/**
 * GET /api/v1/jobs/monthly-reset
 * Obtiene información del job de reset mensual
 */
router.get(
    '/monthly-reset',
    asyncHandler(async (req: Request, res: Response) => {
        const config = getMonthlyResetConfig();
        const lastExecution = getLastExecution();

        res.json({
            success: true,
            data: {
                config,
                lastExecution,
            },
        });
    }),
);

/**
 * POST /api/v1/jobs/monthly-reset/execute
 * Ejecuta manualmente el reset mensual
 */
router.post(
    '/monthly-reset/execute',
    asyncHandler(async (req: Request, res: Response) => {
        const result = await executeMonthlyReset();

        res.json({
            success: true,
            message: 'Monthly reset executed',
            data: result,
        });
    }),
);

/**
 * POST /api/v1/jobs/monthly-reset/restart
 * Reinicia el job de reset mensual con nueva configuración
 */
router.post(
    '/monthly-reset/restart',
    asyncHandler(async (req: Request, res: Response) => {
        const { cronExpression, timezone, retryAttempts, retryDelayMs, enabled } = req.body;

        const newConfig: any = {};
        if (cronExpression !== undefined) newConfig.cronExpression = cronExpression;
        if (timezone !== undefined) newConfig.timezone = timezone;
        if (retryAttempts !== undefined) newConfig.retryAttempts = parseInt(retryAttempts, 10);
        if (retryDelayMs !== undefined) newConfig.retryDelayMs = parseInt(retryDelayMs, 10);
        if (enabled !== undefined) newConfig.enabled = enabled === true || enabled === 'true';

        restartMonthlyResetJob(newConfig);

        res.json({
            success: true,
            message: 'Monthly reset job restarted',
            data: {
                newConfig: getMonthlyResetConfig(),
            },
        });
    }),
);

// ============================================================================
// SCHEDULER CONTROL
// ============================================================================

/**
 * POST /api/v1/jobs/scheduler/restart
 * Reinicia todo el scheduler
 */
router.post(
    '/scheduler/restart',
    asyncHandler(async (req: Request, res: Response) => {
        restartScheduler();

        res.json({
            success: true,
            message: 'Scheduler restarted',
            data: getSchedulerStatus(),
        });
    }),
);

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * POST /api/v1/jobs/notifications/test
 * Envía una notificación de prueba
 */
router.post(
    '/notifications/test',
    asyncHandler(async (req: Request, res: Response) => {
        await sendTestNotification();

        res.json({
            success: true,
            message: 'Test notification sent',
        });
    }),
);

export default router;
