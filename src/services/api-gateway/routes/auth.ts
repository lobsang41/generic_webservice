import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { jwtService } from '@auth/jwt';
import { apiKeyService } from '@auth/apiKey';
import { authenticate } from '@middleware/auth';
import { strictRateLimiter } from '@middleware/rateLimiter';
import { asyncHandler, ValidationError, AuthenticationError } from '@middleware/errorHandler';
import mysqlDB from '@database/mysql';
import { nanoid } from 'nanoid';
import { authenticationAttempts } from '@monitoring/prometheus';
import { validateRequest } from '@validation/middleware/validateRequest';
import {
    registerSchema,
    loginSchema,
    refreshSchema,
    createApiKeySchema,
    revokeApiKeyParamsSchema,
} from '@validation/schemas/auth.schemas';

const router = Router();

// Register new user
router.post('/register',
    strictRateLimiter,
    validateRequest({ body: registerSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { email, password, name } = req.body;

    // Check if user exists
    const existing = await mysqlDB.query(
        'SELECT id FROM users WHERE email = ?',
        [email],
    );

    if (existing.length > 0) {
        authenticationAttempts.inc({ method: 'register', status: 'failed' });
        throw new ValidationError('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = nanoid();

    // Create user
    await mysqlDB.query(
        `INSERT INTO users (id, email, password_hash, name, role, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, email, hashedPassword, name, 'user'],
    );

    // Generate tokens
    const tokens = jwtService.generateTokenPair({
        userId,
        email,
        role: 'user',
    });

    authenticationAttempts.inc({ method: 'register', status: 'success' });

    res.status(201).json({
        success: true,
        data: {
            user: { id: userId, email, name, role: 'user' },
            ...tokens,
        },
    });
}));

// Login
router.post('/login',
    strictRateLimiter,
    validateRequest({ body: loginSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { email, password } = req.body;

    // Find user
    const result = await mysqlDB.query(
        'SELECT id, email, password_hash, name, role, permissions FROM users WHERE email = ?',
        [email],
    );

    if (result.length === 0) {
        authenticationAttempts.inc({ method: 'login', status: 'failed' });
        throw new AuthenticationError('Invalid credentials');
    }

    const user = result[0] as any;

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        authenticationAttempts.inc({ method: 'login', status: 'failed' });
        throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens (include permissions if user has them)
    const tokens = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions, // Include permissions in JWT
    });

    authenticationAttempts.inc({ method: 'login', status: 'success' });

    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            ...tokens,
        },
    });
}));

// Refresh token
router.post('/refresh',
    validateRequest({ body: refreshSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { refreshToken } = req.body;

    const newAccessToken = await jwtService.refreshAccessToken(refreshToken);

    res.json({
        success: true,
        data: {
            accessToken: newAccessToken,
        },
    });
}));

// Logout
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await jwtService.blacklistToken(token);
    }

    res.json({
        success: true,
        message: 'Logged out successfully',
    });
}));

// Generate API Key
router.post('/api-key',
    authenticate,
    validateRequest({ body: createApiKeySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, expiresInDays } = req.body;

    const { key, apiKey } = await apiKeyService.generateAPIKey(
        req.user!.userId,
        name,
        expiresInDays,
    );

    res.status(201).json({
        success: true,
        data: {
            key, // Only returned once!
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                expiresAt: apiKey.expiresAt,
                createdAt: apiKey.createdAt,
            },
        },
        message: 'API key created. Save it securely - it will not be shown again.',
    });
}));

// List API Keys
router.get('/api-keys', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const apiKeys = await apiKeyService.listAPIKeys(req.user!.userId);

    res.json({
        success: true,
        data: apiKeys,
    });
}));

// Revoke API Key
router.delete('/api-key/:id',
    authenticate,
    validateRequest({ params: revokeApiKeyParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
    const revoked = await apiKeyService.revokeAPIKey(id, req.user!.userId);

    if (!revoked) {
        throw new ValidationError('API key not found or already revoked');
    }

    res.json({
        success: true,
        message: 'API key revoked successfully',
    });
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            user: req.user,
        },
    });
}));

export default router;
