# Sistema de Cron Jobs - Documentación Completa

## 📋 Descripción General

Sistema automatizado de tareas programadas (cron jobs) para gestionar operaciones periódicas del sistema, incluyendo:

- **Reset Mensual de Cuotas**: Reinicia automáticamente los contadores de uso de API de todos los clientes activos el primer día de cada mes
- **Limpieza de Audit Logs**: Elimina automáticamente logs antiguos según la política de retención configurada
- **Sistema de Notificaciones**: Envía alertas sobre el estado de ejecución de los jobs

## 🏗️ Arquitectura

```
src/shared/jobs/
├── scheduler.ts              # Coordinador central de todos los jobs
├── monthlyResetJob.ts        # Job de reset mensual
├── auditCleanupJob.ts        # Job de limpieza de logs
├── notificationService.ts    # Servicio de notificaciones
└── index.ts                  # Exportaciones públicas
```

## 🚀 Características Implementadas

### ✅ Criterios de Aceptación Completados

- [x] **Configurar node-cron para scheduling**
  - Implementado con soporte para expresiones cron y timezones
  
- [x] **Implementar job de reset de cuotas mensuales**
  - Reset automático de `api_calls_current_month` para todos los clientes activos
  - Actualización de `billing_cycle_start`
  
- [x] **Sistema de logging para ejecuciones de jobs**
  - Logs estructurados con Winston
  - Registro de inicio, progreso y finalización
  - Métricas de duración y resultados
  
- [x] **Manejo de errores y reintentos**
  - Sistema de reintentos configurable por cliente
  - Exponential backoff entre reintentos
  - Captura y registro de errores individuales
  
- [x] **Notificaciones de éxito/fallo**
  - Soporte para webhooks (Slack, Discord, Teams)
  - Notificaciones por email (preparado para implementación)
  - Threshold configurable de fallos
  
- [x] **Configuración de timezone apropiado**
  - Soporte completo para timezones (ej: America/New_York)
  - Configuración por job individual

## ⚙️ Configuración

### Variables de Entorno

Agregar al archivo `.env`:

```bash
# Cron Jobs - Monthly Reset
MONTHLY_RESET_ENABLED=true                    # Habilitar/deshabilitar el job
MONTHLY_RESET_CRON=0 0 1 * *                  # Expresión cron (1er día del mes a medianoche)
MONTHLY_RESET_TIMEZONE=America/New_York       # Zona horaria
MONTHLY_RESET_RETRY_ATTEMPTS=3                # Número de reintentos
MONTHLY_RESET_RETRY_DELAY_MS=5000             # Delay entre reintentos (ms)

# Job Notifications
JOB_NOTIFICATIONS_ENABLED=true                # Habilitar notificaciones
JOB_NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
JOB_NOTIFICATION_EMAILS=admin@example.com,ops@example.com
JOB_NOTIFICATION_MIN_FAILURES=1               # Mínimo de fallos para alertar
```

### Expresiones Cron Comunes

```bash
# Cada día a medianoche
0 0 * * *

# Primer día del mes a medianoche
0 0 1 * *

# Cada lunes a las 3 AM
0 3 * * 1

# Cada 6 horas
0 */6 * * *

# Último día del mes a las 11:59 PM
59 23 L * *
```

## 📡 API Endpoints

Todos los endpoints requieren autenticación de **admin**.

### 1. Estado del Scheduler

```bash
GET /api/v1/jobs/status
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "scheduler": {
      "running": true,
      "jobs": [
        {
          "name": "monthly-reset",
          "enabled": true,
          "running": true,
          "lastExecution": "2026-01-01T05:00:00.000Z",
          "nextExecution": "2026-02-01T05:00:00.000Z",
          "config": {
            "cronExpression": "0 0 1 * *",
            "timezone": "America/New_York",
            "retryAttempts": 3
          }
        }
      ],
      "startedAt": "2026-01-09T20:00:00.000Z"
    },
    "health": {
      "healthy": true,
      "scheduler": {
        "running": true,
        "uptime": 3600000
      },
      "jobs": {
        "total": 2,
        "enabled": 2,
        "running": 2
      }
    }
  }
}
```

### 2. Información del Reset Mensual

```bash
GET /api/v1/jobs/monthly-reset
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "config": {
      "enabled": true,
      "cronExpression": "0 0 1 * *",
      "timezone": "America/New_York",
      "retryAttempts": 3,
      "retryDelayMs": 5000
    },
    "lastExecution": {
      "success": true,
      "timestamp": "2026-01-01T05:00:00.000Z",
      "totalClients": 50,
      "successCount": 50,
      "failureCount": 0,
      "errors": [],
      "duration": 2345
    }
  }
}
```

### 3. Ejecutar Reset Manual

```bash
POST /api/v1/jobs/monthly-reset/execute
Authorization: Bearer YOUR_JWT_TOKEN
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Monthly reset executed",
  "data": {
    "success": true,
    "timestamp": "2026-01-09T20:30:00.000Z",
    "totalClients": 50,
    "successCount": 48,
    "failureCount": 2,
    "errors": [
      {
        "clientId": "client-123",
        "error": "Failed after all retry attempts"
      }
    ],
    "duration": 3456
  }
}
```

### 4. Reiniciar Job con Nueva Configuración

```bash
POST /api/v1/jobs/monthly-reset/restart
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cronExpression": "0 0 1 * *",
  "timezone": "America/Los_Angeles",
  "retryAttempts": 5,
  "enabled": true
}
```

### 5. Reiniciar Todo el Scheduler

```bash
POST /api/v1/jobs/scheduler/restart
Authorization: Bearer YOUR_JWT_TOKEN
```

