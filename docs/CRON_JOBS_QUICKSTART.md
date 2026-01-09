# 🎯 Sistema de Cron Jobs - Guía de Inicio Rápido

## ✅ Implementación Completada

Se ha implementado exitosamente un sistema completo de Cron Jobs con las siguientes características:

### 📦 Componentes Implementados

1. **Monthly Reset Job** (`monthlyResetJob.ts`)
   - Reset automático de cuotas mensuales de clientes
   - Sistema de reintentos configurable
   - Logging detallado de cada operación

2. **Notification Service** (`notificationService.ts`)
   - Soporte para webhooks (Slack, Discord, Teams)
   - Preparado para notificaciones por email
   - Threshold configurable de fallos

3. **Scheduler Central** (`scheduler.ts`)
   - Coordinador de todos los jobs
   - Health checks
   - Graceful shutdown

4. **API Endpoints** (`routes/jobs.ts`)
   - Gestión completa de jobs vía API REST
   - Solo accesible para administradores

## 🚀 Pasos para Activar

### 1. Configurar Variables de Entorno

Agregar al archivo `.env`:

```bash
# Cron Jobs - Monthly Reset
MONTHLY_RESET_ENABLED=true
MONTHLY_RESET_CRON=0 0 1 * *
MONTHLY_RESET_TIMEZONE=America/New_York
MONTHLY_RESET_RETRY_ATTEMPTS=3
MONTHLY_RESET_RETRY_DELAY_MS=5000

# Job Notifications (Opcional)
JOB_NOTIFICATIONS_ENABLED=true
JOB_NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
JOB_NOTIFICATION_MIN_FAILURES=1
```

### 2. Reiniciar el Servidor

```bash
npm run dev
# o
npm run build && npm start
```

### 3. Verificar que el Scheduler Está Activo

Buscar en los logs:

```
✅ Job Scheduler initialized (monthly reset, audit cleanup)
📅 Starting monthly reset job
✅ Monthly reset job started successfully
```

## 🧪 Testing

### 1. Verificar Estado del Scheduler

```bash
curl -X GET http://localhost:3000/api/v1/jobs/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Ejecutar Reset Manual (Prueba)

```bash
curl -X POST http://localhost:3000/api/v1/jobs/monthly-reset/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Probar Notificaciones

```bash
curl -X POST http://localhost:3000/api/v1/jobs/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📊 Monitoreo

### Logs a Observar

1. **Inicio del Job:**
   ```
   🔔 Monthly reset job triggered by schedule
   🔄 Starting monthly usage reset job
   Found X active clients to reset
   ```

2. **Progreso:**
   ```
   ✓ Reset successful for client: Acme Corp (client-123)
   ✓ Reset successful for client: Tech Inc (client-456)
   ```

3. **Finalización:**
   ```
   ✅ Monthly reset job completed
   totalClients: 50
   successCount: 50
   failureCount: 0
   duration: 2345ms
   ```

## 🔧 Configuración Avanzada

### Cambiar Horario de Ejecución

Para ejecutar el 15 de cada mes a las 3 AM:

```bash
MONTHLY_RESET_CRON=0 3 15 * *
```

### Cambiar Timezone

Para usar hora de Los Ángeles:

```bash
MONTHLY_RESET_TIMEZONE=America/Los_Angeles
```

### Aumentar Reintentos

Para clientes con conexiones inestables:

```bash
MONTHLY_RESET_RETRY_ATTEMPTS=5
MONTHLY_RESET_RETRY_DELAY_MS=10000
```

## 🔔 Configurar Notificaciones de Slack

### Paso 1: Crear Webhook en Slack

1. Ir a https://api.slack.com/apps
2. Click en "Create New App"
3. Seleccionar "From scratch"
4. Nombrar la app (ej: "Cron Jobs Monitor")
5. Seleccionar tu workspace
6. En "Features", activar "Incoming Webhooks"
7. Click en "Add New Webhook to Workspace"
8. Seleccionar el canal donde quieres recibir notificaciones
9. Copiar la URL del webhook

### Paso 2: Configurar en el Sistema

```bash
JOB_NOTIFICATIONS_ENABLED=true
JOB_NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### Paso 3: Probar

```bash
curl -X POST http://localhost:3000/api/v1/jobs/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Deberías recibir un mensaje en Slack con:
```
✅ MONTHLY-RESET Job
✅ Monthly reset completed successfully (10/10 clients)
```

## 📁 Archivos Creados

```
src/shared/jobs/
├── scheduler.ts              # ✅ Coordinador central
├── monthlyResetJob.ts        # ✅ Job de reset mensual
├── auditCleanupJob.ts        # ✅ Job de limpieza (ya existía)
├── notificationService.ts    # ✅ Sistema de notificaciones
└── index.ts                  # ✅ Exportaciones

src/services/api-gateway/routes/
└── jobs.ts                   # ✅ API endpoints

docs/
└── CRON_JOBS.md             # ✅ Documentación completa

.env.example                  # ✅ Actualizado con nuevas variables
README.md                     # ✅ Actualizado con info de jobs
```

## ✅ Criterios de Aceptación Cumplidos

- [x] **Configurar node-cron para scheduling** ✅
- [x] **Implementar job de reset de cuotas mensuales** ✅
- [x] **Sistema de logging para ejecuciones de jobs** ✅
- [x] **Manejo de errores y reintentos** ✅
- [x] **Notificaciones de éxito/fallo** ✅
- [x] **Configuración de timezone apropiado** ✅

## 🎓 Próximos Pasos Recomendados

1. **Configurar Webhook de Slack** para recibir notificaciones
2. **Probar el reset manual** con algunos clientes de prueba
3. **Monitorear los logs** durante la primera ejecución automática
4. **Ajustar el timezone** según tu ubicación
5. **Documentar** cualquier configuración específica de tu equipo

## 📚 Documentación Adicional

- [Documentación Completa de Cron Jobs](../docs/CRON_JOBS.md)
- [README Principal](../README.md)
- [Configuración de Variables de Entorno](../.env.example)

## 🐛 Solución de Problemas

### El job no se ejecuta

1. Verificar que `MONTHLY_RESET_ENABLED=true` en `.env`
2. Revisar logs del servidor al inicio
3. Verificar expresión cron en https://crontab.guru

### Notificaciones no llegan

1. Verificar `JOB_NOTIFICATIONS_ENABLED=true`
2. Verificar URL del webhook
3. Probar con `/notifications/test`

### Errores en el reset

1. Verificar conexión a MySQL
2. Revisar permisos de base de datos
3. Aumentar `MONTHLY_RESET_RETRY_ATTEMPTS`

## 💡 Tips

- El job se ejecuta automáticamente según el cron configurado
- Puedes ejecutar manualmente en cualquier momento vía API
- Los logs se guardan automáticamente en Winston
- Las notificaciones solo se envían si hay fallos (configurable)
- El scheduler se detiene gracefully al apagar el servidor

---

**¡Sistema listo para producción!** 🚀
