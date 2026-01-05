import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import clientRoutes from './clients';
import clientTierRoutes from './client-tiers';
import clientApiKeyRoutes from './client-api-keys';
import clientTestRoutes from './client-test';
import auditLogRoutes from './audit-logs';
import { adaptiveRateLimiter } from '@middleware/rateLimiter';

const router = Router();

// Apply adaptive rate limiting to all API routes
router.use(adaptiveRateLimiter);

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clients', clientRoutes);
router.use('/client-tiers', clientTierRoutes);
router.use('/clients', clientApiKeyRoutes); // Nested routes: /clients/:clientId/api-keys
router.use('/client-test', clientTestRoutes); // Test endpoint for Client API Keys
router.use('/audit-logs', auditLogRoutes); // Audit logs (admin only)

// API info endpoint
router.get('/', (req, res) => {
    res.json({
        message: 'Enterprise API',
        version: 'v1',
        endpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            clients: '/api/v1/clients',
            clientTiers: '/api/v1/client-tiers',
            clientTest: '/api/v1/client-test (requires Client API Key)',
            auditLogs: '/api/v1/audit-logs (admin only)',
        },
    });
});

export default router;
