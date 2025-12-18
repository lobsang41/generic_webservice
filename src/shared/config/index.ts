import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Environment validation schema
const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    API_VERSION: Joi.string().default('v1'),

    // PostgreSQL - DESACTIVADO (opcional)
    POSTGRES_HOST: Joi.string().optional().allow(''),
    POSTGRES_PORT: Joi.number().default(5432),
    POSTGRES_DB: Joi.string().optional().allow(''),
    POSTGRES_USER: Joi.string().optional().allow(''),
    POSTGRES_PASSWORD: Joi.string().optional().allow(''),
    POSTGRES_POOL_MIN: Joi.number().default(2),
    POSTGRES_POOL_MAX: Joi.number().default(10),

    // MySQL - ACTIVO (requerido)
    MYSQL_HOST: Joi.string().required(),
    MYSQL_PORT: Joi.number().default(3306),
    MYSQL_DB: Joi.string().required(),
    MYSQL_USER: Joi.string().required(),
    MYSQL_PASSWORD: Joi.string().required(),
    MYSQL_POOL_MIN: Joi.number().default(2),
    MYSQL_POOL_MAX: Joi.number().default(10),

    // MongoDB - DESACTIVADO (opcional)
    MONGO_URI: Joi.string().optional().allow(''),
    MONGO_POOL_SIZE: Joi.number().default(10),

    // Redis - DESACTIVADO (opcional)
    REDIS_HOST: Joi.string().optional().allow(''),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow('').default(''),
    REDIS_DB: Joi.number().default(0),
    REDIS_TTL: Joi.number().default(3600),

    // RabbitMQ - DESACTIVADO (opcional)
    RABBITMQ_URL: Joi.string().optional().allow(''),
    RABBITMQ_EXCHANGE: Joi.string().default('enterprise_exchange'),
    RABBITMQ_QUEUE_PREFIX: Joi.string().default('enterprise'),

    // JWT
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default('1h'),
    JWT_REFRESH_SECRET: Joi.string().required(),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

    // OAuth2
    OAUTH2_CLIENT_ID: Joi.string().allow(''),
    OAUTH2_CLIENT_SECRET: Joi.string().allow(''),
    OAUTH2_CALLBACK_URL: Joi.string().allow(''),
    OAUTH2_AUTHORIZATION_URL: Joi.string().allow(''),
    OAUTH2_TOKEN_URL: Joi.string().allow(''),
    OAUTH2_USER_INFO_URL: Joi.string().allow(''),

    // API Key
    API_KEY_HEADER: Joi.string().default('X-API-Key'),
    API_KEY_LENGTH: Joi.number().default(32),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
    RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
    RATE_LIMIT_MAX_REQUESTS_AUTH: Joi.number().default(1000),

    // Encryption
    ENCRYPTION_ALGORITHM: Joi.string().default('aes-256-gcm'),
    ENCRYPTION_KEY: Joi.string().required(),

    // AWS
    AWS_REGION: Joi.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: Joi.string().allow(''),
    AWS_SECRET_ACCESS_KEY: Joi.string().allow(''),
    AWS_S3_BUCKET: Joi.string().allow(''),
    AWS_SQS_QUEUE_URL: Joi.string().allow(''),

    // GCP
    GCP_PROJECT_ID: Joi.string().allow(''),
    GCP_CREDENTIALS_PATH: Joi.string().allow(''),
    GCP_STORAGE_BUCKET: Joi.string().allow(''),
    GCP_PUBSUB_TOPIC: Joi.string().allow(''),

    // Azure
    AZURE_STORAGE_CONNECTION_STRING: Joi.string().allow(''),
    AZURE_STORAGE_CONTAINER: Joi.string().allow(''),
    AZURE_SERVICE_BUS_CONNECTION_STRING: Joi.string().allow(''),

    // Monitoring
    PROMETHEUS_PORT: Joi.number().default(9090),
    GRAFANA_PORT: Joi.number().default(3001),
    JAEGER_AGENT_HOST: Joi.string().default('localhost'),
    JAEGER_AGENT_PORT: Joi.number().default(6831),
    ENABLE_TRACING: Joi.boolean().default(true),

    // gRPC
    GRPC_PORT: Joi.number().default(50051),

    // GraphQL
    GRAPHQL_PATH: Joi.string().default('/graphql'),
    GRAPHQL_PLAYGROUND: Joi.boolean().default(true),

    // Logging
    LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
    LOG_DIR: Joi.string().default('./logs'),

    // CORS
    CORS_ORIGIN: Joi.string().default('*'),
    CORS_CREDENTIALS: Joi.boolean().default(true),

    // Service Discovery
    SERVICE_REGISTRY_TYPE: Joi.string().valid('redis', 'consul').default('redis'),
    SERVICE_HEARTBEAT_INTERVAL: Joi.number().default(30000),

    // Health Check
    HEALTH_CHECK_PATH: Joi.string().default('/health'),
    READINESS_CHECK_PATH: Joi.string().default('/ready'),
}).unknown();

