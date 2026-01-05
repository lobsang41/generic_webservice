# Servicio Web Enterprise Node.js

> 🚀 Arquitectura de microservicios lista para producción con Node.js, TypeScript, seguridad integral, monitoreo y base de datos remota

## Características

### Servicios Activos
- ✅ **Arquitectura de Microservicios** - Diseño escalable basado en servicios con patrón API Gateway
- 🔐 **Múltiples Métodos de Autenticación** - JWT, API Keys, soporte OAuth2
- 🏢 **Módulo de Clientes SaaS** - Sistema multi-tenant con tiers, API keys y rate limiting
- 🗄️ **Base de Datos MySQL Remota** - Servidor MySQL en kittyservices.servicesinc.cloud
- ⚡ **Caché en Memoria** - node-cache para caché de alto rendimiento
- 📊 **Monitoreo** - Métricas de Prometheus + dashboards de Grafana
- 🛡️ **Seguridad** - Rate limiting, encriptación, helmet, CORS
- 🐳 **Containerizado** - Listo para Docker
- 📝 **TypeScript** - Seguridad de tipos completa

### Servicios Comentados (Listos para Activar)
- 🗄️ **PostgreSQL** - Datos de sistema/admin (comentado, listo para activar)
- 🗄️ **MongoDB** - Almacenamiento de documentos (comentado, listo para activar)
- ⚡ **Redis** - Caché distribuido (comentado, usando node-cache en su lugar)
- 📨 **RabbitMQ** - Cola de mensajes (comentado, listo para activar)

## Tipos de API Soportados

- **REST** - APIs RESTful tradicionales con documentación OpenAPI/Swagger
- **GraphQL** - Consultas flexibles con Apollo Server (próximamente)
- **gRPC** - RPC de alto rendimiento (próximamente)

## Inicio Rápido

### Requisitos Previos

- Node.js >= 20.0.0
- Docker & Docker Compose
- npm >= 10.0.0
- Acceso a servidor MySQL remoto

### Instalación

1. **Clonar e instalar dependencias**
   ```bash
   npm install
   ```

2. **Configurar Base de Datos MySQL**
   
   Ejecuta el script SQL en tu servidor MySQL remoto (phpMyAdmin o terminal):
   ```bash
   mysql -h kittyservices.servicesinc.cloud -P 3306 -u adminkitty -p webservices < database_setup.sql
   ```
   
   O copia el contenido de `database_setup.sql` y ejecútalo en phpMyAdmin.

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # Edita .env con tu configuración de MySQL remoto
   ```

4. **Iniciar servicios con Docker Compose**
   ```bash
   docker-compose up -d
   ```

   Esto iniciará:
   - API Gateway (puerto 3000)
   - Prometheus (puerto 9090) - Métricas
   - Grafana (puerto 3001) - Dashboards
   
   **Servicios Remotos:**
   - MySQL (kittyservices.servicesinc.cloud:3306) - Base de datos de aplicación

5. **Acceder a los servicios**
   - API: http://localhost:3000
   - Health Check: http://localhost:3000/health
   - Métricas: http://localhost:3000/metrics
   - Grafana: http://localhost:3001 (admin/admin)
   - Prometheus: http://localhost:9090

## Desarrollo

### Ejecutar en modo desarrollo

```bash
# Iniciar API Gateway en modo watch
npm run dev
```

### Compilar para producción

```bash
npm run build
npm start
```

## Configuración de Base de Datos

### MySQL Remoto

**Servidor:** kittyservices.servicesinc.cloud
**Puerto:** 3306
**Base de Datos:** webservices
**Usuario:** adminkitty

El script `src/shared/database/migrations/001_unified_mysql_schema.sql` crea las siguientes tablas:

**Usuarios y Autenticación:**
- `users` - Usuarios del sistema
- `api_keys` - Claves API de usuarios

**Módulo de Clientes SaaS:**
- `client_tiers` - Planes/tipos de cliente (Free, Pro, Enterprise)
- `clients` - Clientes/tenants con tracking de uso
- `client_api_keys` - API Keys de clientes (prefijo `mk_`)
- `audit_log` - Registro completo de auditoría de cambios en el sistema

## Rutas de la API

### Base URL
```
http://localhost:3000/api/v1
```

### Autenticación

- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/refresh` - Refrescar token
- `POST /api/v1/auth/logout` - Cerrar sesión
- `GET /api/v1/auth/me` - Obtener usuario actual
- `POST /api/v1/auth/api-key` - Generar API Key de usuario

### Usuarios

- `GET /api/v1/users` - Listar usuarios (admin)
- `GET /api/v1/users/:id` - Obtener usuario
- `PATCH /api/v1/users/:id` - Actualizar usuario
- `DELETE /api/v1/users/:id` - Eliminar usuario (admin)

### 🆕 Módulo de Clientes SaaS

#### Tiers/Planes (Público)
- `GET /api/v1/client-tiers` - Listar planes disponibles
- `GET /api/v1/client-tiers/:id` - Obtener detalles de un plan
- `POST /api/v1/client-tiers` - Crear plan personalizado (admin)
- `PATCH /api/v1/client-tiers/:id` - Actualizar plan (admin)
- `DELETE /api/v1/client-tiers/:id` - Desactivar plan (admin)

