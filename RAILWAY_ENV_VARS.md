# Variables de Entorno para Railway

**Proyecto:** Enterprise Node.js Webservice  
**Plataforma:** Railway  
**Fecha:** 2025-12-19

---

## 🔐 Secrets Generados (COPIAR A RAILWAY)

```bash
# === JWT SECRETS (GENERADOS AUTOMÁTICAMENTE) ===
JWT_SECRET=88a4a6fa8389a182097671e842de4b83fb6fe948dfff3a2d9315b9a69bcc6fd8
JWT_REFRESH_SECRET=da16f9e282e4046adb917668df0e8498344dcd91f177f27e4675d4cf5a59eecf
ENCRYPTION_KEY=849d90045b939a50aefe212a1adbdbe7
```

⚠️ **IMPORTANTE:** Guarda estos secrets en un lugar seguro. No los compartas públicamente.

---

## 📋 Variables de Entorno Completas para Railway

### Configuración General

```bash
NODE_ENV=production
API_VERSION=v1
```

**Nota:** `PORT` no es necesario configurarlo. Railway lo inyecta automáticamente.

---

### MySQL (Base de Datos Remota)

```bash
MYSQL_HOST=kittyservices.servicesinc.cloud
MYSQL_PORT=3306
MYSQL_DB=<TU_NOMBRE_DE_BASE_DE_DATOS>
MYSQL_USER=<TU_USUARIO_MYSQL>
MYSQL_PASSWORD=<TU_PASSWORD_MYSQL>
MYSQL_POOL_MIN=2
MYSQL_POOL_MAX=10
```

⚠️ **REEMPLAZAR:**
- `<TU_NOMBRE_DE_BASE_DE_DATOS>` - Nombre de tu base de datos en MySQL
- `<TU_USUARIO_MYSQL>` - Usuario de MySQL
- `<TU_PASSWORD_MYSQL>` - Contraseña de MySQL

---

### JWT y Encriptación (USAR SECRETS GENERADOS)

```bash
JWT_SECRET=88a4a6fa8389a182097671e842de4b83fb6fe948dfff3a2d9315b9a69bcc6fd8
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=da16f9e282e4046adb917668df0e8498344dcd91f177f27e4675d4cf5a59eecf
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_KEY=849d90045b939a50aefe212a1adbdbe7
```

---

### Rate Limiting

```bash
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MAX_REQUESTS_AUTH=1000
```

---

### CORS

```bash
CORS_ORIGIN=*
CORS_CREDENTIALS=true
```

⚠️ **PRODUCCIÓN:** Cambiar `CORS_ORIGIN=*` por tu dominio específico:
```bash
CORS_ORIGIN=https://tu-dominio.com
```

---

### Logging

```bash
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 🚀 Cómo Configurar en Railway

### Opción 1: Interfaz Web (Recomendado)

1. Ve a tu proyecto en Railway
2. Click en tu servicio
3. Ve a la pestaña **"Variables"**
4. Click en **"+ New Variable"**
5. Copia y pega cada variable (una por una)

### Opción 2: Railway CLI

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link al proyecto
railway link

# Configurar variables
railway variables set NODE_ENV=production
railway variables set API_VERSION=v1
railway variables set MYSQL_HOST=kittyservices.servicesinc.cloud
railway variables set MYSQL_PORT=3306
railway variables set MYSQL_DB=<TU_DB>
railway variables set MYSQL_USER=<TU_USER>
railway variables set MYSQL_PASSWORD=<TU_PASSWORD>
railway variables set MYSQL_POOL_MIN=2
railway variables set MYSQL_POOL_MAX=10
railway variables set JWT_SECRET=88a4a6fa8389a182097671e842de4b83fb6fe948dfff3a2d9315b9a69bcc6fd8
railway variables set JWT_EXPIRES_IN=1h
railway variables set JWT_REFRESH_SECRET=da16f9e282e4046adb917668df0e8498344dcd91f177f27e4675d4cf5a59eecf
railway variables set JWT_REFRESH_EXPIRES_IN=7d
railway variables set ENCRYPTION_ALGORITHM=aes-256-gcm
railway variables set ENCRYPTION_KEY=849d90045b939a50aefe212a1adbdbe7
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
railway variables set RATE_LIMIT_MAX_REQUESTS_AUTH=1000
railway variables set CORS_ORIGIN=*
railway variables set CORS_CREDENTIALS=true
railway variables set LOG_LEVEL=info
railway variables set LOG_FORMAT=json
```

---

## ✅ Verificación

Después de configurar las variables, verifica que estén correctas:

```bash
# En Railway Dashboard
# Variables → Ver todas las variables configuradas

# Debe haber 21 variables en total
```

---

## 🔒 Seguridad

### ✅ Buenas Prácticas

- ✅ Secrets generados automáticamente (no hardcoded)
- ✅ Secrets de 32+ caracteres
- ✅ JWT_SECRET diferente de JWT_REFRESH_SECRET
- ✅ Variables sensibles solo en Railway (no en código)

### ⚠️ Recomendaciones

1. **Rotar secrets periódicamente** (cada 3-6 meses)
2. **Usar CORS específico en producción** (no `*`)
3. **Habilitar 2FA en Railway**
4. **Monitorear logs de acceso**

---

## 📊 Variables por Categoría

| Categoría | Cantidad | Críticas |
|-----------|----------|----------|
| General | 2 | 0 |
| MySQL | 7 | 7 ⚠️ |
| JWT/Encriptación | 6 | 6 ⚠️ |
| Rate Limiting | 3 | 0 |
| CORS | 2 | 0 |
| Logging | 2 | 0 |
| **TOTAL** | **22** | **13** |

---

## 🚨 Troubleshooting

### Error: "Missing required environment variable"

**Solución:** Verifica que todas las variables críticas (⚠️) estén configuradas.

### Error: "Invalid JWT secret"

**Solución:** Verifica que `JWT_SECRET` y `JWT_REFRESH_SECRET` estén correctamente copiados (sin espacios).

### Error: "Cannot connect to MySQL"

**Solución:** 
1. Verifica credenciales de MySQL
2. Verifica que MySQL remoto permite conexiones externas
3. Verifica firewall

---

## 📝 Notas Importantes

1. **PORT:** Railway lo inyecta automáticamente. NO configurarlo manualmente.
2. **Secrets:** Generados con `crypto.randomBytes()` para máxima seguridad.
3. **MySQL:** Usa base de datos remota existente (no Railway).
4. **Redis/MongoDB/RabbitMQ:** NO configurados (no se usan actualmente).

---

## ✅ Checklist Final

- [ ] Todas las 22 variables configuradas en Railway
- [ ] Secrets copiados correctamente (sin espacios)
- [ ] Credenciales de MySQL verificadas
- [ ] CORS configurado para producción
- [ ] Variables sensibles guardadas en lugar seguro
- [ ] Proyecto listo para deploy

---

**Última actualización:** 2025-12-19  
**Secrets generados:** 2025-12-19 12:03 PM
