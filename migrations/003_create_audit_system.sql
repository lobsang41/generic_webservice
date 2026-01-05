-- ============================================================================
-- Migración 003: Sistema de Auditoría
-- ============================================================================
-- Descripción: Crea la tabla audit_log para registrar cambios en tablas críticas
--
-- Propósito:
-- - Rastrear cambios en usuarios, clientes y API keys
-- - Cumplimiento y seguridad
-- - Debugging y análisis forense
--
-- Rollback: DROP TABLE audit_log
-- ============================================================================

-- ============================================================================
-- TABLA: audit_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    -- Identificación del registro
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Información del cambio
    table_name VARCHAR(64) NOT NULL COMMENT 'Nombre de la tabla modificada',
    record_id VARCHAR(255) NOT NULL COMMENT 'ID del registro modificado',
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL COMMENT 'Tipo de operación',
    
    -- Datos del cambio
    old_values JSON DEFAULT NULL COMMENT 'Valores antes del cambio (UPDATE/DELETE)',
    new_values JSON DEFAULT NULL COMMENT 'Valores después del cambio (INSERT/UPDATE)',
    
    -- Metadata del cambio
    changed_by VARCHAR(255) DEFAULT NULL COMMENT 'Usuario que realizó el cambio',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Momento del cambio',
    ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP del cliente (si disponible)',
    user_agent TEXT DEFAULT NULL COMMENT 'User agent (si disponible)',
    
    -- Índices para búsqueda eficiente
    INDEX idx_audit_table_record (table_name, record_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_changed_at (changed_at),
    INDEX idx_audit_changed_by (changed_by),
    INDEX idx_audit_table_action (table_name, action)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Registro de auditoría de cambios en tablas críticas';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que la tabla se creó correctamente
DESCRIBE audit_log;

-- Verificar índices
SHOW INDEX FROM audit_log;

-- ============================================================================
-- QUERIES DE EJEMPLO PARA AUDITORÍA
-- ============================================================================

-- Ver todos los cambios en una tabla específica
-- SELECT * FROM audit_log WHERE table_name = 'users' ORDER BY changed_at DESC LIMIT 10;

-- Ver cambios de un registro específico
-- SELECT * FROM audit_log WHERE table_name = 'users' AND record_id = 'user-id' ORDER BY changed_at DESC;

-- Ver todos los DELETE
-- SELECT * FROM audit_log WHERE action = 'DELETE' ORDER BY changed_at DESC LIMIT 10;

-- Ver cambios de las últimas 24 horas
-- SELECT * FROM audit_log WHERE changed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY changed_at DESC;

-- Ver cambios por usuario
-- SELECT * FROM audit_log WHERE changed_by = 'admin@example.com' ORDER BY changed_at DESC LIMIT 10;

-- ============================================================================
-- MANTENIMIENTO
-- ============================================================================

-- Rotación de logs (ejecutar cada 6 meses)
-- DELETE FROM audit_log WHERE changed_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);

-- Estadísticas de auditoría
/*
SELECT 
    table_name,
    action,
    COUNT(*) as total_changes,
    DATE(changed_at) as change_date
FROM audit_log
WHERE changed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY table_name, action, DATE(changed_at)
ORDER BY change_date DESC, table_name, action;
*/

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TABLE IF EXISTS audit_log;

-- ============================================================================
