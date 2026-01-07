# IP Whitelisting System

## Introducción

Sistema de restricción de acceso basado en direcciones IP permitidas por cliente, con soporte para rangos CIDR y gestión dinámica vía API.

---

## 🏗️ Arquitectura

### Componentes

1. **Base de Datos**: Tabla `client_ip_whitelist` con soporte para IPs individuales y rangos CIDR
2. **Utilidades**: Funciones para validar y verificar IPs usando `ipaddr.js`
3. **Servicio**: `ipWhitelistService` con caché en memoria
4. **Middleware**: Validación automática de IP en requests
5. **API**: Endpoints para gestionar IPs permitidas

---

## 📊 Modelo de Datos

### Tabla `client_ip_whitelist`

```sql
CREATE TABLE client_ip_whitelist (
    id VARCHAR(21) PRIMARY KEY,
    client_id VARCHAR(21) NOT NULL,
    ip_address VARCHAR(45),            -- IPv4 o IPv6 individual
    cidr_range VARCHAR(50),            -- Rango CIDR
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
```

**Características**:
- Al menos uno de `ip_address` o `cidr_range` debe estar presente
- Soft delete con `is_active`
- Cascade delete cuando se elimina el cliente

---

## 🔧 Uso

### API de Gestión

#### Agregar IP Permitida

```bash
POST /api/v1/clients/:clientId/ip-whitelist
Authorization: Bearer YOUR_JWT
Content-Type: application/json

{
  "ip_address": "192.168.1.100",  // O usar cidr_range
  "description": "Office network"
}
```

#### Agregar Rango CIDR

```bash
POST /api/v1/clients/:clientId/ip-whitelist

{
  "cidr_range": "192.168.1.0/24",
  "description": "Entire office subnet"
}
```

#### Listar IPs

```bash
GET /api/v1/clients/:clientId/ip-whitelist
```

#### Eliminar IP

```bash
DELETE /api/v1/clients/:clientId/ip-whitelist/:id
```

---

### Middleware de Validación

#### Uso Básico

```typescript
import { validateIPWhitelist } from '@middleware/ipWhitelist';

router.get('/protected',
    authenticate,
    validateIPWhitelist,  // Valida IP del cliente
    handler
);
```

#### Modo Estricto (Fail-Closed)

```typescript
import { validateIPWhitelistStrict } from '@middleware/ipWhitelist';

router.post('/sensitive',
    authenticate,
    validateIPWhitelistStrict,  // Niega acceso en caso de error
    handler
);
```

---

## 🌐 Formato CIDR

### Ejemplos de Rangos CIDR

| CIDR | Rango | IPs Totales |
|------|-------|-------------|
| `192.168.1.0/32` | Una sola IP | 1 |
| `192.168.1.0/24` | 192.168.1.0 - 192.168.1.255 | 256 |
| `10.0.0.0/16` | 10.0.0.0 - 10.0.255.255 | 65,536 |
| `10.0.0.0/8` | 10.0.0.0 - 10.255.255.255 | 16,777,216 |

### Calculadora CIDR

Puedes usar herramientas online como:
- https://www.ipaddressguide.com/cidr
- https://cidr.xyz/

---

## ⚙️ Configuración

### Variables de Entorno

```env
# IP Whitelisting
IP_WHITELIST_ENABLED=true                # Habilitar/deshabilitar sistema
IP_WHITELIST_BYPASS_LOCALHOST=true      # Bypass para localhost en dev
IP_WHITELIST_CACHE_TTL=300              # TTL del caché (segundos)
```

### Comportamiento

- **Enabled**: Si está deshabilitado, el middleware no hace nada
- **Bypass Localhost**: En desarrollo, permite acceso desde 127.0.0.1 y ::1
- **Cache**: Las IPs se cachean en memoria por 5 minutos (configurable)

---

## 🔍 Logging

### Accesos Bloqueados

Cuando se bloquea un acceso, se registra en los logs:

