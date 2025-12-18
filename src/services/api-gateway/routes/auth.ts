import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { jwtService } from '@auth/jwt';
import { apiKeyService } from '@auth/apiKey';
import { authenticate } from '@middleware/auth';
import { strictRateLimiter } from '@middleware/rateLimiter';
import { asyncHandler, ValidationError, AuthenticationError } from '@middleware/errorHandler';
import postgresDB from '@database/postgres';
import { nanoid } from 'nanoid';
import { authenticationAttempts } from '@monitoring/prometheus';

const router = Router();

// Register new user
router.post('/register', strictRateLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
        throw new ValidationError('Email, password, and name are required');
    }

    if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
    }

    // Check if user exists
    const existing = await postgresDB.query(
        'SELECT id FROM users WHERE email = ?',
        [email],
    );

    if (existing.rows.length > 0) {
        authenticationAttempts.inc({ method: 'register', status: 'failed' });
        throw new ValidationError('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = nanoid();

    // Create user
    await postgresDB.query(
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
router.post('/login', strictRateLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }

    // Find user
    const result = await postgresDB.query(
        'SELECT id, email, password_hash, name, role FROM users WHERE email = ?',
        [email],
    );

    if (result.rows.length === 0) {
        authenticationAttempts.inc({ method: 'login', status: 'failed' });
        throw new AuthenticationError('Invalid credentials');
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        authenticationAttempts.inc({ method: 'login', status: 'failed' });
        throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const tokens = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
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
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new ValidationError('Refresh token is required');
    }

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
router.post('/api-key', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { name, expiresInDays } = req.body;

    if (!name) {
        throw new ValidationError('API key name is required');
    }

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
router.delete('/api-key/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
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
