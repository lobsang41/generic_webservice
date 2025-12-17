# Database Architecture - Separation Pattern

## Overview

This project implements a **Database Separation Pattern** following enterprise best practices. We use multiple databases for different concerns:

- **PostgreSQL**: System/Administrative data
- **MySQL**: Application/Business data  
- **MongoDB**: Document store for flexible schemas
- **Redis**: Caching and session store

## Why Separate Databases?

### Security Isolation
- **System data** (API keys, audit logs) is isolated from application data
- Compromised application database doesn't expose system credentials
- Different access controls and encryption policies per database

### Independent Scaling
- **Application database** (MySQL) can scale horizontally for user traffic
- **System database** (PostgreSQL) optimized for transactional integrity
- Each database can have different backup/replication strategies

### Compliance & Auditing
- **Audit logs** in PostgreSQL remain immutable and separate
- Easier to meet compliance requirements (SOC2, GDPR, HIPAA)
- Application data can be purged without affecting system logs

### Performance Optimization
- **Application queries** don't compete with system operations
- Different indexing strategies per use case
- Dedicated connection pools per database

---

## Database Assignments

### PostgreSQL (System Database)
**Purpose**: Critical system infrastructure and security

**Tables**:
- `api_keys` - API key management
- `oauth2_tokens` - OAuth2 token storage
- `sessions` - User session tracking
- `audit_logs` - Complete audit trail
- `system_config` - System-wide configuration
- `rate_limit_overrides` - Custom rate limits

**Characteristics**:
- ACID compliance critical
- Smaller data volume, high integrity requirements
- Heavy use of JSONB for flexible config
- Frequent auditing queries
- Lower write volume, high read consistency

**Connection**: `postgresDB` from `src/shared/database/postgres.ts`

---

### MySQL (Application Database)
**Purpose**: Business logic and user data

**Tables**:
- `users` - User accounts and authentication
- `user_profiles` - Extended user information
- `user_preferences` - User settings
- `posts` - Content/articles
- `transactions` - Financial transactions
- *Add your business tables here*

**Characteristics**:
- High write/read volume
- Larger data sets
- Full-text search on content
- User-facing queries
- Data can be partitioned/sharded

**Connection**: `mysqlDB` from `src/shared/database/mysql.ts`

---

### MongoDB (Document Store)
**Purpose**: Flexible schema data

**Use Cases**:
- Activity logs
- Real-time analytics
- Temporary data
- Schema-less data
- Event sourcing

**Connection**: `mongoDB` from `src/shared/database/mongodb.ts`

---

### Redis (Cache & Sessions)
**Purpose**: High-speed cache and temporary storage

**Use Cases**:
- HTTP response caching
- Rate limiting counters
- JWT blacklist
- Real-time data
- Job queues

**Connection**: `redisCache` from `src/shared/cache/redis.ts`

---

## Usage Examples

### Querying Application Data (MySQL)

```typescript
import mysqlDB from '@database/mysql';

// Get user from application database
const user = await mysqlDB.queryOne<User>(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

// Create new post
const postId = await mysqlDB.insert(
  'INSERT INTO posts (user_id, title, content, status) VALUES (?, ?, ?, ?)',
  [userId, title, content, 'draft']
);

// Transaction example
await mysqlDB.transaction(async (conn) => {
  await conn.execute('UPDATE users SET ... WHERE id = ?', [userId]);
  await conn.execute('INSERT INTO transactions ...', [...]);
});
```

### Querying System Data (PostgreSQL)

```typescript
import postgresDB from '@database/postgres';

// Create API key
await postgresDB.query(
  `INSERT INTO api_keys (id, hashed_key, user_id, name)
   VALUES ($1, $2, $3, $4)`,
  [id, hashedKey, userId, name]
);

// Log audit event
await postgresDB.query(
  `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
   VALUES ($1, $2, $3, $4)`,
  [userId, 'user.update', 'user', JSON.stringify(metadata)]
);

// Get session
const session = await postgresDB.query(
  'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
  [sessionId]
);
```

---

## Migration Strategy

### From Previous Schema

If you had a single PostgreSQL database:

1. **Keep existing PostgreSQL** for system tables
2. **Create new MySQL** database for application tables
3. **Migrate user data**:
   ```sql
   -- Export from PostgreSQL
   COPY users TO '/tmp/users.csv' CSV HEADER;
   
   -- Import to MySQL
   LOAD DATA INFILE '/tmp/users.csv'
   INTO TABLE users
   FIELDS TERMINATED BY ',' ENCLOSED BY '"'
   LINES TERMINATED BY '\n'
   IGNORE 1 ROWS;
   ```

4. **Update application code** to use `mysqlDB` for user queries
5. **Verify data integrity** before dropping old PostgreSQL user table

---

