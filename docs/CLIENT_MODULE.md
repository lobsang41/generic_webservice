# Módulo Core de Clientes - Mad Kitty Services

## Resumen

Se ha implementado exitosamente el **módulo core de clientes** para el ecosistema Mad Kitty Services. Este módulo transforma el sistema en un SaaS multi-tenant con gestión de clientes, planes/tiers y control de acceso mediante API keys.

## Componentes Implementados

### 1. Base de Datos (MySQL)

**Migración**: `src/shared/database/migrations/002_clients_module.sql`

**Tablas creadas**:
- `client_tiers`: Planes/tipos de cliente (Free, Pro, Enterprise)
- `clients`: Clientes/tenants con tracking de uso mensual
- `client_api_keys`: API keys por cliente con permisos granulares
- Modificación a `users`: Agregada columna `client_id` para vincular usuarios a clientes

**Datos seed incluidos**:
- 3 tiers predefinidos: Free (10K calls/mes), Pro (100K calls/mes), Enterprise (ilimitado)
- 1 cliente demo: "Mad Kitty Demo" con tier Free

### 2. Servicios Backend

**Ubicación**: `src/shared/services/`

- **`clientService.ts`**: CRUD de clientes, estadísticas de uso, tracking mensual
- **`clientTierService.ts`**: Gestión de planes/tiers con validaciones
- **`clientApiKeyService.ts`**: Generación segura de API keys con prefijo `mk_`, validación y revocación

### 3. Middleware

**Ubicación**: `src/shared/middleware/`

- **`auth.ts`** (modificado): 
  - Agregado `authenticateClientAPIKey`: Autenticación con Client API Keys
  - Agregado `authenticateFlexible`: Soporte para JWT, User API Key o Client API Key
  - Extendido `Request` interface con `client` y `clientApiKey`

- **`clientRateLimiter.ts`** (nuevo):
  - Rate limiting por minuto basado en tier del cliente
  - Usa node-cache con TTL de 60 segundos
  - Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

- **`clientUsageTracker.ts`** (nuevo):
  - Tracking de uso mensual con verificación de límites
  - Incremento automático del contador `api_calls_current_month`
  - Headers: `X-Monthly-Limit`, `X-Monthly-Usage`, `X-Monthly-Remaining`

### 4. Rutas API

**Ubicación**: `src/services/api-gateway/routes/`

#### Clientes (`/api/v1/clients`) - Admin only
- `POST /` - Crear cliente
- `GET /` - Listar clientes (paginado, filtros)
- `GET /:id` - Obtener cliente
- `PATCH /:id` - Actualizar cliente
- `DELETE /:id` - Desactivar cliente
- `GET /:id/usage` - Estadísticas de uso
- `POST /:id/reset-usage` - Resetear uso mensual

#### Tiers (`/api/v1/client-tiers`)
- `POST /` - Crear tier (admin)
- `GET /` - Listar tiers (público)
- `GET /:id` - Obtener tier (público)
- `PATCH /:id` - Actualizar tier (admin)
- `DELETE /:id` - Desactivar tier (admin)

#### API Keys (`/api/v1/clients/:clientId/api-keys`)
- `POST /` - Generar API key (admin o usuario del cliente)
- `GET /` - Listar API keys (admin o usuario del cliente)
- `DELETE /:keyId` - Revocar API key (admin o usuario del cliente)

## Configuración

### Alias de Módulos

Actualizado `tsconfig.json` y `package.json`:
```json
"@services/*": ["src/shared/services/*"]
```

### Script de Migración

**Archivo**: `scripts/migrate-clients.sh`

```bash
chmod +x scripts/migrate-clients.sh
./scripts/migrate-clients.sh
```

El script:
- Lee configuración de `.env`
- Ejecuta la migración SQL
- Muestra resumen de tablas y datos creados

## Uso del Módulo

### 1. Ejecutar la Migración

```bash
./scripts/migrate-clients.sh
```

### 2. Iniciar el Servidor

```bash
npm run dev
```

### 3. Crear un Cliente (como admin)

```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp",
    "tier_id": "tier-pro",
    "contact_email": "contact@acme.com",
    "contact_name": "John Doe"
  }'
```

### 4. Generar API Key para el Cliente

```bash
curl -X POST http://localhost:3000/api/v1/clients/<CLIENT_ID>/api-keys \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "environment": "production"
  }'
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "key": "mk_a1b2c3d4e5f6...",
    "apiKey": {
      "id": "...",
      "name": "Production Key",
      "environment": "production",
      "expires_at": null,
      "created_at": "2025-12-30T..."
    }
  },
  "message": "API key created successfully. Save it securely - it will not be shown again."
}
```

### 5. Usar la API Key del Cliente

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "X-API-Key: mk_a1b2c3d4e5f6..."
```

El middleware automáticamente:
- Valida la API key
- Carga información del cliente y tier en `req.client`
- Aplica rate limiting según el tier (ej: 100 req/min para Pro)
- Trackea el uso mensual
- Agrega headers informativos

## Características del Sistema

### Rate Limiting Inteligente

- **Por minuto**: Basado en `max_api_calls_per_minute` del tier
- **Por mes**: Basado en `max_api_calls_per_month` del tier
- **Headers informativos**: El cliente siempre sabe su estado de uso

### Seguridad

- API keys hasheadas con SHA-256
- Prefijo `mk_` para identificación
- Expiración configurable
- Revocación instantánea
- Permisos granulares por key

### Multi-Tenancy

- Clientes aislados con sus propios límites
- Usuarios vinculados a clientes
- Tracking de uso independiente
- Planes flexibles y escalables

## Próximos Pasos

### Verificación (Pendiente)

- [ ] Crear tests unitarios para servicios
- [ ] Crear tests de integración para endpoints
- [ ] Probar rate limiting con diferentes tiers
- [ ] Documentar API con Swagger/OpenAPI

### Mejoras Futuras

- [ ] Dashboard de uso para clientes
- [ ] Webhooks para notificaciones de límites
- [ ] Billing automático basado en uso
- [ ] Analytics avanzados por cliente
- [ ] Soporte para custom domains

## Archivos Modificados/Creados

### Base de Datos
- ✅ `src/shared/database/migrations/002_clients_module.sql`

### Servicios
- ✅ `src/shared/services/clientService.ts`
- ✅ `src/shared/services/clientTierService.ts`
- ✅ `src/shared/services/clientApiKeyService.ts`

### Middleware
- ✅ `src/shared/middleware/auth.ts` (modificado)
- ✅ `src/shared/middleware/clientRateLimiter.ts`
- ✅ `src/shared/middleware/clientUsageTracker.ts`

### Rutas
- ✅ `src/services/api-gateway/routes/clients.ts`
- ✅ `src/services/api-gateway/routes/client-tiers.ts`
- ✅ `src/services/api-gateway/routes/client-api-keys.ts`
- ✅ `src/services/api-gateway/routes/index.ts` (modificado)

### Configuración
- ✅ `tsconfig.json` (modificado)
- ✅ `package.json` (modificado)

### Scripts
- ✅ `scripts/migrate-clients.sh`

## Conclusión

El módulo core de clientes está **completamente implementado y listo para usar**. Solo falta ejecutar la migración de base de datos y el sistema estará operativo como un SaaS multi-tenant completo.
