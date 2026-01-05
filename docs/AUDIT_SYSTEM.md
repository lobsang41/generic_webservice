# Sistema de Auditoría Tenant-Level

## Resumen

Este proyecto implementa un sistema de auditoría robusto a nivel de aplicación (Node.js) diseñado para entornos multi-tenant. Debido a restricciones de privilegios en servidores compartidos, la auditoría se captura directamente en la lógica de negocio, lo que permite capturar metadata enriquecida (Usuario, IP, User Agent).

---

## ✅ Características Implementadas

### 1. Captura Automática
- **Integración**: Implementado en las capas de servicio y rutas.
- **Acciones**: Registro de `INSERT`, `UPDATE` y `DELETE`.
- **Metadata**: Captura automática de `changed_by` (email), `ip_address` y `user_agent`.

### 2. Retención Configurable
- **Limpieza Automática**: Job diario (node-cron) para eliminar registros antiguos.
- **Configuración**: 
  - `AUDIT_LOG_RETENTION_DAYS`: Días de permanencia (default 180).
  - `AUDIT_CLEANUP_ENABLED`: Activar/desactivar limpieza.
  - `AUDIT_CLEANUP_HOUR`: Hora de ejecución (default 2 AM).

### 3. API de Consulta
- **Endpoints**:
  - `GET /api/v1/audit-logs`: Listado con filtros (tabla, registro, acción, usuario, fecha).
  - `GET /api/v1/audit-logs/stats/summary`: Estadísticas de actividad.
  - `GET /api/v1/audit-logs/retention/config`: Configuración actual de retención.

---

## 📁 Estructura del Sistema

- **`src/shared/utils/auditLogger.ts`**: Lógica core de registro de logs.
- **`src/shared/services/auditRetentionService.ts`**: Gestión de políticas de retención.
- **`src/shared/jobs/auditCleanupJob.ts`**: Programador de limpieza automática.
- **`src/services/api-gateway/routes/audit-logs.ts`**: API de consulta y gestión.

---

## 🔧 Uso en el Código

### Registro de Inserción
```typescript
await logInsert('users', userId, { email, role }, getAuditMetadata(req));
```

### Registro de Actualización
```typescript
await logUpdate('users', userId, oldValues, newValues, getAuditMetadata(req));
```

---

## 📊 Dashboard de Control

El sistema incluye una pestaña dedicada en el dashboard (`public/dashboard.html`) que permite:
1. Visualizar logs en tiempo real.
2. Filtrar por cliente, acción o tabla.
3. Exportar datos a **JSON** y **CSV**.
4. Configurar las políticas de retención desde la interfaz (Solo Admin).
5. Ejecutar limpiezas manuales.

---

## ⚙️ Configuración (.env)

```env
# Audit Log Retention
AUDIT_LOG_RETENTION_DAYS=180
AUDIT_CLEANUP_ENABLED=true
AUDIT_CLEANUP_HOUR=2
```

---

## ✅ Estado de Cumplimiento

- [x] Modelo de audit log con contexto de tenant
- [x] Middleware/Servicio automático para captura
- [x] API para consulta por cliente
- [x] Retención configurable y limpieza automática
- [x] Exportación para compliance (JSON/CSV)
- [x] Indexación para optimización de búsquedas
