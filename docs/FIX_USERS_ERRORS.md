# Fix: Errores en Gestión de Usuarios

## 🐛 Problemas Encontrados

### Error 1: `Unknown column 'permissions' in 'field list'`
**Causa**: La tabla `users` no tiene la columna `permissions`

### Error 2: `Unknown column 'password' in 'field list'`
**Causa**: La tabla usa `password_hash` no `password`

---

## ✅ Soluciones Aplicadas

### 1. **Corregido nombre de columna de password**
```typescript
// ❌ Antes:
INSERT INTO users (id, email, password, ...)

// ✅ Ahora:
INSERT INTO users (id, email, password_hash, ...)
```

### 2. **Removido temporalmente permissions de queries**
```typescript
// Comentado hasta ejecutar migración:
// - INSERT con permissions
// - SELECT con permissions  
// - UPDATE de scopes
```

### 3. **Creada migración SQL**
Archivo: `/migrations/add_permissions_to_users.sql`

```sql
ALTER TABLE users 
ADD COLUMN permissions JSON NULL 
AFTER role;
```

---

## 🚀 Pasos para Completar la Implementación

### Paso 1: Ejecutar Migración

Ejecuta este comando en tu base de datos MySQL:

```bash
# Opción 1: Desde terminal
mysql -u root -p generic_webservice < migrations/add_permissions_to_users.sql

# Opción 2: Desde MySQL Workbench o similar
# Abre el archivo migrations/add_permissions_to_users.sql y ejecútalo
```

O manualmente:

```sql
USE generic_webservice;

ALTER TABLE users 
ADD COLUMN permissions JSON NULL COMMENT 'User permissions and scopes in JSON format'
AFTER role;
```

### Paso 2: Descomentar Código de Scopes

Una vez ejecutada la migración, descomentar en `/src/services/api-gateway/routes/users.ts`:

#### En la función POST (crear usuario):
```typescript
// Líneas 57-61: Cambiar a:
await mysqlDB.query(
    `INSERT INTO users (id, email, password_hash, name, role, permissions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [userId, email, hashedPassword, name || email.split('@')[0], role, permissions]
);

// Línea 66: Cambiar a:
'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
```

#### En la función GET (listar):
```typescript
// Línea 85: Cambiar a:
`SELECT id, email, name, role, permissions, created_at
 FROM users
 ORDER BY created_at DESC
 LIMIT ? OFFSET ?`,
```

#### En la función GET by ID:
```typescript
// Línea 119: Cambiar a:
'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
```

#### En la función PATCH (actualizar):
```typescript
// Líneas 153-166: Descomentar el bloque:
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

// Línea 180: Cambiar a:
'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
```

---

## 🧪 Probar Ahora (Sin Scopes)

Mientras tanto, puedes probar la creación de usuarios **sin scopes**:

### 1. Login
```
Email: admin@example.com
Password: admin123
```

### 2. Crear Usuario
```
Email: test@example.com
Password: test123
Nombre: Test User
Rol: Usuario Normal
```

**Nota**: Los scopes no se guardarán hasta ejecutar la migración, pero el usuario se creará correctamente.

---

## 📊 Estado Actual

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Login | ✅ Funciona | |
| Crear usuario | ✅ Funciona | Sin scopes |
| Listar usuarios | ✅ Funciona | Sin scopes |
| Actualizar usuario | ✅ Funciona | Solo nombre |
| Eliminar usuario | ✅ Funciona | |
| Asignar scopes | ⏳ Pendiente | Requiere migración |
| Scopes automáticos admin | ✅ Funciona | |

---

## 🔄 Después de la Migración

Una vez ejecutada la migración y descomentado el código:

| Funcionalidad | Estado |
|---------------|--------|
| Crear usuario con scopes | ✅ |
| Ver scopes de usuarios | ✅ |
| Actualizar scopes | ✅ |
| Sistema completo | ✅ |

---

## 📝 Comandos Útiles

### Verificar si existe la columna:
```sql
DESCRIBE users;
```

### Ver usuarios actuales:
```sql
SELECT id, email, name, role FROM users;
```

### Agregar scopes a usuario existente (después de migración):
```sql
UPDATE users 
SET permissions = JSON_OBJECT('scopes', JSON_ARRAY('clients:read', 'tiers:read'))
WHERE email = 'user@example.com';
```

---

## ✅ Resumen

**Problema**: Tabla `users` no tenía columna `permissions` y usaba `password_hash` no `password`

**Solución Temporal**: Código ajustado para funcionar sin scopes

**Solución Permanente**: Ejecutar migración SQL para agregar columna `permissions`

**Estado**: ✅ Sistema funcional (sin scopes hasta migración)
