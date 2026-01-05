/**
 * Sistema de Auditoría
 * 
 * Registra automáticamente cambios en tablas críticas.
 * Alternativa a triggers SQL para servidores sin privilegios SUPER.
 */

import mysqlDB from '@database/mysql';

interface AuditLogEntry {
    tableName: string;
    recordId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    changedBy?: string;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Registra un cambio en la tabla audit_log
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
    try {
        await mysqlDB.query(
            `INSERT INTO audit_log (
                table_name, 
                record_id, 
                action, 
                old_values, 
                new_values, 
                changed_by, 
                ip_address, 
                user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                entry.tableName,
                entry.recordId,
                entry.action,
                entry.oldValues ? JSON.stringify(entry.oldValues) : null,
                entry.newValues ? JSON.stringify(entry.newValues) : null,
                entry.changedBy || null,
                entry.ipAddress || null,
                entry.userAgent || null,
            ]
        );
    } catch (error) {
        // No fallar la operación principal si la auditoría falla
        console.error('Error logging audit:', error);
    }
}

/**
 * Helper para registrar INSERT
 */
export async function logInsert(
    tableName: string,
    recordId: string,
    newValues: Record<string, any>,
    metadata?: { changedBy?: string; ipAddress?: string; userAgent?: string }
): Promise<void> {
    await logAudit({
        tableName,
        recordId,
        action: 'INSERT',
        newValues,
        ...metadata,
    });
}

/**
 * Helper para registrar UPDATE
 */
export async function logUpdate(
    tableName: string,
    recordId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    metadata?: { changedBy?: string; ipAddress?: string; userAgent?: string }
): Promise<void> {
    await logAudit({
        tableName,
        recordId,
        action: 'UPDATE',
        oldValues,
        newValues,
        ...metadata,
    });
}

/**
 * Helper para registrar DELETE
 */
export async function logDelete(
    tableName: string,
    recordId: string,
    oldValues: Record<string, any>,
    metadata?: { changedBy?: string; ipAddress?: string; userAgent?: string }
): Promise<void> {
    await logAudit({
        tableName,
        recordId,
        action: 'DELETE',
        oldValues,
        ...metadata,
    });
}

/**
 * Obtener metadata del request (para usar en los logs)
 */
export function getAuditMetadata(req: any): { changedBy?: string; ipAddress?: string; userAgent?: string } {
    return {
        changedBy: req.user?.email || req.user?.userId || undefined,
        ipAddress: req.ip || req.connection?.remoteAddress || undefined,
        userAgent: req.get('user-agent') || undefined,
    };
}
