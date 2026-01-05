-- ============================================================================
-- Migración 002: Índices Compuestos para Optimización
-- ============================================================================
-- Descripción: Agrega índices compuestos estratégicos para mejorar el
--              rendimiento de queries frecuentes identificadas en el análisis.
--
-- Impacto esperado:
-- - Reducción 30-50% en tiempo de queries de listado
-- - Eliminación de filesort en queries paginadas
-- - Mejora en validación de API keys
--
-- Rollback: DROP INDEX para cada índice creado
-- ============================================================================

-- ============================================================================
-- TABLA: users
-- ============================================================================

-- Índice compuesto para login (email + is_active)
-- Mejora: Q1 (login) - evita escaneo adicional de is_active
CREATE INDEX idx_users_email_active 
ON users(email, is_active);

-- Índice compuesto para listado paginado (is_active + created_at DESC)
-- Mejora: Q2 (listar usuarios) - elimina filesort
CREATE INDEX idx_users_active_created 
ON users(is_active, created_at DESC);

-- Índice compuesto para búsqueda por rol activo
-- Mejora: Queries de admin que filtran por rol y estado
CREATE INDEX idx_users_role_active 
ON users(role, is_active);

-- ============================================================================
-- TABLA: api_keys
-- ============================================================================

-- Índice compuesto para validación de keys (user_id + is_active + expires_at)
-- Mejora: Q3 (validar API key) - cubre todas las condiciones WHERE
CREATE INDEX idx_api_keys_user_active_expires 
ON api_keys(user_id, is_active, expires_at);

-- Índice compuesto para búsqueda de keys activas
-- Mejora: Listado de keys activas sin expirar
CREATE INDEX idx_api_keys_active_expires 
ON api_keys(is_active, expires_at);

-- ============================================================================
-- TABLA: clients
-- ============================================================================

-- Índice compuesto para listado por tier (tier_id + is_active + created_at)
-- Mejora: Q4 (listar clientes por tier) - optimiza JOIN y ORDER BY
CREATE INDEX idx_clients_tier_active_created 
ON clients(tier_id, is_active, created_at DESC);

-- Índice compuesto para listado general (is_active + created_at)
-- Mejora: Q8 (listar clientes) - elimina filesort
CREATE INDEX idx_clients_active_created 
ON clients(is_active, created_at DESC);

-- Índice compuesto para búsqueda por slug activo
-- Mejora: Q10 (buscar por slug) - cubre ambas condiciones
CREATE INDEX idx_clients_slug_active 
ON clients(slug, is_active);

-- ============================================================================
-- TABLA: client_api_keys
-- ============================================================================

-- Índice compuesto para validación completa
-- Mejora: Q5 (validar client API key) - cubre todas las condiciones
CREATE INDEX idx_client_keys_validation 
ON client_api_keys(client_id, is_active, environment, expires_at);

-- Índice compuesto para búsqueda por ambiente
-- Mejora: Listado de keys por ambiente
CREATE INDEX idx_client_keys_env_active 
ON client_api_keys(environment, is_active);

-- Índice compuesto para búsqueda de keys próximas a expirar
-- Mejora: Jobs de mantenimiento
CREATE INDEX idx_client_keys_active_expires 
ON client_api_keys(is_active, expires_at);

-- ============================================================================
-- VERIFICACIÓN DE ÍNDICES CREADOS
-- ============================================================================

-- Verificar índices en users
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND INDEX_NAME LIKE 'idx_users_%'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Verificar índices en api_keys
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'api_keys'
  AND INDEX_NAME LIKE 'idx_api_keys_%'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Verificar índices en clients
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'clients'
  AND INDEX_NAME LIKE 'idx_clients_%'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Verificar índices en client_api_keys
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'client_api_keys'
  AND INDEX_NAME LIKE 'idx_client_keys_%'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- ============================================================================
-- ESTADÍSTICAS POST-MIGRACIÓN
-- ============================================================================

-- NOTA: Esta query requiere permisos especiales en servidores compartidos
-- Si tienes acceso, puedes descomentar para ver el tamaño de índices

/*
-- Tamaño de índices por tabla
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    ROUND(STAT_VALUE * @@innodb_page_size / 1024 / 1024, 2) AS 'Index Size (MB)'
FROM mysql.innodb_index_stats
WHERE DATABASE_NAME = DATABASE()
  AND TABLE_NAME IN ('users', 'api_keys', 'clients', 'client_api_keys')
  AND STAT_NAME = 'size'
ORDER BY TABLE_NAME, INDEX_NAME;
*/

-- ============================================================================
-- ROLLBACK (Si es necesario)
-- ============================================================================
/*
-- users
DROP INDEX idx_users_email_active ON users;
DROP INDEX idx_users_active_created ON users;
DROP INDEX idx_users_role_active ON users;

-- api_keys
DROP INDEX idx_api_keys_user_active_expires ON api_keys;
DROP INDEX idx_api_keys_active_expires ON api_keys;

-- clients
DROP INDEX idx_clients_tier_active_created ON clients;
DROP INDEX idx_clients_active_created ON clients;
DROP INDEX idx_clients_slug_active ON clients;

-- client_api_keys
DROP INDEX idx_client_keys_validation ON client_api_keys;
DROP INDEX idx_client_keys_env_active ON client_api_keys;
DROP INDEX idx_client_keys_active_expires ON client_api_keys;
*/

-- ============================================================================
-- NOTAS
-- ============================================================================
-- 
-- 1. Los índices compuestos deben ejecutarse en orden de selectividad:
--    - Columnas más selectivas primero (email, slug, user_id, client_id)
--    - Columnas de filtro después (is_active, environment)
--    - Columnas de ordenamiento al final (created_at, expires_at)
--
-- 2. MySQL puede usar índices descendentes (DESC) en versiones 8.0+
--    Para versiones anteriores, el DESC se ignora pero el índice sigue siendo útil
--
-- 3. Monitorear uso de índices después de la migración:
--    - Ejecutar EXPLAIN en queries críticas
--    - Verificar que no haya "Using filesort"
--    - Confirmar que type sea "ref" o "range" en lugar de "ALL"
--
-- 4. Espacio adicional estimado: 10-15% del tamaño actual de cada tabla
--
-- ============================================================================
