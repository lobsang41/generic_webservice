# Paso 4 Completado: Validación de Permisos en Rutas

## ✅ Resumen de Cambios

Se ha aplicado el sistema de scopes granulares a todas las rutas del módulo de clientes SaaS, reemplazando la autorización basada en roles (`authorize('admin')`) por validación de scopes específicos.

---

## 📋 Rutas Actualizadas

### 1. **Rutas de Clientes** (`/api/v1/clients`)

| Método | Endpoint | Scope Requerido | Descripción |
|--------|----------|----------------|-------------|
| POST | `/clients` | `clients:write` | Crear nuevo cliente |
| GET | `/clients` | `clients:read` | Listar clientes |
| GET | `/clients/:id` | `clients:read` | Obtener cliente por ID |
| PATCH | `/clients/:id` | `clients:write` | Actualizar cliente |
| DELETE | `/clients/:id` | `clients:delete` O `clients:admin` | Desactivar cliente |
| GET | `/clients/:id/usage` | `usage:read` O `clients:admin` | Ver estadísticas de uso |
| POST | `/clients/:id/reset-usage` | `usage:write` O `clients:admin` | Resetear uso mensual |

### 2. **Rutas de Tiers** (`/api/v1/client-tiers`)

| Método | Endpoint | Scope Requerido | Descripción |
|--------|----------|----------------|-------------|
| POST | `/client-tiers` | `tiers:write` | Crear nuevo tier |
| GET | `/client-tiers` | **Público** | Listar tiers |
| GET | `/client-tiers/:id` | **Público** | Obtener tier por ID |
| PATCH | `/client-tiers/:id` | `tiers:write` | Actualizar tier |
| DELETE | `/client-tiers/:id` | `tiers:delete` O `tiers:admin` | Desactivar tier |

### 3. **Rutas de API Keys** (`/api/v1/clients/:clientId/api-keys`)

| Método | Endpoint | Scope Requerido | Descripción |
|--------|----------|----------------|-------------|
| POST | `/clients/:clientId/api-keys` | `api_keys:write` | Generar nueva API key |
| GET | `/clients/:clientId/api-keys/scopes` | `api_keys:read` | Listar scopes disponibles |
| GET | `/clients/:clientId/api-keys` | `api_keys:read` | Listar API keys del cliente |
| DELETE | `/clients/:clientId/api-keys/:keyId` | `api_keys:delete` O `api_keys:admin` | Revocar API key |

---

## 🔄 Cambios Técnicos

### Antes (Autorización por Rol):
```typescript
router.post('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    // Solo admins pueden acceder
}));
```

### Después (Autorización por Scope):
```typescript
router.post('/', 
    authenticate, 
    requireScope(SCOPES.CLIENTS_WRITE),
    asyncHandler(async (req, res) => {
        // Cualquier usuario con el scope clients:write puede acceder
    })
);
```

---

## 🎯 Beneficios

### 1. **Granularidad Mejorada**
- Antes: Solo `admin` o `user`
- Ahora: Permisos específicos por recurso y acción

### 2. **Flexibilidad**
- Las API Keys pueden tener permisos específicos
- Un cliente puede tener múltiples keys con diferentes niveles de acceso

### 3. **Seguridad**
- Principio de mínimo privilegio
- Cada key solo tiene los permisos necesarios

### 4. **Jerarquía de Permisos**
- `admin` > `delete` > `write` > `read`
- Tener un permiso superior incluye los inferiores

---

## 📊 Ejemplos de Uso

### Ejemplo 1: API Key de Solo Lectura
```typescript
// Crear key con scopes limitados
POST /api/v1/clients/client-123/api-keys
{
  "name": "Dashboard Read-Only",
  "scopes": [
    "clients:read",
    "tiers:read",
    "usage:read"
  ]
}

// Esta key puede:
// ✅ GET /clients
// ✅ GET /tiers
// ✅ GET /clients/:id/usage
// ❌ POST /clients (requiere clients:write)
// ❌ DELETE /clients/:id (requiere clients:delete)
```

### Ejemplo 2: API Key de Gestión Completa
```typescript
POST /api/v1/clients/client-123/api-keys
{
  "name": "Admin Key",
  "scopes": [
    "clients:admin",
    "api_keys:admin",
    "usage:write"
  ]
}

// Esta key puede:
// ✅ Todas las operaciones de clients (admin incluye read, write, delete)
// ✅ Todas las operaciones de api_keys
// ✅ Resetear uso mensual
```

### Ejemplo 3: Múltiples Scopes Requeridos
```typescript
// Endpoint que requiere al menos uno de varios scopes
router.delete('/:id', 
    authenticate,
    requireAnyScope([SCOPES.CLIENTS_DELETE, SCOPES.CLIENTS_ADMIN]),
    handler
);

// Acepta usuarios con:
// - clients:delete, O
// - clients:admin
```

---

## 🔍 Validación Automática

El sistema valida automáticamente:

1. **Formato de Scopes**: `resource:action`
2. **Recursos Válidos**: `clients`, `tiers`, `api_keys`, `users`, `usage`, etc.
3. **Acciones Válidas**: `read`, `write`, `delete`, `admin`
4. **Jerarquía**: Un scope superior incluye los inferiores

---

## 📝 Archivos Modificados

- ✅ `/src/services/api-gateway/routes/clients.ts`
- ✅ `/src/services/api-gateway/routes/client-tiers.ts`
- ✅ `/src/services/api-gateway/routes/client-api-keys.ts`

---

## 🚀 Próximos Pasos

### Paso 5: Tests Unitarios
- Tests para validación de scopes
- Tests para jerarquía de permisos
- Tests para middleware de validación
- Tests de integración para rutas protegidas

### Paso 6: Documentación de Permisos
- Tabla completa de endpoints y scopes requeridos
- Guía de mejores prácticas
- Ejemplos de configuración común

---

## ⚠️ Notas Importantes

1. **Rutas Públicas**: Los endpoints GET de tiers son públicos (no requieren autenticación)
2. **Compatibilidad**: El sistema mantiene compatibilidad con autenticación JWT y API Keys
3. **Logs**: Todos los intentos de acceso denegado se registran con detalles
4. **Errores**: Los errores de permisos retornan 403 Forbidden con mensaje descriptivo

---

## 📖 Documentación Relacionada

- [Sistema de Scopes](./SCOPES_SYSTEM.md) - Documentación completa del sistema
- [Middleware de Scopes](../src/shared/middleware/scopeValidator.ts) - Implementación
- [Definición de Scopes](../src/shared/auth/scopes.ts) - Scopes disponibles