## Backup Strategy

### PostgreSQL (System DB)
- **Frequency**: Every 6 hours
- **Retention**: 30 days
- **Method**: `pg_dump` with point-in-time recovery
- **Priority**: CRITICAL (contains audit logs)

```bash
pg_dump -h localhost -U postgres -Fc enterprise_system_db > backup_system_$(date +%Y%m%d_%H%M%S).dump
```

### MySQL (Application DB)
- **Frequency**: Every hour (incremental), daily (full)
- **Retention**: 7 days (incremental), 90 days (full)
- **Method**: `mysqldump` or binary logs
- **Priority**: HIGH (user data)

```bash
mysqldump -h localhost -u mysql --single-transaction enterprise_app_db > backup_app_$(date +%Y%m%d_%H%M%S).sql
```

### MongoDB
- **Frequency**: Daily
- **Retention**: 7 days
- **Method**: `mongodump`

```bash
mongodump --uri="mongodb://localhost:27017/enterprise_db" --out=/backup/mongo_$(date +%Y%m%d)
```

---

## Connection Management

### Connection Pools

Each database maintains its own connection pool:

| Database | Min Connections | Max Connections | Use Case |
|----------|----------------|-----------------|----------|
| PostgreSQL | 2 | 10 | System operations |
| MySQL | 5 | 20 | User requests |
| MongoDB | 2 | 10 | Flexible data |
| Redis | Single connection | Auto-reconnect | Cache operations |

### Environment Variables

```env
# PostgreSQL - System Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=enterprise_system_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=***

# MySQL - Application Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=enterprise_app_db
MYSQL_USER=mysql
MYSQL_PASSWORD=***
```

---

## Monitoring

### Health Checks

All database health checks are aggregated in `/health`:

```typescript
const health = {
  postgres: await postgresDB.healthCheck(),  // System DB
  mysql: await mysqlDB.healthCheck(),        // Application DB
  mongodb: await mongoDB.healthCheck(),      // Document store
  redis: await redisCache.healthCheck(),     // Cache
};
```

### Metrics

Prometheus metrics track each database separately:

- `database_query_duration_seconds{database="postgres"}`
- `database_query_duration_seconds{database="mysql"}`
- `database_connection_pool_size{database="postgres"}`
- `database_connection_pool_size{database="mysql"}`

---

## Best Practices

### When to Use Each Database

**PostgreSQL (System)**:
- ✅ API keys, tokens, secrets
- ✅ Audit logs (immutable)
- ✅ System configuration
- ✅ Rate limit overrides
- ❌ User-generated content
- ❌ High-volume transactional data

**MySQL (Application)**:
- ✅ User accounts and profiles
- ✅ Business entities (posts, products, orders)
- ✅ Transactional data
- ✅ Relational data with foreign keys
- ❌ System credentials
- ❌ Audit trails

**MongoDB**:
- ✅ Activity streams
- ✅ Flexible schema data
- ✅ Event logs
- ✅ Real-time analytics
- ❌ High-consistency requirements
- ❌ Complex joins

**Redis**:
- ✅ Temporary data (< 24 hours)
- ✅ Caching
- ✅ Rate limiting
- ✅ Session storage
- ❌ Permanent data
- ❌ Complex queries

---

## Security Considerations

1. **Separate Credentials**: Each database uses different credentials
2. **Network Isolation**: Databases on separate VLANs in production
3. **Encryption**: 
   - TLS/SSL for all database connections
   - At-rest encryption for PostgreSQL (audit logs)
4. **Access Control**:
   - Application uses MySQL read/write user
   - System operations use PostgreSQL admin user
   - No cross-database user access
5. **Audit**: All system database changes are logged to PostgreSQL audit_logs

---

## Docker Compose Setup

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: enterprise_system_db  # System database
      
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: enterprise_app_db  # Application database
```

---

## Testing

Test database separation:

```typescript
// Test 1: User CRUD in MySQL
const user = await mysqlDB.queryOne('SELECT * FROM users WHERE id = ?', [userId]);

// Test 2: Audit logging in PostgreSQL
await postgresDB.query(
  'INSERT INTO audit_logs (action, user_id) VALUES ($1, $2)',
  ['user.created', userId]
);

// Test 3: Verify isolation
const systemUser = await postgresDB.query('SELECT * FROM users');  // Should fail - table doesn't exist
const appApiKeys = await mysqlDB.query('SELECT * FROM api_keys');   // Should fail - table doesn't exist
```

---

## Future Enhancements

1. **Read Replicas**: MySQL read replicas for scaling queries
2. **Sharding**: Partition MySQL by user_id for horizontal scaling
3. **Archive Database**: Move old transactions to archive PostgreSQL
4. **Cross-Database Queries**: Use application layer to join data from multiple databases
