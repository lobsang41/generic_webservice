# 🚀 Getting Started - Enterprise Node.js Webservice

Esta guía te ayudará a poner en marcha el servicio en **menos de 5 minutos**.

---

## 📋 Prerrequisitos

- **Node.js v20+** (LTS recomendado)
- **Docker** (opcional, para desarrollo local fácil)
- **Git**

---

## ⚡ Quick Start - Local con Docker (Recomendado)

**La forma más rápida de empezar:**

```bash
# 1. Clonar el repositorio
git clone <tu-repo>
cd nservice

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env

# 4. Iniciar TODOS los servicios (PostgreSQL, MySQL, MongoDB, Redis, etc.)
docker-compose up
```

**¡Listo!** El API estará disponible en: **http://localhost:3000**

### Verificar que funciona:

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/api/v1
```

### Servicios disponibles:
- 🌐 **API Gateway**: http://localhost:3000
- 📊 **Grafana**: http://localhost:3001 (admin/admin)
- 📈 **Prometheus**: http://localhost:9090
- 🐰 **RabbitMQ Management**: http://localhost:15672 (guest/guest)

---

## 🛠️ Development Local (Sin Docker)

Si prefieres no usar Docker, necesitas instalar manualmente:

### 1. Instalar servicios

**En Windows (con Chocolatey):**
```bash
choco install postgresql mysql mongodb redis
```

**En macOS (con Homebrew):**
```bash
brew install postgresql mysql mongodb-community redis
brew services start postgresql
brew services start mysql  
brew services start mongodb-community
brew services start redis
```

**En Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql mysql-server mongodb redis-server
```

### 2. Configurar base de datos

```bash
# PostgreSQL (Sistema/Admin)
psql -U postgres
CREATE DATABASE enterprise_system_db;
\q

psql -U postgres -d enterprise_system_db -f src/shared/database/migrations/001_system_schema.sql

# MySQL (Aplicación)
mysql -u root -p
CREATE DATABASE enterprise_app_db;
exit

mysql -u root -p enterprise_app_db < src/shared/database/migrations/001_application_schema.sql
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus credenciales locales
```

### 4. Iniciar en desarrollo

```bash
npm run dev
```

---

## 📦 Build para Producción

El servicio compila TypeScript a JavaScript optimizado en `dist/`:

```bash
# Compilar
npm run build

# El resultado estará en dist/
# dist/
#   ├── services/
#   │   └── api-gateway/
#   │       └── index.js  <- Entry point
#   ├── shared/
#   └── ...

# Iniciar producción
npm start
```

---

## ☁️ Despliegue en la Nube

### 🟢 Render.com (Recomendado - Más fácil)

