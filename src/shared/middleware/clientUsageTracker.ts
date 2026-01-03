import { Request, Response, NextFunction } from 'express';
import { clientService } from '@services/clientService';
import { logger } from '@utils/logger';
import { RateLimitError } from './errorHandler';

/**
 * Middleware para trackear uso mensual de API calls por cliente
 * Incrementa el contador y verifica que no se exceda el límite mensual
 */
export const clientUsageTracker = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Solo aplicar si hay un cliente autenticado
        if (!req.client || !req.clientApiKey) {
            return next();
        }

        const client = req.client;
        const tier = client.tier;
        const currentUsage = client.api_calls_current_month;
        const monthlyLimit = tier.max_api_calls_per_month;

        // Verificar si se excedió el límite mensual
        if (currentUsage >= monthlyLimit) {
            logger.warn(`Monthly limit exceeded for client ${client.id} (${client.name})`, {
                current: currentUsage,
                limit: monthlyLimit,
                tier: tier.name,
            });

            // Agregar headers informativos
            res.setHeader('X-Monthly-Limit', monthlyLimit.toString());
            res.setHeader('X-Monthly-Usage', currentUsage.toString());
            res.setHeader('X-Monthly-Remaining', '0');

            throw new RateLimitError(
                `Monthly API call limit exceeded. Your ${tier.name} plan allows ${monthlyLimit} calls per month. Please upgrade your plan.`,
            );
        }

        // Incrementar contador de uso mensual (no bloqueante)
        clientService.incrementMonthlyUsage(client.id).catch(err => {
            logger.error('Failed to increment monthly usage', {
                clientId: client.id,
                error: err,
            });
        });

        // Agregar headers informativos
        const remaining = Math.max(0, monthlyLimit - currentUsage - 1);
        res.setHeader('X-Monthly-Limit', monthlyLimit.toString());
        res.setHeader('X-Monthly-Usage', (currentUsage + 1).toString());
        res.setHeader('X-Monthly-Remaining', remaining.toString());

        logger.debug(`Usage tracked for client ${client.id}`, {
            current: currentUsage + 1,
            limit: monthlyLimit,
            remaining,
        });

        next();
    } catch (error) {
        if (error instanceof RateLimitError) {
            next(error);
        } else {
            logger.error('Usage tracker error', error);
            // En caso de error, permitir la request pero loggear
            next();
        }
    }
};

/**
 * Middleware combinado: rate limiting + usage tracking
 * Aplica ambos controles en secuencia
 */
export const clientLimitsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    // Primero verificar rate limit por minuto
    const { clientRateLimiter } = await import('./clientRateLimiter');
    
    clientRateLimiter(req, res, (err) => {
        if (err) {
            return next(err);
        }

        // Luego trackear uso mensual
        clientUsageTracker(req, res, next);
    });
};

export default {
    clientUsageTracker,
    clientLimitsMiddleware,
};
