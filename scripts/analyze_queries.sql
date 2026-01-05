-- ============================================================================
-- Análisis de Queries Críticas con EXPLAIN
-- ============================================================================
-- Este script ejecuta EXPLAIN en las queries más frecuentes del sistema
-- para identificar oportunidades de optimización.
-- 
-- Uso: Ejecutar en MySQL y documentar los resultados
-- ============================================================================

-- ============================================================================
-- Q1: Login con verificación de permisos
-- ============================================================================
-- Usado en: /auth/login
-- Frecuencia: Alta (cada login)
-- Importancia: Crítica (afecta experiencia de usuario)

EXPLAIN SELECT id, email, password_hash, name, role, permissions 
FROM users 
WHERE email = 'admin@example.com' AND is_active = 1;

-- Resultado esperado:
-- - type: ref (usando idx_users_email)
-- - rows: 1
-- - Extra: Using where

-- ============================================================================
-- Q2: Listar usuarios activos con paginación
-- ============================================================================
-- Usado en: GET /users
-- Frecuencia: Media
-- Importancia: Alta

EXPLAIN SELECT id, email, name, role, permissions, created_at
FROM users 
WHERE is_active = 1 
ORDER BY created_at DESC 
LIMIT 10 OFFSET 0;

-- Resultado esperado:
-- - type: ref (usando idx_users_is_active)
-- - rows: depende de datos
-- - Extra: Using where; Using filesort (PROBLEMA - necesita índice compuesto)

-- ============================================================================
-- Q3: Buscar API keys activas de un usuario
-- ============================================================================
-- Usado en: Validación de API keys
-- Frecuencia: Muy alta (cada request con API key)
-- Importancia: Crítica

EXPLAIN SELECT * FROM api_keys 
WHERE user_id = 'admin-default-001' 
  AND is_active = 1 
  AND (expires_at IS NULL OR expires_at > NOW());

-- Resultado esperado:
-- - type: ref (usando idx_api_keys_user_id)
-- - Extra: Using where (PROBLEMA - necesita índice compuesto)

-- ============================================================================
-- Q4: Listar clientes por tier
-- ============================================================================
-- Usado en: GET /clients
-- Frecuencia: Media
-- Importancia: Media

EXPLAIN SELECT c.*, t.name as tier_name 
FROM clients c 
JOIN client_tiers t ON c.tier_id = t.id 
WHERE c.is_active = 1;

-- Resultado esperado:
-- - type: ref en ambas tablas
-- - Extra: Using where

-- ============================================================================
-- Q5: Buscar client API keys activas por ambiente
-- ============================================================================
-- Usado en: Validación de client API keys
-- Frecuencia: Muy alta
-- Importancia: Crítica

EXPLAIN SELECT * FROM client_api_keys 
WHERE client_id = 'client-demo-001' 
  AND is_active = 1 
  AND environment = 'production'
  AND (expires_at IS NULL OR expires_at > NOW());

-- Resultado esperado:
-- - type: ref (usando idx_client_api_keys_client_id)
-- - Extra: Using where (PROBLEMA - necesita índice compuesto)

-- ============================================================================
-- Q6: Búsqueda de usuario por email (sin is_active)
-- ============================================================================
-- Usado en: Registro, recuperación de contraseña
-- Frecuencia: Media
-- Importancia: Alta

EXPLAIN SELECT id, email, name, role 
FROM users 
WHERE email = 'test@example.com';

-- Resultado esperado:
-- - type: ref (usando idx_users_email o UNIQUE key)
-- - rows: 1

-- ============================================================================
-- Q7: Contar usuarios activos
-- ============================================================================
-- Usado en: Dashboard, estadísticas
-- Frecuencia: Baja
-- Importancia: Baja

EXPLAIN SELECT COUNT(*) as total 
FROM users 
WHERE is_active = 1;

-- Resultado esperado:
-- - type: ref (usando idx_users_is_active)
-- - Extra: Using index (ideal)

-- ============================================================================
-- Q8: Listar clientes con paginación ordenados por fecha
-- ============================================================================
-- Usado en: GET /clients
-- Frecuencia: Media
-- Importancia: Media

EXPLAIN SELECT * FROM clients 
WHERE is_active = 1 
ORDER BY created_at DESC 
LIMIT 10 OFFSET 0;

-- Resultado esperado:
-- - type: ref (usando idx_clients_is_active)
-- - Extra: Using where; Using filesort (PROBLEMA - necesita índice compuesto)

-- ============================================================================
-- Q9: Buscar API keys próximas a expirar
-- ============================================================================
-- Usado en: Jobs de mantenimiento, notificaciones
-- Frecuencia: Baja (cron job)
-- Importancia: Media

EXPLAIN SELECT id, user_id, name, expires_at 
FROM api_keys 
WHERE is_active = 1 
  AND expires_at IS NOT NULL 
  AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY);

-- Resultado esperado:
-- - type: range (usando idx_api_keys_expires_at)
-- - Extra: Using where

-- ============================================================================
-- Q10: Buscar cliente por slug
-- ============================================================================
-- Usado en: Resolución de tenant por subdomain
-- Frecuencia: Alta
-- Importancia: Alta

EXPLAIN SELECT * FROM clients 
WHERE slug = 'mad-kitty-demo' 
  AND is_active = 1;

-- Resultado esperado:
-- - type: ref (usando idx_clients_slug o UNIQUE key)
-- - rows: 1

-- ============================================================================
-- ANÁLISIS DE ÍNDICES ACTUALES
-- ============================================================================

-- Ver todos los índices de la tabla users
SHOW INDEX FROM users;

-- Ver todos los índices de la tabla api_keys
SHOW INDEX FROM api_keys;

-- Ver todos los índices de la tabla clients
SHOW INDEX FROM clients;

-- Ver todos los índices de la tabla client_api_keys
SHOW INDEX FROM client_api_keys;

-- Ver todos los índices de la tabla client_tiers
SHOW INDEX FROM client_tiers;

-- ============================================================================
-- ESTADÍSTICAS DE TABLAS
-- ============================================================================

-- Tamaño de tablas
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    table_rows AS 'Rows'
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
  AND table_name IN ('users', 'api_keys', 'clients', 'client_api_keys', 'client_tiers')
ORDER BY (data_length + index_length) DESC;

-- ============================================================================
-- RESUMEN DE PROBLEMAS IDENTIFICADOS
-- ============================================================================
-- 
-- 1. Q2 (Listar usuarios): Using filesort
--    Solución: Índice compuesto (is_active, created_at DESC)
--
-- 2. Q3 (API keys activas): Múltiples condiciones WHERE sin índice compuesto
--    Solución: Índice compuesto (user_id, is_active, expires_at)
--
-- 3. Q5 (Client API keys): Múltiples condiciones WHERE sin índice compuesto
--    Solución: Índice compuesto (client_id, is_active, environment, expires_at)
--
-- 4. Q8 (Listar clientes): Using filesort
--    Solución: Índice compuesto (is_active, created_at DESC)
--
-- ============================================================================
