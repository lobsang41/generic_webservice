# 🔔 Sistema de Webhooks - Notificaciones de Cuota de Uso

Sistema completo de webhooks para notificar automáticamente a los clientes cuando alcancen umbrales de uso (80% y 100%) de su cuota mensual.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Configuración](#configuración)
- [API Endpoints](#api-endpoints)
- [Eventos de Webhook](#eventos-de-webhook)
- [Seguridad](#seguridad)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## ✨ Características

### Funcionalidades Principales

- ✅ **Notificaciones Automáticas**: Webhooks disparados al alcanzar 80% y 100% de uso
- ✅ **Reintentos con Backoff Exponencial**: 3 intentos con delays de 1s, 5s, 15s
- ✅ **Firma HMAC-SHA256**: Seguridad y verificación de autenticidad
- ✅ **Cola de Procesamiento**: Envío asíncrono sin bloquear requests
- ✅ **Logging Completo**: Registro de todas las entregas (éxito/fallo)
- ✅ **Validación de URLs**: Solo HTTPS en producción
- ✅ **Prevención de Duplicados**: No envía múltiples notificaciones por ciclo
- ✅ **Custom Headers**: Soporte para headers personalizados

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE WEBHOOKS                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Cliente hace API call                                   │
│  2. Sistema incrementa contador de uso                      │
│  3. usageWebhookMonitor verifica thresholds                 │
│  4. Si alcanzó 80% o 100% → Encola webhook                 │
│  5. webhookQueue procesa cola                               │
│  6. Firma payload con HMAC-SHA256                           │
│  7. Envía POST al webhook del cliente                       │
│  8. Registra resultado en webhook_deliveries                │
│  9. Si falla → Programa reintento con backoff              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Componentes

1. **webhookService.ts**: Gestión de configuraciones y entregas
2. **webhookQueue.ts**: Cola de procesamiento con reintentos
3. **webhookSigner.ts**: Firma HMAC-SHA256 para seguridad
4. **usageWebhookMonitor.ts**: Middleware que monitorea uso
5. **webhook.schemas.ts**: Validación Zod de datos

---

## ⚙️ Configuración

### 1. Ejecutar Migración de Base de Datos

```sql
source src/shared/database/migrations/003_webhook_system.sql
```

Esto crea 3 tablas:
- `webhook_configs`: Configuración de webhooks por cliente
- `webhook_deliveries`: Log de entregas
- `usage_notifications`: Prevención de duplicados

### 2. Configurar Webhook para un Cliente

```bash
POST /api/v1/webhooks
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "client_id": "client-123",
  "url": "https://your-app.com/webhooks/usage",
  "events": ["usage.threshold.80", "usage.threshold.100"],
  "custom_headers": {
    "X-Custom-Header": "value"
  },
  "timeout_ms": 5000
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "webhook": {
      "id": "webhook-xyz",
      "client_id": "client-123",
      "url": "https://your-app.com/webhooks/usage",
      "secret": "***HIDDEN***",
      "enabled": true,
      "events": ["usage.threshold.80", "usage.threshold.100"],
      "timeout_ms": 5000
    }
  }
}
```

### 3. Obtener el Secret

El secret se genera automáticamente y **solo se muestra una vez** al crear el webhook. Si lo pierdes, puedes regenerarlo:

```bash
POST /api/v1/webhooks/{webhook_id}/regenerate-secret
```

---

## 🔌 API Endpoints

### Gestión de Webhooks

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/webhooks` | Crear webhook |
| `GET` | `/api/v1/webhooks` | Listar webhooks del cliente |
| `GET` | `/api/v1/webhooks/:id` | Obtener webhook por ID |
| `PATCH` | `/api/v1/webhooks/:id` | Actualizar webhook |
| `DELETE` | `/api/v1/webhooks/:id` | Eliminar webhook |
| `POST` | `/api/v1/webhooks/:id/regenerate-secret` | Regenerar secret |

### Entregas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/webhooks/deliveries/list` | Listar entregas |
| `GET` | `/api/v1/webhooks/deliveries/:id` | Obtener entrega por ID |

### Testing

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/webhooks/test` | Enviar webhook de prueba |

---

## 📨 Eventos de Webhook

### `usage.threshold.80`

Disparado cuando el cliente alcanza el 80% de su cuota mensual.

**Payload:**
```json
{
  "event": "usage.threshold.80",
  "client_id": "client-123",
  "threshold": 80,
  "timestamp": "2026-01-09T20:00:00.000Z",
  "data": {
    "current_usage": 8000,
    "limit": 10000,
    "percentage": 80.0,
    "billing_cycle_start": "2026-01-01"
  }
}
```

### `usage.threshold.100`

Disparado cuando el cliente alcanza el 100% de su cuota mensual.

**Payload:**
```json
{
  "event": "usage.threshold.100",
  "client_id": "client-123",
  "threshold": 100,
  "timestamp": "2026-01-09T20:30:00.000Z",
  "data": {
    "current_usage": 10000,
    "limit": 10000,
    "percentage": 100.0,
    "billing_cycle_start": "2026-01-01"
  }
}
```

### `usage.quota.exceeded`

Disparado cuando el cliente excede su cuota mensual.

**Payload:**
```json
{
  "event": "usage.quota.exceeded",
  "client_id": "client-123",
  "timestamp": "2026-01-09T20:35:00.000Z",
  "data": {
    "current_usage": 10500,
    "limit": 10000,
    "overage": 500,
    "billing_cycle_start": "2026-01-01"
  }
}
```

---

## 🔐 Seguridad

### Verificación de Firma HMAC-SHA256

Todos los webhooks incluyen headers de firma para verificar autenticidad:

```
X-Webhook-Timestamp: 1704835200000
X-Webhook-Signature: a1b2c3d4e5f6...
X-Webhook-Signature-Version: v1
```

### Verificar Firma (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, timestamp, signature, secret) {
  // Recrear el signed payload
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  
  // Generar HMAC
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  // Comparación segura
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Uso en tu endpoint
app.post('/webhooks/usage', (req, res) => {
  const payload = req.body;
  const timestamp = req.headers['x-webhook-timestamp'];
  const signature = req.headers['x-webhook-signature'];
  const secret = 'your-webhook-secret';
  
  if (!verifyWebhook(payload, timestamp, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Procesar webhook
  console.log('Webhook válido:', payload);
  res.json({ received: true });
});
```

### Verificar Firma (Python)

```python
import hmac
import hashlib
import json

def verify_webhook(payload, timestamp, signature, secret):
    # Recrear el signed payload
    signed_payload = f"{timestamp}.{json.dumps(payload)}"
    
    # Generar HMAC
    expected_signature = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Comparación segura
    return hmac.compare_digest(signature, expected_signature)
```

---

## 🧪 Testing

### 1. Enviar Webhook de Prueba

```bash
POST /api/v1/webhooks/test
Content-Type: application/json

{
  "url": "https://webhook.site/your-unique-url",
  "payload": {
    "test": true,
    "message": "This is a test webhook"
  }
}
```

### 2. Usar webhook.site

1. Ve a https://webhook.site
2. Copia tu URL única
3. Úsala en el test endpoint
4. Verifica que recibes el webhook con la firma correcta

### 3. Testing Local con ngrok

```bash
# 1. Instalar ngrok
npm install -g ngrok

# 2. Exponer tu servidor local
ngrok http 3000

# 3. Usar la URL de ngrok en tu webhook
https://abc123.ngrok.io/webhooks/usage
```

---

## 🔧 Troubleshooting

### Webhook no se dispara

**Verificar:**
1. ✅ Webhook está habilitado: `GET /api/v1/webhooks/:id`
2. ✅ Eventos correctos configurados
3. ✅ Cliente alcanzó el threshold
4. ✅ No se notificó previamente en este ciclo

**Logs:**
```bash
# Ver logs del servidor
grep "usage threshold" logs/app.log
grep "Webhook enqueued" logs/app.log
```

### Webhook falla constantemente

**Verificar:**
1. ✅ URL es accesible desde el servidor
2. ✅ Endpoint responde en < 5 segundos
3. ✅ Endpoint acepta POST con JSON
4. ✅ Firewall permite conexiones salientes

**Ver entregas fallidas:**
```bash
GET /api/v1/webhooks/deliveries/list?status=failed
```

### Signature inválida

**Verificar:**
1. ✅ Usando el secret correcto
2. ✅ Timestamp dentro de 5 minutos
3. ✅ Payload exacto (sin modificar)
4. ✅ Algoritmo HMAC-SHA256

---

## 📊 Monitoreo

### Métricas Importantes

```bash
# Estado de la cola
GET /api/v1/jobs/status

# Entregas recientes
GET /api/v1/webhooks/deliveries/list?limit=50

# Tasa de éxito
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM webhook_deliveries
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY status;
```

### Alertas Recomendadas

- ⚠️ Tasa de fallos > 10%
- ⚠️ Cola > 100 webhooks pendientes
- ⚠️ Tiempo de entrega > 10 segundos

---

## 🚀 Mejoras Futuras

- [ ] Soporte para múltiples URLs por cliente
- [ ] Webhooks para otros eventos (API key creada, tier cambiado, etc.)
- [ ] Dashboard de métricas de webhooks
- [ ] Rate limiting por webhook
- [ ] Batch webhooks (agrupar múltiples eventos)
- [ ] Webhook playground para testing
- [ ] Integración con servicios de terceros (Zapier, IFTTT)

---

## 📚 Referencias

- [Webhook Best Practices](https://webhooks.fyi/)
- [HMAC Authentication](https://en.wikipedia.org/wiki/HMAC)
- [Stripe Webhooks](https://stripe.com/docs/webhooks) (inspiración)

---

**¿Necesitas ayuda?** Consulta los logs o contacta al equipo de desarrollo.
