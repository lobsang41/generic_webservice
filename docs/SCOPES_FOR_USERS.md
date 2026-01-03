# Scopes para Usuarios JWT

## 🔐 Sistema de Permisos para Usuarios

El sistema de scopes funciona de manera diferente para **usuarios autenticados con JWT** vs **API Keys**.

---

## 👥 Asignación Automática de Scopes

### 1. **Usuarios Admin** (rol: `admin`)

Los usuarios con rol `admin` obtienen **automáticamente TODOS los scopes** al autenticarse:

```typescript
// En authenticateJWT middleware
if (payload.role === 'admin') {
    req.scopes = [...SCOPE_GROUPS.SUPER_ADMIN];  // Todos los scopes
    req.userId = payload.userId;
}
```

**Scopes asignados automáticamente:**
```javascript
[
  "clients:read", "clients:write", "clients:delete", "clients:admin",
  "tiers:read", "tiers:write", "tiers:delete", "tiers:admin",
  "api_keys:read", "api_keys:write", "api_keys:delete", "api_keys:admin",
  "users:read", "users:write", "users:delete", "users:admin",
  "usage:read", "usage:write", "usage:admin",
  "webhooks:read", "webhooks:write", "webhooks:delete", "webhooks:admin",
  "analytics:read", "analytics:write", "analytics:admin"
]
```

### 2. **Usuarios Regulares** (rol: `user`)

Los usuarios regulares obtienen scopes desde su campo `permissions`:

```typescript
if (payload.permissions) {
    req.scopes = parseScopes(payload.permissions);
    req.userId = payload.userId;
}
```

**Ejemplo de usuario con permisos:**
```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "role": "user",
  "permissions": {
    "scopes": ["clients:read", "usage:read"]
  }
}
```

### 3. **Usuarios sin Permisos**

Usuarios sin campo `permissions` obtienen array vacío:

```typescript
else {
    req.scopes = [];
    req.userId = payload.userId;
}
```

---

## 🔑 Comparación: JWT vs API Keys

| Aspecto | JWT (Usuarios) | API Keys |
|---------|---------------|----------|
| **Admin** | Todos los scopes automáticamente | Scopes definidos al crear |
| **User** | Scopes desde `permissions` | Scopes definidos al crear |
| **Sin permisos** | Array vacío `[]` | Array vacío `[]` |
| **Modificación** | Editar usuario en DB | Regenerar API key |

---

## 📝 Cómo Dar Scopes a un Usuario Regular

### Opción 1: Directamente en la Base de Datos

```sql
-- Actualizar permisos de un usuario
UPDATE users 
SET permissions = JSON_OBJECT('scopes', JSON_ARRAY(
    'clients:read',
    'tiers:read',
    'usage:read'
))
WHERE id = 'user-123';
```

### Opción 2: Mediante Endpoint (Futuro)

```typescript
// POST /api/v1/users/:userId/permissions
{
  "scopes": [
    "clients:read",
    "tiers:read",
    "usage:read"
  ]
}
```

---

## 🎯 Flujo de Autenticación con Scopes

### Para Usuarios Admin:

```
1. Usuario hace login
   ↓
2. Recibe JWT con role: "admin"
   ↓
3. Hace request con JWT
   ↓
4. authenticateJWT verifica token
   ↓
5. Detecta role === "admin"
   ↓
6. Asigna req.scopes = SUPER_ADMIN (todos)
   ↓
7. requireScope valida permisos
   ↓
8. ✅ Acceso permitido
```

### Para Usuarios Regulares:

```
1. Usuario hace login
   ↓
2. Recibe JWT con role: "user"
   ↓
3. Hace request con JWT
   ↓
4. authenticateJWT verifica token
   ↓
5. Lee payload.permissions
   ↓
6. Asigna req.scopes = parseScopes(permissions)
   ↓
7. requireScope valida permisos
   ↓
8. ✅/❌ Según scopes asignados
```

---

## 🛠️ Ejemplos Prácticos

### Ejemplo 1: Admin Accediendo a Clientes

```javascript
// Request
GET /api/v1/clients
Headers: {
  Authorization: "Bearer eyJhbGc..." // JWT de admin
}

// Middleware chain
authenticate → authenticateJWT
  → payload.role === "admin"
  → req.scopes = [todos los scopes]
  → requireScope(SCOPES.CLIENTS_READ)
  → hasPermission(req.scopes, "clients:read")
  → ✅ true (admin tiene todos)
  → Endpoint ejecuta
```

### Ejemplo 2: Usuario Regular con Permisos

