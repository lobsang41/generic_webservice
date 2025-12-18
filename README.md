# Enterprise Node.js Webservice

> 🚀 Production-ready microservices architecture with Node.js, TypeScript, comprehensive security, monitoring, and cloud integration

## Features

### Active Services
- ✅ **Microservices Architecture** - Scalable service-based design with API Gateway pattern
- 🔐 **Multiple Auth Methods** - JWT, API Keys, OAuth2 support
- 🗄️ **MySQL Database** - Remote MySQL server (kittyservices.servicesinc.cloud)
- ⚡ **In-Memory Caching** - node-cache for high-performance caching
- 📊 **Monitoring** - Prometheus metrics + Grafana dashboards
- 🛡️ **Security** - Rate limiting, encryption, helmet, CORS
- 🐳 **Containerized** - Docker ready
- 📝 **TypeScript** - Full type safety

### Commented Services (Ready to Activate)
- 🗄️ **PostgreSQL** - System/admin data (commented, ready to activate)
- 🗄️ **MongoDB** - Document storage (commented, ready to activate)
- ⚡ **Redis** - Distributed caching (commented, using node-cache instead)
- 📨 **RabbitMQ** - Message queue (commented, ready to activate)

## API Types Supported

- **REST** - Traditional RESTful APIs with OpenAPI/Swagger docs
- **GraphQL** - Flexible querying with Apollo Server (coming soon)
- **gRPC** - High-performance RPC (coming soon)

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose
- npm >= 10.0.0

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Setup MySQL Database**
   
   Execute the SQL script in your remote MySQL server (phpMyAdmin or terminal):
   ```bash
   mysql -h kittyservices.servicesinc.cloud -P 3306 -u adminkitty -p webservices < database_setup.sql
   ```
   
   Or copy the contents of `database_setup.sql` and execute in phpMyAdmin.

3. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MySQL remote configuration
   ```

4. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - API Gateway (port 3000)
   - Prometheus (port 9090) - Metrics
   - Grafana (port 3001) - Dashboards
   
   **Remote Services:**
   - MySQL (kittyservices.servicesinc.cloud:3306) - Application database

5. **Access the services**
   - API: http://localhost:3000
   - Health Check: http://localhost:3000/health
   - Metrics: http://localhost:3000/metrics
   - Grafana: http://localhost:3001 (admin/admin)
   - Prometheus: http://localhost:9090

## Development

### Run in development mode

```bash
# Start dependencies only
docker-compose up postgres mongodb redis rabbitmq

# Run API Gateway in watch mode
npm run dev
```

### Build for production

```bash
npm run build
npm start
```

### Run tests

```bash
npm test                 # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
```

## API Documentation

### Authentication

#### Register a new user
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "name": "John Doe"}'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

#### Generate API Key
```bash
curl -X POST http://localhost:3000/api/v1/auth/api-key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My API Key", "expiresInDays": 30}'
```

### Using Authentication

**With JWT:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/users/me
```

**With API Key:**
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  http://localhost:3000/api/v1/users/me
```

## Project Structure

```
├── src/
│   ├── shared/              # Shared utilities and infrastructure
│   │   ├── config/          # Configuration management
│   │   ├── utils/           # Utility functions (logger, encryption)
│   │   ├── middleware/      # Express middleware (auth, rate limiting)
│   │   ├── database/        # Database connections and migrations
│   │   ├── cache/           # Redis caching layer
│   │   ├── auth/            # Authentication services (JWT, API keys)
│   │   ├── messaging/       # Message queue (RabbitMQ)
│   │   ├── monitoring/      # Prometheus metrics, health checks
│   │   └── cloud/           # Cloud provider integrations
│   └── services/            # Microservices
│       └── api-gateway/     # API Gateway service
│           ├── index.ts     # Main server
│           └── routes/      # API routes
├── monitoring/              # Monitoring configuration
│   ├── prometheus/          # Prometheus config
│   └── grafana/             # Grafana dashboards
├── k8s/                     # Kubernetes manifests (coming soon)
├── docker-compose.yml       # Local development environment
├── Dockerfile               # Production Docker image
└── package.json             # Dependencies and scripts
```

## Monitoring

### Prometheus Metrics

Access Prometheus at http://localhost:9090

Key metrics available:
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `http_request_errors_total` - Error count
- `database_query_duration_seconds` - Database query performance
- `cache_hits_total` / `cache_misses_total` - Cache performance
- `authentication_attempts_total` - Auth attempts

### Grafana Dashboards

Access Grafana at http://localhost:3001 (admin/admin)

Pre-configured dashboards show:
- Request rates and latency
- Error rates by endpoint
- Database performance
- Cache hit rates
- System resources

## Security Features

- 🔐 **JWT Authentication** - Secure token-based auth with refresh tokens
- 🔑 **API Keys** - Long-lived keys for service-to-service auth
- 🌐 **OAuth2** - Third-party authentication support
- 🛡️ **Rate Limiting** - Redis-backed rate limiting (public/authenticated tiers)
- 🔒 **Encryption** - AES-256-GCM for sensitive data
- 🚨 **RBAC** - Role-based access control
- 📋 **Input Validation** - Request validation with Joi
- 🔐 **Helmet** - Security headers
- 🌍 **CORS** - Configurable cross-origin policies

## Database Schema

### Database Separation Pattern

This project implements **database separation** following enterprise best practices:

- **PostgreSQL** (`enterprise_system_db`): System/admin data
  - API keys, OAuth2 tokens, sessions
  - Audit logs, system config
  - See: 001_system_schema.sql

- **MySQL** (`enterprise_app_db`): Application/business data
  - Users, profiles, preferences
  - Posts, transactions, business entities
  - See: 001_application_schema.sql

- **MongoDB**: Flexible schema data
  - Activity logs, events, analytics

**Why separate?**
- Security isolation (compromised app DB ≠ compromised system)
- Independent scaling
- Different backup strategies
- Compliance (audit logs separated)

See [DATABASE_ARCHITECTURE.md](file:///c:/nservice/docs/DATABASE_ARCHITECTURE.md) for complete details.

### PostgreSQL Tables
- `api_keys` - API key management
- `oauth2_tokens` - OAuth2 token storage
- `sessions` - Session management
- `audit_logs` - Audit trail
- `system_config` - System configuration

### MySQL Tables
- `users` - User accounts
- `user_profiles` - User profiles
- `user_preferences` - User settings
- `posts` - Content/articles (example)
- `transactions` - Transactions (example)

See `src/shared/database/migrations/` for full schema.

## Environment Variables

Key environment variables (see `.env.example` for full list):

```env
NODE_ENV=development
PORT=3000

# Databases
POSTGRES_HOST=localhost
POSTGRES_DB=enterprise_db
MONGO_URI=mongodb://localhost:27017/enterprise_db

# Cache & Queue
REDIS_HOST=localhost
RABBITMQ_URL=amqp://localhost:5672

# Security
JWT_SECRET=your-secret-here
ENCRYPTION_KEY=your-32-char-key-here
```

## Scripts

```bash
npm run dev              # Development mode with hot reload
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run tests
npm run lint             # Lint code
npm run format           # Format code with Prettier
npm run docker:dev       # Start Docker Compose
npm run k8s:deploy       # Deploy to Kubernetes
```

## Cloud Deployment

### Docker

```bash
docker build -t enterprise-api .
docker run -p 3000:3000 enterprise-api
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ using Node.js 20, TypeScript, and modern DevOps practices**
