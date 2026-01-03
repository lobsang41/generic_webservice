# 🚨 SOLUCIÓN URGENTE: Habilitar Scopes en Usuarios

## ⚠️ Problema Actual

1. **Usuario normal no puede listar usuarios**: Necesita scope `users:read`
2. **Columna `permissions` no existe**: La tabla `users` no tiene donde guardar los scopes

---

## ✅ Solución en 3 Pasos

### Paso 1: Ejecutar Migración SQL

#### Opción A: Usando MySQL Workbench o similar
1. Abre tu cliente MySQL
2. Conecta a la base de datos `generic_webservice`
3. Ejecuta este SQL:

```sql
ALTER TABLE users 
ADD COLUMN permissions JSON NULL COMMENT 'User permissions and scopes' 
AFTER role;
```

#### Opción B: Desde terminal (si tienes mysql CLI)
```bash
cd /Volumes/Mac_Externo/GitHub_ext/generic_webservice

# Dar permisos de ejecución al script
chmod +x migrations/run_migration.sh

# Ejecutar migración
./migrations/run_migration.sh
```

#### Opción C: Manual desde terminal
```bash
mysql -u root -p123456 generic_webservice -e "ALTER TABLE users ADD COLUMN permissions JSON NULL AFTER role;"
```

---

### Paso 2: Dar Scopes al Usuario Normal

Después de ejecutar la migración, actualiza el usuario:

```sql
-- Ver usuarios actuales
SELECT id, email, name, role, permissions FROM users;

-- Dar scopes de lectura al usuario 'example'
UPDATE users 
SET permissions = JSON_OBJECT('scopes', JSON_ARRAY(
    'users:read',
    'clients:read',
    'tiers:read',
    'api_keys:read',
    'usage:read'
))
WHERE email = 'example';  -- Cambia por el email real
```

---

### Paso 3: Descomentar Código en users.ts

Una vez ejecutada la migración, necesitas descomentar el código de scopes:

#### En `/src/services/api-gateway/routes/users.ts`:

1. **Línea 5** - Descomentar import:
```typescript
import { SCOPES, validateScopes } from '@auth/scopes';
```

2. **Línea 13** - Descomentar parámetro:
```typescript
const { email, password, name, role = 'user', scopes } = req.body;
```

3. **Líneas 33-43** - Descomentar validación:
```typescript
let permissions = null;
if (scopes && Array.isArray(scopes) && scopes.length > 0) {
    const validation = validateScopes(scopes);
    if (!validation.valid) {
        throw new ValidationError(`Invalid scopes: ${validation.invalid.join(', ')}`);
    }
    permissions = JSON.stringify({ scopes });
}
```

4. **Líneas 59-61** - Cambiar INSERT:
```typescript
await mysqlDB.query(
    `INSERT INTO users (id, email, password_hash, name, role, permissions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [userId, email, hashedPassword, name || email.split('@')[0], role, permissions]
);
```

5. **Línea 66** - Cambiar SELECT:
```typescript
'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
```

6. **Línea 89** - Cambiar SELECT en GET all:
```typescript
`SELECT id, email, name, role, permissions, created_at
 FROM users
 ORDER BY created_at DESC
 LIMIT ? OFFSET ?`,
```

7. **Línea 122** - Cambiar SELECT en GET by ID:
```typescript
'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
```

8. **Línea 142** - Descomentar parámetro:
```typescript
const { name, scopes } = req.body;
```

9. **Líneas 156-169** - Descomentar bloque de update scopes:
```typescript
if (scopes && req.user!.role === 'admin') {
    if (!Array.isArray(scopes)) {
        throw new ValidationError('Scopes must be an array');
    }

    const validation = validateScopes(scopes);
    if (!validation.valid) {
        throw new ValidationError(`Invalid scopes: ${validation.invalid.join(', ')}`);
    }

    updates.push('permissions = ?');
    values.push(JSON.stringify({ scopes }));
}
```

10. **Línea 183** - Cambiar SELECT:
```typescript
'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
```

---

## 🧪 Probar

### 1. Login con usuario normal:
```
Email: example
Password: (tu password)
```

### 2. Intentar listar usuarios:
- Ir a pestaña "Usuarios"
- Click en "Cargar Usuarios"
- ✅ Debería funcionar ahora

### 3. Crear nuevo usuario con scopes:
```
Email: developer@example.com
Password: dev123
Nombre: Developer
Rol: Usuario Normal
Scopes: [seleccionar los que necesite]
```

---

## 📊 Verificar en Base de Datos

```sql
-- Ver usuarios con sus scopes
SELECT 
    id,
    email,
    name,
    role,
    permissions,
    created_at
FROM users
ORDER BY created_at DESC;

-- Ver scopes de un usuario específico
SELECT 
    email,
    role,
    JSON_EXTRACT(permissions, '$.scopes') as scopes
FROM users
WHERE email = 'example';
```

---

## ⚡ Resumen Rápido

```bash
# 1. Ejecutar migración
mysql -u root -p123456 generic_webservice -e "ALTER TABLE users ADD COLUMN permissions JSON NULL AFTER role;"

# 2. Dar scopes al usuario
mysql -u root -p123456 generic_webservice -e "UPDATE users SET permissions = JSON_OBJECT('scopes', JSON_ARRAY('users:read', 'clients:read')) WHERE email = 'example';"

# 3. Descomentar código en users.ts (manual)

# 4. Reiniciar servidor (automático con npm run dev)
```

---

## ✅ Checklist

- [ ] Ejecutar migración SQL
- [ ] Dar scopes al usuario normal
- [ ] Descomentar código en users.ts
- [ ] Verificar que servidor reinició
- [ ] Probar login con usuario normal
- [ ] Verificar que puede listar usuarios

---

¡Después de estos pasos todo debería funcionar! 🚀
