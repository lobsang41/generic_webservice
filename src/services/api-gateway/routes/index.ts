import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import { adaptiveRateLimiter } from '@middleware/rateLimiter';

const router = Router();

// Apply adaptive rate limiting to all API routes
router.use(adaptiveRateLimiter);

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// API info endpoint
router.get('/', (req, res) => {
    res.json({
        message: 'Enterprise API',
        version: 'v1',
        endpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
        },
    });
});

export default router;