### 6. Enviar Notificación de Prueba

```bash
POST /api/v1/jobs/notifications/test
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🔔 Notificaciones

### Configurar Webhook de Slack

1. Crear un Incoming Webhook en Slack:
   - Ir a https://api.slack.com/apps
   - Crear una nueva app
   - Activar "Incoming Webhooks"
   - Crear un webhook para tu canal

2. Agregar la URL al `.env`:
   ```bash
   JOB_NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
   ```

### Formato de Notificación

```json
{
  "text": "✅ Monthly reset completed successfully (50/50 clients)",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "✅ MONTHLY-RESET Job"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "✅ Monthly reset completed successfully (50/50 clients)"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*totalClients:*\n50"
        },
        {
          "type": "mrkdwn",
          "text": "*successCount:*\n50"
        },
        {
          "type": "mrkdwn",
          "text": "*duration:*\n2345ms"
        }
      ]
    }
  ]
}
```

## 📊 Logging

### Formato de Logs

Todos los jobs generan logs estructurados:

```json
{
  "level": "info",
  "message": "🔄 Starting monthly usage reset job",
  "timestamp": "2026-01-01T05:00:00.000Z"
}

{
  "level": "info",
  "message": "Found 50 active clients to reset",
  "timestamp": "2026-01-01T05:00:01.000Z"
}

{
  "level": "info",
  "message": "✓ Reset successful for client: Acme Corp (client-123)",
  "timestamp": "2026-01-01T05:00:02.000Z"
}

{
  "level": "info",
  "message": "✅ Monthly reset job completed",
  "totalClients": 50,
  "successCount": 50,
  "failureCount": 0,
  "duration": "2345ms",
  "timestamp": "2026-01-01T05:00:05.000Z"
}
```

## 🔄 Flujo de Ejecución

### Monthly Reset Job

```
1. Scheduler activa el job según cron expression
   ↓
2. Job obtiene todos los clientes activos (limit: 1000)
   ↓
3. Para cada cliente:
   a. Intenta resetear api_calls_current_month a 0
   b. Actualiza billing_cycle_start a fecha actual
   c. Si falla, reintenta hasta RETRY_ATTEMPTS veces
   d. Espera RETRY_DELAY_MS entre reintentos
   ↓
4. Registra resultados:
   - Total de clientes procesados
   - Éxitos y fallos
   - Errores específicos
   - Duración total
   ↓
5. Envía notificación con resumen
```

## 🛠️ Desarrollo y Testing

### Ejecutar Job Manualmente (Desarrollo)

```typescript
import { executeMonthlyReset } from '@shared/jobs/monthlyResetJob';

// Ejecutar reset manual
const result = await executeMonthlyReset();
console.log(result);
```

### Testing con Diferentes Timezones

```bash
# Nueva York (EST/EDT)
MONTHLY_RESET_TIMEZONE=America/New_York

# Los Ángeles (PST/PDT)
MONTHLY_RESET_TIMEZONE=America/Los_Angeles

# Londres (GMT/BST)
MONTHLY_RESET_TIMEZONE=Europe/London

# Tokio (JST)
MONTHLY_RESET_TIMEZONE=Asia/Tokyo

# UTC
MONTHLY_RESET_TIMEZONE=UTC
```

### Probar Notificaciones

```bash
curl -X POST http://localhost:3000/api/v1/jobs/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔒 Seguridad

- ✅ Todos los endpoints requieren autenticación JWT
- ✅ Solo usuarios con rol `admin` pueden acceder
- ✅ Las notificaciones no exponen información sensible
- ✅ Los errores se registran sin exponer datos de clientes

## 📈 Monitoreo

### Métricas Importantes

1. **Duración de Ejecución**: Tiempo total del job
2. **Tasa de Éxito**: Porcentaje de clientes reseteados exitosamente
3. **Tasa de Fallo**: Clientes que fallaron después de todos los reintentos
4. **Uptime del Scheduler**: Tiempo que el scheduler ha estado activo

### Health Check

```bash
GET /api/v1/jobs/status
```

Verifica:
- Estado del scheduler (running/stopped)
- Jobs habilitados vs. activos
- Última ejecución de cada job
- Próxima ejecución programada

## 🐛 Troubleshooting

### El job no se ejecuta

1. Verificar que `MONTHLY_RESET_ENABLED=true`
2. Verificar logs del scheduler al inicio
3. Verificar expresión cron con https://crontab.guru
4. Verificar timezone configurado

### Fallos en el reset de clientes

1. Revisar logs para identificar clientes específicos
2. Verificar conectividad con la base de datos
3. Revisar permisos de la base de datos
4. Aumentar `MONTHLY_RESET_RETRY_ATTEMPTS`

### Notificaciones no llegan

1. Verificar `JOB_NOTIFICATIONS_ENABLED=true`
2. Verificar URL del webhook
3. Probar con endpoint `/notifications/test`
4. Revisar logs de errores de notificación

## 🔮 Futuras Mejoras

- [ ] Soporte para múltiples webhooks
- [ ] Integración con servicios de email (SendGrid, SES)
- [ ] Dashboard visual de jobs en tiempo real
- [ ] Métricas de Prometheus para jobs
- [ ] Alertas basadas en umbrales personalizados
- [ ] Historial de ejecuciones en base de datos
- [ ] Pausar/reanudar jobs sin reiniciar
- [ ] Jobs condicionales (ejecutar solo si X condición)

## 📚 Referencias

- [node-cron Documentation](https://github.com/node-cron/node-cron)
- [Cron Expression Generator](https://crontab.guru)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
