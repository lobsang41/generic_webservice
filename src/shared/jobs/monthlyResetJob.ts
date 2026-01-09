import cron, { ScheduledTask } from 'node-cron';
import { clientService } from '@services/clientService';
import { logger } from '@utils/logger';
import { sendJobNotification } from './notificationService';

// ============================================================================
// INTERFACES
// ============================================================================

export interface MonthlyResetConfig {
    enabled: boolean;
    cronExpression: string; // Default: '0 0 1 * *' (1st day of month at midnight)
    timezone: string; // Default: 'America/New_York'
    retryAttempts: number; // Number of retries on failure
    retryDelayMs: number; // Delay between retries in milliseconds
}

export interface ResetJobResult {
    success: boolean;
    timestamp: Date;
    totalClients: number;
    successCount: number;
    failureCount: number;
    errors: Array<{ clientId: string; error: string }>;
    duration: number; // milliseconds
}

// ============================================================================
// CONFIGURATION
// ============================================================================

let jobConfig: MonthlyResetConfig = {
    enabled: process.env.MONTHLY_RESET_ENABLED === 'true',
    cronExpression: process.env.MONTHLY_RESET_CRON || '0 0 1 * *', // 1st day at midnight
    timezone: process.env.MONTHLY_RESET_TIMEZONE || 'America/New_York',
    retryAttempts: parseInt(process.env.MONTHLY_RESET_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.MONTHLY_RESET_RETRY_DELAY_MS || '5000', 10),
};

let scheduledJob: ScheduledTask | null = null;
let lastExecution: ResetJobResult | null = null;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Ejecuta el reset mensual de todos los clientes activos
 */
export async function executeMonthlyReset(): Promise<ResetJobResult> {
    const startTime = Date.now();
    const result: ResetJobResult = {
        success: false,
        timestamp: new Date(),
        totalClients: 0,
        successCount: 0,
        failureCount: 0,
        errors: [],
        duration: 0,
    };

    logger.info('🔄 Starting monthly usage reset job');

    try {
        // Obtener todos los clientes activos
        const { clients } = await clientService.listClients({
            is_active: true,
            limit: 1000, // Procesar hasta 1000 clientes por ejecución
        });

        result.totalClients = clients.length;
        logger.info(`Found ${clients.length} active clients to reset`);

        // Resetear cada cliente con reintentos
        for (const client of clients) {
            const resetSuccess = await resetClientWithRetry(client.id, client.name);
            
            if (resetSuccess) {
                result.successCount++;
            } else {
                result.failureCount++;
                result.errors.push({
                    clientId: client.id,
                    error: 'Failed after all retry attempts',
                });
            }
        }

        result.success = result.failureCount === 0;
        result.duration = Date.now() - startTime;

        // Log resultado
        logger.info('✅ Monthly reset job completed', {
            totalClients: result.totalClients,
            successCount: result.successCount,
            failureCount: result.failureCount,
            duration: `${result.duration}ms`,
        });

        // Guardar última ejecución
        lastExecution = result;

        // Enviar notificación
        await sendJobNotification('monthly-reset', result);

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logger.error('❌ Monthly reset job failed', { error: errorMessage });
        
        result.success = false;
        result.duration = Date.now() - startTime;
        result.errors.push({
            clientId: 'SYSTEM',
            error: errorMessage,
        });

        lastExecution = result;

        // Enviar notificación de error
        await sendJobNotification('monthly-reset', result);

        throw error;
    }
}

/**
 * Resetea un cliente con reintentos automáticos
 */
async function resetClientWithRetry(
    clientId: string,
    clientName: string,
    attempt: number = 1,
): Promise<boolean> {
    try {
        await clientService.resetMonthlyUsage(clientId);
        
        logger.info(`✓ Reset successful for client: ${clientName} (${clientId})`);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logger.warn(`⚠️ Reset failed for client: ${clientName} (${clientId}) - Attempt ${attempt}/${jobConfig.retryAttempts}`, {
            error: errorMessage,
        });

        // Reintentar si no se alcanzó el límite
        if (attempt < jobConfig.retryAttempts) {
            // Esperar antes de reintentar
            await sleep(jobConfig.retryDelayMs);
            return resetClientWithRetry(clientId, clientName, attempt + 1);
        }

        logger.error(`❌ Reset failed permanently for client: ${clientName} (${clientId})`, {
            error: errorMessage,
            attempts: attempt,
        });

        return false;
    }
}

/**
 * Helper: Sleep function
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// SCHEDULER FUNCTIONS
// ============================================================================

/**
 * Inicia el job programado de reset mensual
 */
export function startMonthlyResetJob(): void {
    if (!jobConfig.enabled) {
        logger.info('📅 Monthly reset job is disabled');
        return;
    }

    // Detener job existente si hay uno
    if (scheduledJob) {
        scheduledJob.stop();
    }

    logger.info('📅 Starting monthly reset job', {
        cronExpression: jobConfig.cronExpression,
        timezone: jobConfig.timezone,
        retryAttempts: jobConfig.retryAttempts,
    });

    // Crear y programar el job
    scheduledJob = cron.schedule(
        jobConfig.cronExpression,
        async () => {
            logger.info('🔔 Monthly reset job triggered by schedule');
            try {
                await executeMonthlyReset();
            } catch (error) {
                logger.error('Monthly reset job execution failed', { error });
            }
        },
        {
            timezone: jobConfig.timezone,
        },
    );

    logger.info('✅ Monthly reset job started successfully');
}

/**
 * Detiene el job programado
 */
export function stopMonthlyResetJob(): void {
    if (scheduledJob) {
        scheduledJob.stop();
        scheduledJob = null;
        logger.info('🛑 Monthly reset job stopped');
    }
}

/**
 * Reinicia el job con nueva configuración
 */
export function restartMonthlyResetJob(newConfig?: Partial<MonthlyResetConfig>): void {
    if (newConfig) {
        jobConfig = { ...jobConfig, ...newConfig };
        logger.info('⚙️ Monthly reset job configuration updated', jobConfig);
    }
    
    stopMonthlyResetJob();
    startMonthlyResetJob();
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Obtiene la configuración actual del job
 */
export function getMonthlyResetConfig(): MonthlyResetConfig {
    return { ...jobConfig };
}

/**
 * Obtiene el resultado de la última ejecución
 */
export function getLastExecution(): ResetJobResult | null {
    return lastExecution;
}

/**
 * Verifica si el job está activo
 */
export function isJobRunning(): boolean {
    return scheduledJob !== null;
}