#### Clientes (Admin)
- `POST /api/v1/clients` - Crear cliente
- `GET /api/v1/clients` - Listar clientes (paginado)
- `GET /api/v1/clients/:id` - Obtener cliente con tier
- `PATCH /api/v1/clients/:id` - Actualizar cliente
- `DELETE /api/v1/clients/:id` - Desactivar cliente
- `GET /api/v1/clients/:id/usage` - Estadísticas de uso
- `POST /api/v1/clients/:id/reset-usage` - Resetear uso mensual

#### API Keys de Clientes
- `POST /api/v1/clients/:clientId/api-keys` - Generar API Key (prefijo `mk_`)
- `GET /api/v1/clients/:clientId/api-keys` - Listar API Keys del cliente
- `DELETE /api/v1/clients/:clientId/api-keys/:keyId` - Revocar API Key

#### 📜 Logs de Auditoría y Retención (Solo Admin)
- `GET /api/v1/audit-logs` - Listar logs de auditoría (filtros: tabla, registro, usuario, acción, fecha)
- `GET /api/v1/audit-logs/:id` - Obtener entrada específica de auditoría
- `GET /api/v1/audit-logs/stats/summary` - Resumen de actividad y estadísticas
- `GET /api/v1/audit-logs/retention/config` - Obtener configuración actual de retención
- `POST /api/v1/audit-logs/retention/config` - Actualizar configuración de retención (días, hora, habilitado)
- `POST /api/v1/audit-logs/retention/cleanup` - Disparar limpieza manual de logs antiguos

#### Prueba de Client API Key
- `GET /api/v1/client-test/test` - Endpoint de prueba (requiere Client API Key)
  - Headers: `X-API-Key: mk_...`
  - Retorna información del cliente, tier y uso
  - Incluye headers de rate limiting y uso mensual

## Seguridad

- **JWT** - Tokens de acceso y refresh
- **API Keys** - Autenticación alternativa
- **Rate Limiting** - Protección contra abuso
- **Helmet** - Headers de seguridad HTTP
- **CORS** - Control de acceso entre orígenes
- **Encriptación** - AES-256-GCM para datos sensibles
- **Bcrypt** - Hash de contraseñas

## Monitoreo

### Prometheus (puerto 9090)
- Métricas de HTTP requests
- Latencia de respuestas
- Errores y códigos de estado
- Métricas de base de datos

### Grafana (puerto 3001)
- Dashboards pre-configurados
- Visualización de métricas
- Alertas personalizables

## Scripts Disponibles

```bash
npm run dev          # Modo desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm start            # Iniciar en producción
npm run lint         # Ejecutar ESLint
npm run lint:fix     # Corregir problemas de lint
npm run format       # Formatear código con Prettier
npm test             # Ejecutar tests
npm run test:watch   # Tests en modo watch
```

## Docker

### Comandos útiles

```bash
# Ver estado de servicios
docker-compose ps

# Ver logs del API Gateway
docker logs enterprise_api_gateway

# Reiniciar API Gateway
docker-compose restart api-gateway

# Detener todos los servicios
docker-compose down

# Reconstruir imagen
docker-compose build api-gateway
```

## Estructura del Proyecto

```
generic_webservice/
├── src/
│   ├── services/
│   │   └── api-gateway/          # API Gateway principal
│   │       ├── index.ts
│   │       └── routes/
│   └── shared/
│       ├── config/                # Configuración
│       ├── database/              # Conexiones a BD
│       ├── auth/                  # Autenticación
│       ├── middleware/            # Middleware Express
│       ├── cache/                 # Caché
│       ├── monitoring/            # Monitoreo
│       └── utils/                 # Utilidades
├── database_setup.sql             # Script de inicialización de BD
├── docker-compose.yml             # Configuración Docker
├── Dockerfile                     # Imagen de producción
└── package.json                   # Dependencias
```

## Variables de Entorno

### Configuración General
```env
NODE_ENV=development
PORT=3000
```

### MySQL (Remoto)
```env
MYSQL_HOST=kittyservices.servicesinc.cloud
MYSQL_PORT=3306
MYSQL_DB=webservices
MYSQL_USER=adminkitty
MYSQL_PASSWORD=tu_password
```

### JWT
```env
JWT_SECRET=tu-secreto-jwt-muy-seguro
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=tu-secreto-refresh-muy-seguro
JWT_REFRESH_EXPIRES_IN=7d

### Retención de Logs de Auditoría
```env
AUDIT_LOG_RETENTION_DAYS=180
AUDIT_CLEANUP_ENABLED=true
AUDIT_CLEANUP_HOUR=2
```
```

### Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MAX_REQUESTS_AUTH=1000
```

## Reactivar Servicios Comentados

Para reactivar PostgreSQL, MongoDB, Redis o RabbitMQ:

1. Descomentar el servicio en `docker-compose.yml`
2. Descomentar las variables de entorno correspondientes
3. Actualizar `src/shared/config/index.ts` para hacer las variables requeridas
4. Descomentar el código de inicialización en los archivos correspondientes
5. Reiniciar los servicios: `docker-compose up -d`

## Soporte

Para más información, consulta:
- [README.md](README.md) - Documentación en inglés
- [DATABASE_ARCHITECTURE.md](docs/DATABASE_ARCHITECTURE.md) - Arquitectura de base de datos
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Guía de despliegue

## Licencia

MIT
