-- ============================================================================
-- WEBHOOK SYSTEM TABLES
-- Sistema de webhooks para notificaciones de cuota de uso
-- ============================================================================

-- Tabla de configuración de webhooks por cliente
CREATE TABLE IF NOT EXISTS webhook_configs (
    id VARCHAR(21) PRIMARY KEY,
    client_id VARCHAR(21) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    secret VARCHAR(64) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    events JSON NOT NULL,
    custom_headers JSON DEFAULT NULL,
    timeout_ms INT DEFAULT 5000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(21) DEFAULT NULL,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_client_enabled (client_id, enabled),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de registro de entregas de webhooks
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id VARCHAR(21) PRIMARY KEY,
    webhook_config_id VARCHAR(21) NOT NULL,
    client_id VARCHAR(21) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('pending', 'success', 'failed', 'retrying') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    response_status INT DEFAULT NULL,
    response_body TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    duration_ms INT DEFAULT NULL,
    next_retry_at TIMESTAMP NULL DEFAULT NULL,
    delivered_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (webhook_config_id) REFERENCES webhook_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_status_retry (status, next_retry_at),
    INDEX idx_client_event (client_id, event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_webhook_config (webhook_config_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de notificaciones de threshold (para evitar duplicados)
CREATE TABLE IF NOT EXISTS usage_notifications (
    id VARCHAR(21) PRIMARY KEY,
    client_id VARCHAR(21) NOT NULL,
    threshold INT NOT NULL,
    billing_cycle_start DATE NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_notification (client_id, threshold, billing_cycle_start),
    INDEX idx_client_cycle (client_id, billing_cycle_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- NOTA: Los triggers de audit log han sido omitidos debido a restricciones
-- de privilegios en el servidor MySQL. El audit logging se manejará a nivel
-- de aplicación en lugar de triggers de base de datos.
-- ============================================================================