const { error, value: validatedEnv } = envSchema.validate(process.env);

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
    env: validatedEnv.NODE_ENV as string,
    port: validatedEnv.PORT as number,
    apiVersion: validatedEnv.API_VERSION as string,

    postgres: {
        host: validatedEnv.POSTGRES_HOST as string,
        port: validatedEnv.POSTGRES_PORT as number,
        database: validatedEnv.POSTGRES_DB as string,
        user: validatedEnv.POSTGRES_USER as string,
        password: validatedEnv.POSTGRES_PASSWORD as string,
        pool: {
            min: validatedEnv.POSTGRES_POOL_MIN as number,
            max: validatedEnv.POSTGRES_POOL_MAX as number,
        },
    },

    mysql: {
        host: validatedEnv.MYSQL_HOST as string,
        port: validatedEnv.MYSQL_PORT as number,
        database: validatedEnv.MYSQL_DB as string,
        user: validatedEnv.MYSQL_USER as string,
        password: validatedEnv.MYSQL_PASSWORD as string,
        pool: {
            min: validatedEnv.MYSQL_POOL_MIN as number,
            max: validatedEnv.MYSQL_POOL_MAX as number,
        },
    },

    mongodb: {
        uri: validatedEnv.MONGO_URI as string,
        poolSize: validatedEnv.MONGO_POOL_SIZE as number,
    },

    redis: {
        host: validatedEnv.REDIS_HOST as string,
        port: validatedEnv.REDIS_PORT as number,
        password: validatedEnv.REDIS_PASSWORD as string,
        db: validatedEnv.REDIS_DB as number,
        ttl: validatedEnv.REDIS_TTL as number,
    },

    rabbitmq: {
        url: validatedEnv.RABBITMQ_URL as string,
        exchange: validatedEnv.RABBITMQ_EXCHANGE as string,
        queuePrefix: validatedEnv.RABBITMQ_QUEUE_PREFIX as string,
    },

    jwt: {
        secret: validatedEnv.JWT_SECRET as string,
        expiresIn: validatedEnv.JWT_EXPIRES_IN as string,
        refreshSecret: validatedEnv.JWT_REFRESH_SECRET as string,
        refreshExpiresIn: validatedEnv.JWT_REFRESH_EXPIRES_IN as string,
    },

    oauth2: {
        clientId: validatedEnv.OAUTH2_CLIENT_ID as string,
        clientSecret: validatedEnv.OAUTH2_CLIENT_SECRET as string,
        callbackUrl: validatedEnv.OAUTH2_CALLBACK_URL as string,
        authorizationUrl: validatedEnv.OAUTH2_AUTHORIZATION_URL as string,
        tokenUrl: validatedEnv.OAUTH2_TOKEN_URL as string,
        userInfoUrl: validatedEnv.OAUTH2_USER_INFO_URL as string,
    },

    apiKey: {
        header: validatedEnv.API_KEY_HEADER as string,
        length: validatedEnv.API_KEY_LENGTH as number,
    },

    rateLimit: {
        windowMs: validatedEnv.RATE_LIMIT_WINDOW_MS as number,
        maxRequests: validatedEnv.RATE_LIMIT_MAX_REQUESTS as number,
        maxRequestsAuth: validatedEnv.RATE_LIMIT_MAX_REQUESTS_AUTH as number,
    },

    encryption: {
        algorithm: validatedEnv.ENCRYPTION_ALGORITHM as string,
        key: validatedEnv.ENCRYPTION_KEY as string,
    },

    aws: {
        region: validatedEnv.AWS_REGION as string,
        accessKeyId: validatedEnv.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: validatedEnv.AWS_SECRET_ACCESS_KEY as string,
        s3Bucket: validatedEnv.AWS_S3_BUCKET as string,
        sqsQueueUrl: validatedEnv.AWS_SQS_QUEUE_URL as string,
    },

    gcp: {
        projectId: validatedEnv.GCP_PROJECT_ID as string,
        credentialsPath: validatedEnv.GCP_CREDENTIALS_PATH as string,
        storageBucket: validatedEnv.GCP_STORAGE_BUCKET as string,
        pubsubTopic: validatedEnv.GCP_PUBSUB_TOPIC as string,
    },

    azure: {
        storageConnectionString: validatedEnv.AZURE_STORAGE_CONNECTION_STRING as string,
        storageContainer: validatedEnv.AZURE_STORAGE_CONTAINER as string,
        serviceBusConnectionString: validatedEnv.AZURE_SERVICE_BUS_CONNECTION_STRING as string,
    },

    monitoring: {
        prometheusPort: validatedEnv.PROMETHEUS_PORT as number,
        grafanaPort: validatedEnv.GRAFANA_PORT as number,
        jaegerAgentHost: validatedEnv.JAEGER_AGENT_HOST as string,
        jaegerAgentPort: validatedEnv.JAEGER_AGENT_PORT as number,
        enableTracing: validatedEnv.ENABLE_TRACING as boolean,
    },

    grpc: {
        port: validatedEnv.GRPC_PORT as number,
    },

    graphql: {
        path: validatedEnv.GRAPHQL_PATH as string,
        playground: validatedEnv.GRAPHQL_PLAYGROUND as boolean,
    },

    logging: {
        level: validatedEnv.LOG_LEVEL as string,
        format: validatedEnv.LOG_FORMAT as string,
        dir: validatedEnv.LOG_DIR as string,
    },

    cors: {
        origin: validatedEnv.CORS_ORIGIN as string,
        credentials: validatedEnv.CORS_CREDENTIALS as boolean,
    },

    serviceRegistry: {
        type: validatedEnv.SERVICE_REGISTRY_TYPE as string,
        heartbeatInterval: validatedEnv.SERVICE_HEARTBEAT_INTERVAL as number,
    },

    healthCheck: {
        path: validatedEnv.HEALTH_CHECK_PATH as string,
        readinessPath: validatedEnv.READINESS_CHECK_PATH as string,
    },

    isDevelopment: validatedEnv.NODE_ENV === 'development',
    isProduction: validatedEnv.NODE_ENV === 'production',
    isTest: validatedEnv.NODE_ENV === 'test',
};

export default config;