```javascript
// Usuario en DB
{
  "id": "user-123",
  "role": "user",
  "permissions": {
    "scopes": ["clients:read", "usage:read"]
  }
}

// Request
GET /api/v1/clients
Headers: {
  Authorization: "Bearer eyJhbGc..." // JWT del usuario
}

// Middleware chain
authenticate → authenticateJWT
  → payload.permissions existe
  → req.scopes = ["clients:read", "usage:read"]
  → requireScope(SCOPES.CLIENTS_READ)
  → hasPermission(req.scopes, "clients:read")
  → ✅ true
  → Endpoint ejecuta
```

### Ejemplo 3: Usuario sin Permisos

```javascript
// Usuario en DB
{
  "id": "user-456",
  "role": "user",
  "permissions": null  // Sin permisos
}

// Request
GET /api/v1/clients
Headers: {
  Authorization: "Bearer eyJhbGc..."
}

// Middleware chain
authenticate → authenticateJWT
  → payload.permissions es null
  → req.scopes = []
  → requireScope(SCOPES.CLIENTS_READ)
  → hasPermission([], "clients:read")
  → ❌ false
  → Error 403: Insufficient permissions
```

---

## 🔧 Código Implementado

### En `auth.ts`:

```typescript
export const authenticateJWT = async (req, res, next) => {
    try {
        const payload = jwtService.verifyAccessToken(token);
        req.user = { ...payload, authType: 'jwt' };
        
        // 🆕 Auto-assign scopes based on role
        if (payload.role === 'admin') {
            // Admins get all scopes
            req.scopes = [...SCOPE_GROUPS.SUPER_ADMIN];
            req.userId = payload.userId;
        } else if (payload.permissions) {
            // Regular users get scopes from permissions
            req.scopes = parseScopes(payload.permissions);
            req.userId = payload.userId;
        } else {
            // No permissions = empty scopes
            req.scopes = [];
            req.userId = payload.userId;
        }
        
        next();
    } catch (error) {
        next(new AuthenticationError('Authentication failed'));
    }
};
```

---

## 📊 Tabla de Permisos por Rol

| Rol | Scopes Automáticos | Puede Tener Scopes Custom | Modificable |
|-----|-------------------|---------------------------|-------------|
| `admin` | ✅ Todos (SUPER_ADMIN) | ❌ No (siempre todos) | ❌ No |
| `user` | ❌ Ninguno | ✅ Sí (desde `permissions`) | ✅ Sí |

---

## ⚠️ Consideraciones Importantes

### 1. **Admins Siempre Tienen Acceso Total**
```typescript
// Esto SIEMPRE será true para admins
if (req.user.role === 'admin') {
    // Tiene TODOS los scopes
}
```

### 2. **Usuarios Regulares Necesitan Permisos Explícitos**
```sql
-- Sin esto, el usuario no puede hacer nada
UPDATE users 
SET permissions = JSON_OBJECT('scopes', JSON_ARRAY('clients:read'))
WHERE id = 'user-123';
```

### 3. **Los Scopes se Cargan en Cada Request**
- No se cachean
- Se leen del JWT cada vez
- Para admins, siempre son todos

### 4. **Jerarquía de Permisos se Respeta**
```typescript
// Si un usuario tiene "clients:admin"
req.scopes = ["clients:admin"];

// Puede acceder a:
requireScope("clients:read")   // ✅ admin > read
requireScope("clients:write")  // ✅ admin > write
requireScope("clients:delete") // ✅ admin > delete
requireScope("clients:admin")  // ✅ exact match
```

---

## 🚀 Próximos Pasos

### Para Gestión Completa de Permisos de Usuarios:

1. **Crear endpoint para asignar scopes**:
   ```typescript
   POST /api/v1/users/:userId/scopes
   PATCH /api/v1/users/:userId/scopes
   DELETE /api/v1/users/:userId/scopes
   ```

2. **Agregar UI en el dashboard**:
   - Selector de scopes para usuarios
   - Vista de permisos actuales
   - Grupos predefinidos para usuarios

3. **Auditoría de cambios**:
   - Log cuando se modifican permisos
   - Historial de cambios de scopes

---

## ✅ Resumen

- ✅ **Admins**: Obtienen TODOS los scopes automáticamente
- ✅ **Users**: Obtienen scopes desde campo `permissions` en DB
- ✅ **Sin permisos**: Array vacío, sin acceso
- ✅ **Jerarquía**: Se respeta (admin > delete > write > read)
- ✅ **Validación**: Automática en cada request

**Ahora los usuarios admin pueden acceder a todos los endpoints protegidos con scopes!** 🎉
