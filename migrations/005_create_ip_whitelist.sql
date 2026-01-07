-- ============================================================================
-- IP Whitelisting System
-- ============================================================================
-- Tabla para gestionar IPs permitidas por cliente
-- Soporta IPs individuales y rangos CIDR

CREATE TABLE IF NOT EXISTS client_ip_whitelist (
    id VARCHAR(21) PRIMARY KEY,
    client_id VARCHAR(21) NOT NULL,
    ip_address VARCHAR(45),            -- IPv4 o IPv6 individual
    cidr_range VARCHAR(50),            -- Rango CIDR (ej: "192.168.1.0/24")
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Índices para búsquedas rápidas
    INDEX idx_client_active (client_id, is_active),
    INDEX idx_ip_lookup (ip_address, is_active),
    
    -- Constraint: al menos uno de ip_address o cidr_range debe estar presente
    CHECK (ip_address IS NOT NULL OR cidr_range IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comentarios
ALTER TABLE client_ip_whitelist 
    COMMENT = 'IP whitelisting per client with CIDR support';