```json
{
  "level": "warn",
  "message": "IP whitelist: Access denied",
  "clientId": "client-123",
  "ip": "203.0.113.50",
  "path": "/api/v1/protected",
  "method": "GET",
  "userAgent": "..."
}
```

### Accesos Permitidos

En modo debug:

```json
{
  "level": "debug",
  "message": "IP whitelist: Access granted",
  "clientId": "client-123",
  "ip": "192.168.1.100"
}
```

---

## 🛡️ Seguridad

### Mejores Prácticas

1. **Usar CIDR para rangos**: En lugar de agregar IPs individuales, usa rangos CIDR
2. **Revisar periódicamente**: Elimina IPs que ya no se usan
3. **Documentar entradas**: Usa el campo `description` para saber qué es cada IP
4. **Modo estricto para operaciones sensibles**: Usa `validateIPWhitelistStrict`

### Consideraciones

- **Proxies/Load Balancers**: El sistema lee `x-forwarded-for` correctamente
- **IPv6**: Totalmente soportado
- **Fail-Open vs Fail-Closed**: 
  - `validateIPWhitelist`: Permite acceso si hay error (fail-open)
  - `validateIPWhitelistStrict`: Niega acceso si hay error (fail-closed)

---

## 🧪 Testing

### Probar Validación de IP

```typescript
import { isValidIP, isValidCIDR, ipInRange } from '@utils/ipUtils';

// Validar IP
console.log(isValidIP('192.168.1.1'));  // true
console.log(isValidIP('invalid'));      // false

// Validar CIDR
console.log(isValidCIDR('192.168.1.0/24'));  // true
console.log(isValidCIDR('192.168.1.0'));     // false

// Verificar IP en rango
console.log(ipInRange('192.168.1.100', '192.168.1.0/24'));  // true
console.log(ipInRange('192.168.2.100', '192.168.1.0/24'));  // false
```

### Probar API

```bash
# 1. Agregar IP
curl -X POST http://localhost:3000/api/v1/clients/CLIENT_ID/ip-whitelist \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cidr_range": "192.168.1.0/24", "description": "Office"}'

# 2. Listar IPs
curl http://localhost:3000/api/v1/clients/CLIENT_ID/ip-whitelist \
  -H "Authorization: Bearer TOKEN"

# 3. Probar acceso desde IP permitida
curl http://localhost:3000/api/v1/protected \
  -H "X-API-Key: CLIENT_KEY" \
  -H "X-Forwarded-For: 192.168.1.100"

# 4. Probar acceso desde IP no permitida (debe fallar con 403)
curl http://localhost:3000/api/v1/protected \
  -H "X-API-Key: CLIENT_KEY" \
  -H "X-Forwarded-For: 203.0.113.50"
```

---

## 🔧 Troubleshooting

### IP Bloqueada Incorrectamente

1. Verificar que la IP esté en la whitelist:
   ```bash
   GET /api/v1/clients/:clientId/ip-whitelist
   ```

2. Verificar que `is_active = true`

3. Verificar logs para ver qué IP se está detectando:
   ```bash
   grep "IP whitelist" logs/app.log
   ```

4. Limpiar caché:
   ```typescript
   ipWhitelistService.clearCache(clientId);
   ```

### CIDR No Funciona

1. Verificar formato: Debe ser `IP/PREFIX` (ej: `192.168.1.0/24`)
2. Usar calculadora CIDR para verificar el rango
3. Asegurarse de que la IP base sea la correcta (no una IP del rango)

### Bypass en Producción

Si necesitas bypass temporal en producción:

```env
IP_WHITELIST_ENABLED=false
```

O agregar `0.0.0.0/0` (permitir todas las IPs) - **NO RECOMENDADO**

---

## 📚 Referencias

- Utilidades: `src/shared/utils/ipUtils.ts`
- Servicio: `src/shared/services/ipWhitelistService.ts`
- Middleware: `src/shared/middleware/ipWhitelist.ts`
- API: `src/services/api-gateway/routes/ip-whitelist.ts`
- Migración: `migrations/005_create_ip_whitelist.sql`
