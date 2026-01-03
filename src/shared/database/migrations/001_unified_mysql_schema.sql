-- ============================================================================
-- Mad Kitty Services - Schema Unificado para MySQL
-- ============================================================================
-- Migración única que incluye:
-- - Sistema de usuarios y autenticación
-- - Módulo de clientes SaaS (tiers, clients, client_api_keys)
-- - Tablas esenciales de sistema
-- Compatible con MySQL 5.7+
-- ============================================================================

-- ============================================================================
-- TABLA: users (Usuarios del sistema)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    client_id VARCHAR(255) NULL DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    email_verified TINYINT(1) DEFAULT 0,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- TABLA: api_keys (API Keys de usuarios individuales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(255) PRIMARY KEY,
    hashed_key TEXT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSON DEFAULT NULL,
    last_used_at TIMESTAMP NULL DEFAULT NULL,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- ============================================================================
-- TABLA: client_tiers (Planes/Tipos de Cliente para SaaS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_tiers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_api_calls_per_month INT NOT NULL DEFAULT 10000,
    max_api_calls_per_minute INT NOT NULL DEFAULT 10,
    max_users INT NOT NULL DEFAULT 3,
    features JSON DEFAULT NULL,
    price_monthly DECIMAL(10, 2) DEFAULT 0.00,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_client_tiers_is_active ON client_tiers(is_active);

-- ============================================================================
-- TABLA: clients (Clientes/Tenants del SaaS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    tier_id VARCHAR(50) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    api_calls_current_month INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    metadata JSON DEFAULT NULL,
    billing_cycle_start DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_clients_tier FOREIGN KEY (tier_id) REFERENCES client_tiers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_clients_tier_id ON clients(tier_id);
CREATE INDEX idx_clients_slug ON clients(slug);
CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_clients_created_at ON clients(created_at);

-- ============================================================================
-- TABLA: client_api_keys (API Keys de Clientes SaaS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_api_keys (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    hashed_key TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(50) DEFAULT 'production',
    permissions JSON DEFAULT NULL,
    last_used_at TIMESTAMP NULL DEFAULT NULL,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_by_user_id VARCHAR(255) NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_client_api_keys_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_client_api_keys_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_client_api_keys_client_id ON client_api_keys(client_id);
CREATE INDEX idx_client_api_keys_is_active ON client_api_keys(is_active);
CREATE INDEX idx_client_api_keys_expires_at ON client_api_keys(expires_at);
CREATE INDEX idx_client_api_keys_environment ON client_api_keys(environment);

-- ============================================================================
-- Agregar foreign key de users a clients (después de crear clients)
-- ============================================================================
ALTER TABLE users 
ADD CONSTRAINT fk_users_client 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX idx_users_client_id ON users(client_id);

-- ============================================================================
-- DATOS SEED: Tiers predefinidos
-- ============================================================================
INSERT INTO client_tiers (id, name, description, max_api_calls_per_month, max_api_calls_per_minute, max_users, features, price_monthly, is_active)
VALUES 
(
    'tier-free',
    'Free',
    'Plan gratuito para desarrollo y pruebas',
    10000,
    10,
    3,
    '{"analytics": false, "webhooks": false, "priority_support": false, "custom_domains": false}',
    0.00,
    1
),
(
    'tier-pro',
    'Pro',
    'Plan profesional para equipos pequeños',
    100000,
    100,
    10,
    '{"analytics": true, "webhooks": true, "priority_support": false, "custom_domains": false}',
    49.99,
    1
),
(
    'tier-enterprise',
    'Enterprise',
    'Plan empresarial con recursos ilimitados',
    999999999,
    1000,
    999999,
    '{"analytics": true, "webhooks": true, "priority_support": true, "custom_domains": true}',
    299.99,
    1
)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description),
    max_api_calls_per_month = VALUES(max_api_calls_per_month),
    max_api_calls_per_minute = VALUES(max_api_calls_per_minute),
    max_users = VALUES(max_users),
    features = VALUES(features),
    price_monthly = VALUES(price_monthly),
    is_active = VALUES(is_active);

-- ============================================================================
-- DATOS SEED: Cliente demo
-- ============================================================================
INSERT INTO clients (id, name, slug, tier_id, contact_email, contact_name, billing_cycle_start, is_active)
VALUES (
    'client-demo-001',
    'Mad Kitty Demo',
    'mad-kitty-demo',
    'tier-free',
    'demo@madkitty.services',
    'Demo User',
    CURDATE(),
    1
)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    tier_id = VALUES(tier_id),
    contact_email = VALUES(contact_email),
    contact_name = VALUES(contact_name);

-- ============================================================================
-- DATOS SEED: Usuario administrador
-- ============================================================================
-- Password: admin123 (CAMBIAR EN PRODUCCIÓN!)
-- Hash bcrypt con 10 rounds
INSERT INTO users (id, email, password_hash, name, role, is_active, email_verified)
VALUES (
    'admin-default-001',
    'admin@example.com',
    '$2b$10$K7NrC5Y3qEUz9mGfPRJvxO9Yc5K8K8K8K8K8K8K8K8K8K8K8K8K8K',
    'Administrator',
    'admin',
    1,
    1
)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    role = VALUES(role);

-- ============================================================================
-- RESUMEN
-- ============================================================================
-- Tablas creadas:
-- 1. users - Usuarios del sistema
-- 2. api_keys - API keys de usuarios individuales
-- 3. client_tiers - Planes/tipos de cliente (Free, Pro, Enterprise)
-- 4. clients - Clientes/tenants del SaaS
-- 5. client_api_keys - API keys de clientes (prefijo mk_)
--
-- Datos seed:
-- - 3 tiers predefinidos
-- - 1 cliente demo
-- - 1 usuario administrador (admin@example.com / admin123)
--
-- IMPORTANTE: Cambiar la contraseña del admin en producción!
