# Guía de Pruebas en Postman - Mad Kitty Services

## 🚀 Configuración Inicial

**Base URL**: `http://localhost:3000/api/v1`

### Variables de Entorno en Postman

Crea un Environment en Postman con estas variables:

```
base_url = http://localhost:3000/api/v1
admin_token = (se llenará después del login)
client_id = (se llenará después de crear un cliente)
client_api_key = (se llenará después de generar la API key)
```

---

## 📝 Paso 1: Login como Administrador

### Request
```
POST {{base_url}}/auth/login
```

### Headers
```
Content-Type: application/json
```

### Body (JSON)
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "admin-default-001",
      "email": "admin@example.com",
      "name": "Administrator",
      "role": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### ⚠️ Acción
Copia el `accessToken` y guárdalo en la variable `admin_token` de tu Environment.

---

## 📋 Paso 2: Listar Tiers Disponibles

### Request
```
GET {{base_url}}/client-tiers
```

### Headers
```
(No requiere autenticación - endpoint público)
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "tiers": [
      {
        "id": "tier-free",
        "name": "Free",
        "description": "Plan gratuito para desarrollo y pruebas",
        "max_api_calls_per_month": 10000,
        "max_api_calls_per_minute": 10,
        "max_users": 3,
        "features": {
          "analytics": false,
          "webhooks": false,
          "priority_support": false,
          "custom_domains": false
        },
        "price_monthly": 0.00,
        "is_active": 1
      },
      {
        "id": "tier-pro",
        "name": "Pro",
        "max_api_calls_per_month": 100000,
        "max_api_calls_per_minute": 100,
        "price_monthly": 49.99
      },
      {
        "id": "tier-enterprise",
        "name": "Enterprise",
        "max_api_calls_per_month": 999999999,
        "max_api_calls_per_minute": 1000,
        "price_monthly": 299.99
      }
    ]
  }
}
```

---

## 🏢 Paso 3: Crear un Cliente

### Request
```
POST {{base_url}}/clients
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {{admin_token}}
```

### Body (JSON)
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "tier_id": "tier-pro",
  "contact_email": "contact@acme.com",
  "contact_name": "John Doe",
  "metadata": {
    "industry": "Technology",
    "company_size": "50-100"
  }
}
```

### Response Esperada (201 Created)
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "abc123xyz",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "tier_id": "tier-pro",
      "contact_email": "contact@acme.com",
      "contact_name": "John Doe",
      "api_calls_current_month": 0,
      "is_active": 1,
      "metadata": {
        "industry": "Technology",
        "company_size": "50-100"
      },
      "billing_cycle_start": "2025-12-30",
      "created_at": "2025-12-30T21:30:00.000Z"
    }
  }
}
```

### ⚠️ Acción
Copia el `id` del cliente y guárdalo en la variable `client_id`.

---

## 🔑 Paso 4: Generar API Key para el Cliente

### Request
```
POST {{base_url}}/clients/{{client_id}}/api-keys
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {{admin_token}}
```

### Body (JSON)
```json
{
  "name": "Production API Key",
  "environment": "production",
  "expires_in_days": 365
}
```

### Response Esperada (201 Created)
```json
{
  "success": true,
  "data": {
    "key": "mk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "apiKey": {
      "id": "key-abc123",
      "name": "Production API Key",
      "environment": "production",
      "expires_at": "2026-12-30T21:30:00.000Z",
      "created_at": "2025-12-30T21:30:00.000Z"
    }
  },
  "message": "API key created successfully. Save it securely - it will not be shown again."
}
```

### ⚠️ Acción
**¡MUY IMPORTANTE!** Copia el `key` (que empieza con `mk_`) y guárdalo en la variable `client_api_key`. Esta es la única vez que verás la key completa.

---

## 🧪 Paso 5: Probar Autenticación con Client API Key

### Request
```
GET {{base_url}}/auth/me
```

### Headers
```
X-API-Key: {{client_api_key}}
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "abc123xyz",
      "email": "contact@acme.com",
      "role": "client",
      "permissions": [],
      "authType": "clientApiKey"
    }
  }
}
```

### 📊 Headers de Respuesta
Verifica estos headers en la respuesta:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 60
X-Monthly-Limit: 100000
X-Monthly-Usage: 1
X-Monthly-Remaining: 99999
```

---

## 📊 Paso 6: Ver Estadísticas de Uso del Cliente

### Request
```
GET {{base_url}}/clients/{{client_id}}/usage
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "abc123xyz",
      "name": "Acme Corporation",
      "tier_id": "tier-pro",
      "api_calls_current_month": 1
    },
    "tier": {
      "id": "tier-pro",
      "name": "Pro",
      "max_api_calls_per_month": 100000,
      "max_api_calls_per_minute": 100
    },
    "usage": {
      "current_month_calls": 1,
      "limit_month_calls": 100000,
      "percentage_used": 0.001,
      "remaining_calls": 99999
    }
  }
}
```

---

## 🔄 Paso 7: Listar API Keys del Cliente

### Request
```
GET {{base_url}}/clients/{{client_id}}/api-keys
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "apiKeys": [
      {
        "id": "key-abc123",
        "name": "Production API Key",
        "environment": "production",
        "permissions": null,
        "last_used_at": "2025-12-30T21:35:00.000Z",
        "expires_at": "2026-12-30T21:30:00.000Z",
        "is_active": 1,
        "created_at": "2025-12-30T21:30:00.000Z"
      }
    ]
  }
}
```

---

## 🚫 Paso 8: Probar Rate Limiting

Haz **15 requests rápidas** al mismo endpoint con la Client API Key:

### Request (repetir 15 veces)
```
GET {{base_url}}/auth/me
```

### Headers
```
X-API-Key: {{client_api_key}}
```

### Resultado Esperado

**Requests 1-100**: ✅ 200 OK (tier Pro permite 100/min)

**Request 101**: ❌ 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "message": "Rate limit exceeded. Your plan allows 100 requests per minute. Please upgrade or wait.",
    "statusCode": 429
  }
}
```

