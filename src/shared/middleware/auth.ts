import { Request, Response, NextFunction } from 'express';
import { jwtService, JWTPayload } from '@auth/jwt';
import { apiKeyService } from '@auth/apiKey';
import { config } from '@config/index';
import { AuthenticationError, AuthorizationError } from './errorHandler';

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload & { authType: 'jwt' | 'apiKey' };
        }
    }
}

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthenticationError('No token provided');
        }

        const token = authHeader.substring(7);

        // Check if token is blacklisted
        const isBlacklisted = await jwtService.isTokenBlacklisted(token);
        if (isBlacklisted) {
            throw new AuthenticationError('Token is no longer valid');
        }

        // Verify token
        const payload = jwtService.verifyAccessToken(token);

        req.user = { ...payload, authType: 'jwt' };
        next();
    } catch (error) {
        if (error instanceof AuthenticationError) {
            next(error);
        } else {
            next(new AuthenticationError('Authentication failed'));
        }
    }
};

export const authenticateAPIKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiKeyHeader = req.headers[config.apiKey.header.toLowerCase()] as string;

        if (!apiKeyHeader) {
            throw new AuthenticationError('No API key provided');
        }

        const apiKey = apiKeyService.extractKeyFromHeader(apiKeyHeader);
        if (!apiKey) {
            throw new AuthenticationError('Invalid API key format');
        }

        // Validate API key
        const validatedKey = await apiKeyService.validateAPIKey(apiKey);
        if (!validatedKey) {
            throw new AuthenticationError('Invalid API key');
        }

        req.user = {
            userId: validatedKey.userId,
            email: '', // API keys don't have email
            permissions: validatedKey.permissions,
            authType: 'apiKey',
        };

        next();
    } catch (error) {
        if (error instanceof AuthenticationError) {
            next(error);
        } else {
            next(new AuthenticationError('API key authentication failed'));
        }
    }
};

// Flexible authentication supporting both JWT and API Key
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers[config.apiKey.header.toLowerCase()];

    // Try JWT first
    if (authHeader?.startsWith('Bearer ')) {
        return authenticateJWT(req, res, next);
    }

    // Fall back to API key
    if (apiKeyHeader) {
        return authenticateAPIKey(req, res, next);
    }

    next(new AuthenticationError('No authentication credentials provided'));
};

// Optional authentication - doesn't fail if no credentials
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers[config.apiKey.header.toLowerCase()];

    if (!authHeader && !apiKeyHeader) {
        return next();
    }

    return authenticate(req, res, next);
};

// Role-based authorization
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AuthenticationError('Authentication required'));
        }

        if (!req.user.role || !roles.includes(req.user.role)) {
            return next(new AuthorizationError('Insufficient permissions'));
        }

        next();
    };
};

// Permission-based authorization
export const requirePermissions = (...permissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AuthenticationError('Authentication required'));
        }

        const userPermissions = req.user.permissions || [];
        const hasPermission = permissions.every((perm) => userPermissions.includes(perm));

        if (!hasPermission) {
            return next(new AuthorizationError('Required permissions: ' + permissions.join(', ')));
        }

        next();
    };
};
