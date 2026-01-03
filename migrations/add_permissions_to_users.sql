-- ============================================================================
-- MIGRACIÓN URGENTE: Agregar soporte de scopes a usuarios
-- ============================================================================

-- Paso 1: Agregar columna permissions
ALTER TABLE users 
ADD COLUMN permissions JSON NULL COMMENT 'User permissions and scopes' 
AFTER role;

-- Paso 2: Actualizar usuario admin existente (si existe)
UPDATE users 
SET permissions = NULL 
WHERE role = 'admin';
-- Los admin no necesitan permissions, obtienen todos los scopes automáticamente

-- Paso 3: Ejemplo - Dar scopes de lectura a un usuario específico
-- Descomenta y modifica según necesites:
/*
UPDATE users 
SET permissions = JSON_OBJECT('scopes', JSON_ARRAY(
    'clients:read',
    'tiers:read',
    'api_keys:read',
    'users:read',
    'usage:read'
))
WHERE email = 'user@example.com';
*/

-- Verificar cambios
SELECT id, email, name, role, permissions 
FROM users 
ORDER BY created_at DESC;
