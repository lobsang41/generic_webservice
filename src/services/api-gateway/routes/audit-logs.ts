import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler } from '@middleware/errorHandler';
import { requireScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';
import mysqlDB from '@database/mysql';
import {
    getRetentionConfig,
    updateRetentionConfig,
    cleanupOldLogs,
} from '@services/auditRetentionService';
import { restartAuditCleanupJob } from '@shared/jobs/auditCleanupJob';

const router = Router();

/**
 * GET /api/v1/audit-logs
 * Listar registros de auditoría con filtros
 * Requiere: audit:read (solo admin)
 */
router.get('/', 
    authenticate, 
    requireScope(SCOPES.AUDIT_READ),
    asyncHandler(async (req: Request, res: Response) => {
        const { 
            table_name, 
            record_id, 
            action, 
            changed_by,
            from_date,
            to_date,
            page = '1', 
            limit = '50' 
        } = req.query;

        const pageNum = Number(page);
        const limitNum = Math.min(Number(limit), 100); // Max 100 registros
        const offset = (pageNum - 1) * limitNum;

        // Construir query dinámicamente
        const conditions: string[] = [];
        const values: any[] = [];

        if (table_name) {
            conditions.push('table_name = ?');
            values.push(table_name);
        }

        if (record_id) {
            conditions.push('record_id = ?');
            values.push(record_id);
        }

        if (action) {
            conditions.push('action = ?');
            values.push(action);
        }

        if (changed_by) {
            conditions.push('changed_by = ?');
            values.push(changed_by);
        }

        if (from_date) {
            conditions.push('changed_at >= ?');
            values.push(from_date);
        }

        if (to_date) {
            conditions.push('changed_at <= ?');
            values.push(to_date);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query principal
        const result = await mysqlDB.query(
            `SELECT 
                id,
                table_name,
                record_id,
                action,
                old_values,
                new_values,
                changed_by,
                changed_at,
                ip_address,
                user_agent
            FROM audit_log
            ${whereClause}
            ORDER BY changed_at DESC
            LIMIT ${limitNum} OFFSET ${offset}`,
            values
        );

        // Contar total
        const countResult = await mysqlDB.query(
            `SELECT COUNT(*) as total FROM audit_log ${whereClause}`,
            values
        );

        const total = (countResult[0] as any).total;

        res.json({
            success: true,
            data: {
                logs: result,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    })
);

/**
 * GET /api/v1/audit-logs/:id
 * Obtener un registro de auditoría específico
 * Requiere: audit:read (solo admin)
 */
router.get('/:id', 
    authenticate, 
    requireScope(SCOPES.AUDIT_READ),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const result = await mysqlDB.query(
            `SELECT 
                id,
                table_name,
                record_id,
                action,
                old_values,
                new_values,
                changed_by,
                changed_at,
                ip_address,
                user_agent
            FROM audit_log
            WHERE id = ?`,
            [id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Audit log not found',
            });
        }

        return res.json({
            success: true,
            data: {
                log: result[0],
            },
        });
    })
);

/**
 * GET /api/v1/audit-logs/stats
 * Obtener estadísticas de auditoría
 * Requiere: audit:read (solo admin)
 */
router.get('/stats/summary', 
    authenticate, 
    requireScope(SCOPES.AUDIT_READ),
    asyncHandler(async (req: Request, res: Response) => {
        const { days = '30' } = req.query;

        // Estadísticas por tabla y acción
        const stats = await mysqlDB.query(
            `SELECT 
                table_name,
                action,
                COUNT(*) as count,
                MIN(changed_at) as first_change,
                MAX(changed_at) as last_change
            FROM audit_log
            WHERE changed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY table_name, action
            ORDER BY table_name, action`,
            [Number(days)]
        );

        // Total de cambios
        const totalResult = await mysqlDB.query(
            `SELECT COUNT(*) as total FROM audit_log
             WHERE changed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [Number(days)]
        );

        // Usuarios más activos
        const topUsers = await mysqlDB.query(
            `SELECT 
                changed_by,
                COUNT(*) as changes
            FROM audit_log
            WHERE changed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND changed_by IS NOT NULL
            GROUP BY changed_by
            ORDER BY changes DESC
            LIMIT 10`,
            [Number(days)]
        );

        res.json({
            success: true,
            data: {
                period_days: Number(days),
                total_changes: (totalResult[0] as any).total,
                by_table_and_action: stats,
                top_users: topUsers,
            },
        });
    })
);

/**
 * GET /api/v1/audit-logs/retention
 * Obtener configuración de retención
 * Requiere: audit:read
 */
router.get('/retention/config',
    authenticate,
    requireScope(SCOPES.AUDIT_READ),
    asyncHandler(async (req: Request, res: Response) => {
        const config = getRetentionConfig();
        
        return res.json({
            success: true,
            data: config,
        });
    })
);

/**
 * POST /api/v1/audit-logs/retention
 * Actualizar configuración de retención
 * Requiere: audit:admin (solo admin)
 */
router.post('/retention/config',
    authenticate,
    requireScope(SCOPES.AUDIT_ADMIN),
    asyncHandler(async (req: Request, res: Response) => {
        const { retentionDays, cleanupEnabled, cleanupHour } = req.body;
        
        try {
            const updatedConfig = updateRetentionConfig({
                retentionDays,
                cleanupEnabled,
                cleanupHour,
            });
            
            // Reiniciar job con nueva configuración
            restartAuditCleanupJob();
            
            return res.json({
                success: true,
                data: updatedConfig,
                message: 'Retention configuration updated successfully',
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    })
);

/**
 * POST /api/v1/audit-logs/cleanup
 * Ejecutar limpieza manual de logs antiguos
 * Requiere: audit:admin (solo admin)
 */
router.post('/retention/cleanup',
    authenticate,
    requireScope(SCOPES.AUDIT_ADMIN),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const result = await cleanupOldLogs();
            
            return res.json({
                success: true,
                data: result,
                message: `Successfully deleted ${result.deletedRecords} old audit log records`,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    })
);

export default router;