---

## 📝 Paso 9: Actualizar Cliente

### Request
```
PATCH {{base_url}}/clients/{{client_id}}
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {{admin_token}}
```

### Body (JSON)
```json
{
  "tier_id": "tier-enterprise",
  "metadata": {
    "industry": "Technology",
    "company_size": "100-500",
    "upgraded_at": "2025-12-30"
  }
}
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "abc123xyz",
      "tier_id": "tier-enterprise",
      "metadata": {
        "industry": "Technology",
        "company_size": "100-500",
        "upgraded_at": "2025-12-30"
      }
    }
  }
}
```

---

## 🔄 Paso 10: Resetear Uso Mensual

### Request
```
POST {{base_url}}/clients/{{client_id}}/reset-usage
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "message": "Monthly usage reset successfully"
}
```

---

## 🗑️ Paso 11: Revocar API Key

### Request
```
DELETE {{base_url}}/clients/{{client_id}}/api-keys/key-abc123
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Response Esperada (200 OK)
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## 📋 Endpoints Adicionales

### Listar Todos los Clientes
```
GET {{base_url}}/clients?page=1&limit=10&is_active=true
Authorization: Bearer {{admin_token}}
```

### Obtener un Cliente Específico
```
GET {{base_url}}/clients/{{client_id}}
Authorization: Bearer {{admin_token}}
```

### Desactivar un Cliente
```
DELETE {{base_url}}/clients/{{client_id}}
Authorization: Bearer {{admin_token}}
```

### Crear un Tier Personalizado
```
POST {{base_url}}/client-tiers
Authorization: Bearer {{admin_token}}

Body:
{
  "id": "tier-custom",
  "name": "Custom Plan",
  "max_api_calls_per_month": 50000,
  "max_api_calls_per_minute": 50,
  "max_users": 5,
  "price_monthly": 29.99
}
```

---

## 🎯 Resumen de Flujo Completo

1. ✅ Login como admin → Obtener token
2. ✅ Ver tiers disponibles
3. ✅ Crear un cliente con tier Pro
4. ✅ Generar API key para el cliente (prefijo `mk_`)
5. ✅ Probar autenticación con la API key
6. ✅ Verificar headers de rate limiting y uso mensual
7. ✅ Ver estadísticas de uso
8. ✅ Probar límite de rate (100 req/min para Pro)
9. ✅ Actualizar tier del cliente
10. ✅ Resetear uso mensual
11. ✅ Revocar API key

---

## 🔍 Verificaciones Importantes

### Headers de Rate Limiting
Cada respuesta con Client API Key debe incluir:
- `X-RateLimit-Limit`: Límite por minuto según tier
- `X-RateLimit-Remaining`: Requests restantes este minuto
- `X-RateLimit-Reset`: Segundos hasta reset (60)

### Headers de Uso Mensual
- `X-Monthly-Limit`: Límite mensual según tier
- `X-Monthly-Usage`: Llamadas usadas este mes
- `X-Monthly-Remaining`: Llamadas restantes este mes

### Errores Comunes

**401 Unauthorized**
- Token JWT expirado o inválido
- API key inválida o revocada

**403 Forbidden**
- Usuario no tiene permisos (no es admin)
- Usuario no pertenece al cliente

**429 Too Many Requests**
- Excedido límite por minuto
- Excedido límite mensual

---

## 💡 Tips para Postman

1. **Usa Variables**: Configura `{{base_url}}`, `{{admin_token}}`, `{{client_id}}`, `{{client_api_key}}`
2. **Tests Automáticos**: Agrega scripts para guardar tokens automáticamente
3. **Collection Runner**: Ejecuta toda la secuencia de pruebas
4. **Monitor**: Configura monitoreo para verificar que el API esté funcionando

### Script de Test Automático (en Postman)
```javascript
// Guardar token después del login
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("admin_token", response.data.accessToken);
}

// Guardar client_id después de crear cliente
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("client_id", response.data.client.id);
}

// Guardar API key
if (pm.response.code === 201 && response.data.key) {
    pm.environment.set("client_api_key", response.data.key);
}
```

---

¡Listo! Ahora tienes una guía completa para probar todo el módulo de clientes en Postman. 🎉