**1. Crear cuenta en [Render](https://render.com)**

**2. Nuevo Web Service:**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: `Node`

**3. Agregar servicios de base de datos:**

En Render Dashboard:
- ➕ **New PostgreSQL** → Copia el Internal Database URL
- ➕ **New Redis** → Copia el Internal Redis URL

**4. Variables de entorno:**

```env
NODE_ENV=production
PORT=3000

# PostgreSQL (desde Render PostgreSQL)
POSTGRES_HOST=<internal-hostname>
POSTGRES_PORT=5432
POSTGRES_DB=<database-name>
POSTGRES_USER=<username>
POSTGRES_PASSWORD=<password>

# MySQL - Usar servicio externo o ClearDB
MYSQL_HOST=<external-mysql-host>
MYSQL_PORT=3306
MYSQL_DB=enterprise_app_db
MYSQL_USER=<user>
MYSQL_PASSWORD=<password>

# MongoDB - Usar MongoDB Atlas (gratis)
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/enterprise_db

# Redis (desde Render Redis)
REDIS_HOST=<internal-hostname>
REDIS_PORT=6379
REDIS_PASSWORD=<password>

# RabbitMQ - Usar CloudAMQP (gratis)
RABBITMQ_URL=amqps://<user>:<pass>@<host>/<vhost>

# JWT Secrets (genera secretos fuertes)
JWT_SECRET=<strong-random-secret-32-chars-min>
JWT_REFRESH_SECRET=<another-strong-secret>
ENCRYPTION_KEY=<32-character-encryption-key>
```

**5. Ejecutar migraciones:**

Usa el Render Shell para ejecutar:
```bash
psql $DATABASE_URL -f src/shared/database/migrations/001_system_schema.sql
```

**6. Deploy!** 🚀

Render desplegará automáticamente en cada push a `main`.

---

### 🚂 Railway.app

**1. Instalar Railway CLI:**
```bash
npm i -g @railway/cli
railway login
```

**2. Crear proyecto:**
```bash
railway init
```

**3. Agregar servicios:**
```bash
railway add postgresql
railway add redis
# Agregar MongoDB Atlas y CloudAMQP manualmente
```

**4. Configurar variables:**
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=<secret>
# ... resto de variables
```

**5. Deploy:**
```bash
railway up
```

---

### 🟣 Heroku

**1. Crear app:**
```bash
heroku create mi-enterprise-api
```

**2. Agregar add-ons:**
```bash
heroku addons:create heroku-postgresql:mini
heroku addons:create heroku-redis:mini
heroku addons:create cloudamqp:lemur
```

**3. MongoDB Atlas:**
- Crear cluster en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Copiar connection string

**4. Configurar variables:**
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=<secret>
heroku config:set MONGO_URI=<atlas-uri>
# ... resto
```

**5. Deploy:**
```bash
git push heroku main
```

**6. Ejecutar migraciones:**
```bash
heroku run bash
# Dentro:
psql $DATABASE_URL -f src/shared/database/migrations/001_system_schema.sql
```

---

### 🔵 DigitalOcean App Platform

**1. Conectar repositorio en [DigitalOcean Apps](https://www.digitalocean.com/products/app-platform)**

**2. Configurar:**
- **Build Command**: `npm run build`
- **Run Command**: `npm start`

**3. Agregar databases:**
- PostgreSQL Managed Database
- MySQL Managed Database  
- Redis Managed Database

**4. Variables de entorno** (auto-configuradas desde databases)

**5. Deploy automático** en cada push

---

## 🧪 Testing

### Probar el servicio

```bash
# 1. Registrar usuario
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# 2. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Respuesta incluye accessToken

# 3. Usar el token
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <tu-access-token>"
```

---

## 🗄️ Servicios de Bases de Datos Gratis

### PostgreSQL
- **Render PostgreSQL**: 90 días gratis, luego $7/mes
- **Supabase**: Plan gratis generoso
- **ElephantSQL**: 20MB gratis

### MySQL
- **PlanetScale**: 5GB gratis
- **ClearDB** (Heroku): Plan gratis disponible
- **Amazon RDS Free Tier**: 750 horas/mes

### MongoDB
- **MongoDB Atlas**: 512MB gratis permanente ✅
- **MongoDB Cloud**: Cluster M0 gratis

### Redis
- **Render Redis**: 25MB gratis
- **Upstash**: 10K comandos/día gratis ✅
- **Redis Cloud**: 30MB gratis

### RabbitMQ
- **CloudAMQP**: Plan "Lemur" gratis ✅
- **RabbitMQ Cloud**: Trial gratuito

---

## 📊 Monitoreo

### Grafana + Prometheus

**Local:**
```bash
docker-compose up grafana prometheus
```

- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090

**Producción:**
- Usar [Grafana Cloud](https://grafana.com/products/cloud/) (gratis hasta 10K series)
- O deployar Grafana en Render/Railway

---

## 🔒 Seguridad para Producción

**Antes de desplegar:**

1. ✅ **Cambiar credenciales por defecto:**
   ```bash
   # En 001_system_schema.sql y 001_application_schema.sql
   # Cambiar admin@example.com / admin123
   ```

2. ✅ **Generar secretos fuertes:**
   ```bash
   # JWT_SECRET (32+ caracteres)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # ENCRYPTION_KEY (exactamente 32 caracteres)
   node -e "console.log(require('crypto').randomBytes(32).toString('base64').slice(0,32))"
   ```

3. ✅ **Configurar CORS:**
   ```env
   CORS_ORIGIN=https://tu-frontend.com
   ```

4. ✅ **HTTPS obligatorio** (Render/Railway lo hacen automático)

5. ✅ **Rate limiting** ya configurado ✅

---

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install
npm run build
```

### "Database connection failed"
```bash
# Verificar que las bases de datos estén corriendo
docker-compose ps

# Verificar credenciales en .env
```

### "Port 3000 already in use"
```bash
# Cambiar puerto en .env
PORT=3001
```

### Errores de TypeScript
```bash
# Limpiar y recompilar
rm -rf dist node_modules
npm install
npm run build
```

---

## 📚 Próximos pasos

1. **Revisar estructura**: [`docs/DATABASE_ARCHITECTURE.md`](file:///c:/nservice/docs/DATABASE_ARCHITECTURE.md)
2. **Ver deployment completo**: [`docs/DEPLOYMENT.md`](file:///c:/nservice/docs/DEPLOYMENT.md)
3. **Leer documentación completa**: [`README.md`](file:///c:/nservice/README.md)
4. **Agregar tests**: Ver `jest.config.js`
5. **Configurar CI/CD**: Ya configurado en `.github/workflows/`

---

## 🆘 ¿Necesitas ayuda?

- 📖 **Documentación completa**: Ver README.md
- 🏗️ **Arquitectura**: Ver docs/DATABASE_ARCHITECTURE.md
- 🚀 **Deployment**: Ver docs/DEPLOYMENT.md
- 📊 **Monitoreo**: Grafana en http://localhost:3001

---

**¡Listo para escalar! 🚀**
