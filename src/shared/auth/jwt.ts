import jwt from 'jsonwebtoken';
import { config } from '@config/index';
// DESACTIVADO: Usando node-cache en lugar de Redis
// import redisCache from '@cache/redis';
import nodeCache from '@cache/nodeCache';
import { AuthenticationError } from '@middleware/errorHandler';

export interface JWTPayload {
    userId: string;
    email: string;
    role?: string;
    permissions?: string[];
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

class JWTService {
    generateAccessToken(payload: JWTPayload): string {
        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
            issuer: 'enterprise-api',
            audience: 'enterprise-client',
        } as any);
    }

    generateRefreshToken(payload: JWTPayload): string {
        return jwt.sign(payload, config.jwt.refreshSecret, {
            expiresIn: config.jwt.refreshExpiresIn,
            issuer: 'enterprise-api',
            audience: 'enterprise-client',
        } as any);
    }

    generateTokenPair(payload: JWTPayload): TokenPair {
        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken(payload),
        };
    }

    verifyAccessToken(token: string): JWTPayload {
        try {
            const decoded = jwt.verify(token, config.jwt.secret, {
                issuer: 'enterprise-api',
                audience: 'enterprise-client',
            }) as JWTPayload;
            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthenticationError('Token expired');
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new AuthenticationError('Invalid token');
            }
            throw new AuthenticationError('Token verification failed');
        }
    }

    verifyRefreshToken(token: string): JWTPayload {
        try {
            const decoded = jwt.verify(token, config.jwt.refreshSecret, {
                issuer: 'enterprise-api',
                audience: 'enterprise-client',
            }) as JWTPayload;
            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthenticationError('Refresh token expired');
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new AuthenticationError('Invalid refresh token');
            }
            throw new AuthenticationError('Refresh token verification failed');
        }
    }

    async blacklistToken(token: string): Promise<void> {
        try {
            const decoded = jwt.decode(token) as jwt.JwtPayload;
            if (!decoded || !decoded.exp) {
                return;
            }

            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await nodeCache.set(`blacklist:${token}`, '1', ttl);
            }
        } catch (error) {
            throw new Error('Failed to blacklist token');
        }
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {
        const result = await nodeCache.exists(`blacklist:${token}`);
        return result;
    }

    decodeToken(token: string): JWTPayload | null {
        try {
            return jwt.decode(token) as JWTPayload;
        } catch {
            return null;
        }
    }

    async refreshAccessToken(refreshToken: string): Promise<string> {
        // Verify refresh token
        const payload = this.verifyRefreshToken(refreshToken);

        // Check if refresh token is blacklisted
        const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
        if (isBlacklisted) {
            throw new AuthenticationError('Refresh token is invalid');
        }

        // Generate new access token
        return this.generateAccessToken({
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            permissions: payload.permissions,
        });
    }
}

export const jwtService = new JWTService();
export default jwtService;
