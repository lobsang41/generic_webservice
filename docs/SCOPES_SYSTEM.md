# Sistema de Scopes Granulares - API Keys

## 📋 Resumen

El sistema de scopes granulares permite controlar de forma precisa qué acciones puede realizar cada API Key en el sistema. Implementa una jerarquía de permisos basada en recursos y acciones.

## 🎯 Estructura de Scopes

### Formato
Cada scope sigue el formato: `resource:action`

**Ejemplos:**
- `clients:read` - Leer información de clientes
- `api_keys:write` - Crear/modificar API keys
- `users:admin` - Administración completa de usuarios

### Recursos Disponibles
- `clients` - Clientes/tenants del SaaS
- `tiers` - Planes de servicio
- `api_keys` - API Keys de clientes
- `users` - Usuarios del sistema
- `usage` - Estadísticas de uso
- `webhooks` - Webhooks de notificación
- `analytics` - Analíticas y reportes

### Acciones Disponibles
- `read` - Lectura de recursos
- `write` - Creación y modificación
- `delete` - Eliminación de recursos
- `admin` - Control administrativo completo

## 🔐 Jerarquía de Permisos

El sistema implementa una jerarquía donde permisos superiores incluyen los inferiores:

```
admin > delete > write > read
```

**Ejemplo:**
- Si tienes `clients:admin`, automáticamente tienes `clients:delete`, `clients:write` y `clients:read`
- Si tienes `clients:write`, automáticamente tienes `clients:read`

## 📦 Grupos de Scopes Predefinidos

### READONLY
Acceso de solo lectura a recursos básicos:
```typescript
[
  'clients:read',
  'tiers:read',
  'usage:read',
  'analytics:read'
]
```

### DEVELOPER
Acceso completo para desarrollo:
```typescript
[
  'clients:read',
  'clients:write',
  'tiers:read',
  'api_keys:read',
  'api_keys:write',
  'usage:read',
  'webhooks:read',
  'webhooks:write'
]
```

### ADMIN
Control administrativo (sin eliminación):
```typescript
[
  'clients:read',
  'clients:write',
  'clients:admin',
  'tiers:read',
  'tiers:write',
  'api_keys:read',
  'api_keys:write',
  'api_keys:delete',
  'users:read',
  'users:write',
  'usage:read',
  'usage:write',
  'webhooks:read',
  'webhooks:write',
  'webhooks:delete',
  'analytics:read'
]
```

### SUPER_ADMIN
Control total sin restricciones (todos los scopes disponibles)

## 🛠️ Uso en el Código

### 1. Proteger Rutas con Scopes

```typescript
import { requireScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';

// Requiere un scope específico
router.get('/clients', 
  authenticate, 
  requireScope(SCOPES.CLIENTS_READ), 
  listClients
);

// Requiere al menos uno de varios scopes
router.get('/data', 
  authenticate,
  requireAnyScope([SCOPES.CLIENTS_READ, SCOPES.CLIENTS_ADMIN]),
  getData
);

// Requiere todos los scopes especificados
router.delete('/clients/:id',
  authenticate,
  requireAllScopes([SCOPES.CLIENTS_DELETE, SCOPES.CLIENTS_ADMIN]),
  deleteClient
);
```

### 2. Verificar Scopes en Handlers

```typescript
import { checkScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';

async function getClientData(req: Request, res: Response) {
  const client = await getClient(req.params.id);
  
  // Datos básicos para todos
  const response = {
    id: client.id,
    name: client.name
  };
  
  // Datos adicionales solo para admins
  if (checkScope(req, SCOPES.CLIENTS_ADMIN)) {
    response.sensitiveData = client.metadata;
  }
  
  res.json(response);
}
```

### 3. Crear API Keys con Scopes

```typescript
import { SCOPES, SCOPE_GROUPS, scopesToJSON } from '@auth/scopes';

// API Key con scopes específicos
const apiKey = await clientAPIKeyService.createAPIKey({
  clientId: 'client-123',
  name: 'Production Key',
  environment: 'production',
  permissions: scopesToJSON([
    SCOPES.CLIENTS_READ,
    SCOPES.USAGE_READ,
    SCOPES.WEBHOOKS_WRITE
  ])
});

// API Key con grupo predefinido
const devKey = await clientAPIKeyService.createAPIKey({
  clientId: 'client-123',
  name: 'Development Key',
  environment: 'development',
  permissions: scopesToJSON(SCOPE_GROUPS.DEVELOPER)
});
```

## 📊 Estructura en Base de Datos

Los scopes se almacenan en formato JSON en las tablas:
- `api_keys.permissions`
- `client_api_keys.permissions`

**Formato:**
```json
{
  "scopes": [
    "clients:read",
    "clients:write",
    "usage:read"
  ]
}
```

## 🔍 Validación

El sistema valida automáticamente:
- ✅ Formato correcto de scopes (`resource:action`)
- ✅ Recursos y acciones válidos
- ✅ Jerarquía de permisos
- ✅ Scopes requeridos vs disponibles

## 📝 Ejemplos de Uso Completo

### Ejemplo 1: API Key de Solo Lectura

```typescript
// Crear key
const readOnlyKey = await clientAPIKeyService.createAPIKey({
  clientId: 'client-abc',
  name: 'Analytics Dashboard',
  environment: 'production',
  permissions: scopesToJSON(SCOPE_GROUPS.READONLY)
});

// Esta key puede:
// ✅ GET /clients
// ✅ GET /tiers
// ✅ GET /usage
// ❌ POST /clients (requiere clients:write)
// ❌ DELETE /clients/:id (requiere clients:delete)
```

### Ejemplo 2: API Key de Desarrollo

```typescript
// Crear key
const devKey = await clientAPIKeyService.createAPIKey({
  clientId: 'client-xyz',
  name: 'Development Environment',
  environment: 'development',
  permissions: scopesToJSON(SCOPE_GROUPS.DEVELOPER)
});

// Esta key puede:
// ✅ GET /clients
// ✅ POST /clients
// ✅ PATCH /clients/:id
// ✅ POST /api-keys
// ✅ POST /webhooks
// ❌ DELETE /clients/:id (no tiene clients:delete)
```

### Ejemplo 3: Scopes Personalizados

```typescript
// Key personalizada para un caso de uso específico
const customKey = await clientAPIKeyService.createAPIKey({
  clientId: 'client-123',
  name: 'Webhook Manager',
  environment: 'production',
  permissions: scopesToJSON([
    SCOPES.WEBHOOKS_READ,
    SCOPES.WEBHOOKS_WRITE,
    SCOPES.WEBHOOKS_DELETE,
    SCOPES.USAGE_READ  // Para ver estadísticas
  ])
});
```

## 🚀 Próximos Pasos

1. ✅ **Paso 1**: Diseño de esquema - COMPLETADO
2. ✅ **Paso 2**: Middleware de validación - COMPLETADO
3. 🔄 **Paso 3**: Endpoints de gestión de scopes
4. 🔄 **Paso 4**: Aplicar scopes a rutas existentes
5. 🔄 **Paso 5**: Tests unitarios
6. 🔄 **Paso 6**: Documentación de permisos por endpoint

## 📚 Referencias

- **Archivo de Scopes**: `src/shared/auth/scopes.ts`
- **Middleware**: `src/shared/middleware/scopeValidator.ts`
- **Autenticación**: `src/shared/middleware/auth.ts`
- **Error Handling**: `src/shared/middleware/errorHandler.ts`
