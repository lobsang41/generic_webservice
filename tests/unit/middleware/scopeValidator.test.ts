import { Request, Response, NextFunction } from 'express';
import {
    requireScope,
    requireAnyScope,
    requireAllScopes,
    loadScopes,
    optionalScope,
    checkScope,
    checkAnyScope,
    checkAllScopes,
} from '@middleware/scopeValidator';
import { SCOPES, Scope } from '@auth/scopes';
import { ForbiddenError } from '@middleware/errorHandler';

// Mock Request con scopes
const createMockRequest = (scopes: Scope[] = [], userId?: string, clientId?: string): Partial<Request> => ({
    scopes,
    userId,
    clientId,
    user: userId ? { userId, email: 'test@example.com', authType: 'jwt' as const } : undefined,
});

const createMockResponse = (): Partial<Response> => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
});

const createMockNext = (): NextFunction => jest.fn();

describe('Scope Validator Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('requireScope', () => {
        it('should allow request with exact scope', () => {
            const req = createMockRequest(['clients:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireScope(SCOPES.CLIENTS_READ);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should allow request with superior scope', () => {
            const req = createMockRequest(['clients:admin']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireScope(SCOPES.CLIENTS_READ);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should deny request without required scope', () => {
            const req = createMockRequest(['clients:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireScope(SCOPES.CLIENTS_WRITE);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
        });

        it('should deny request with empty scopes', () => {
            const req = createMockRequest([]);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireScope(SCOPES.CLIENTS_READ);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
        });

        it('should include scope in error message', () => {
            const req = createMockRequest([]);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireScope(SCOPES.CLIENTS_READ);
            middleware(req as Request, res as Response, next);

            const error = (next as jest.Mock).mock.calls[0][0];
            expect(error.message).toContain('clients:read');
        });
    });

    describe('requireAnyScope', () => {
        it('should allow request with one of required scopes', () => {
            const req = createMockRequest(['clients:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAnyScope([SCOPES.CLIENTS_READ, SCOPES.CLIENTS_WRITE]);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should allow request with superior scope', () => {
            const req = createMockRequest(['clients:admin']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAnyScope([SCOPES.CLIENTS_READ, SCOPES.CLIENTS_WRITE]);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should deny request without any required scope', () => {
            const req = createMockRequest(['tiers:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAnyScope([SCOPES.CLIENTS_READ, SCOPES.CLIENTS_WRITE]);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
        });

        it('should include all required scopes in error message', () => {
            const req = createMockRequest([]);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAnyScope([SCOPES.CLIENTS_READ, SCOPES.CLIENTS_WRITE]);
            middleware(req as Request, res as Response, next);

            const error = (next as jest.Mock).mock.calls[0][0];
            expect(error.message).toContain('clients:read');
            expect(error.message).toContain('clients:write');
        });
    });

    describe('requireAllScopes', () => {
        it('should allow request with all required scopes', () => {
            const req = createMockRequest(['clients:read', 'tiers:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAllScopes([SCOPES.CLIENTS_READ, SCOPES.TIERS_READ]);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should allow request with superior scopes', () => {
            const req = createMockRequest(['clients:admin', 'tiers:admin']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAllScopes([SCOPES.CLIENTS_READ, SCOPES.TIERS_WRITE]);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should deny request missing one required scope', () => {
            const req = createMockRequest(['clients:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAllScopes([SCOPES.CLIENTS_READ, SCOPES.TIERS_READ]);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
        });

        it('should allow empty required scopes array', () => {
            const req = createMockRequest(['clients:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = requireAllScopes([]);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });
    });

    describe('loadScopes', () => {
        it('should load scopes from user permissions', () => {
            const req: Partial<Request> = {
                user: {
                    id: 'user-123',
                    userId: 'user-123',
                    email: 'test@example.com',
                    permissions: { scopes: ['clients:read', 'tiers:write'] },
                    authType: 'apiKey',
                },
            } as any;
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = loadScopes();
            middleware(req as Request, res as Response, next);

            expect(req.scopes).toEqual(['clients:read', 'tiers:write']);
            expect(req.userId).toBe('user-123');
            expect(next).toHaveBeenCalledWith();
        });

        it('should load scopes from client permissions', () => {
            const req: Partial<Request> = {
                client: {
                    id: 'client-123',
                    permissions: { scopes: ['usage:read'] },
                } as any,
            };
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = loadScopes();
            middleware(req as Request, res as Response, next);

            expect(req.scopes).toEqual(['usage:read']);
            expect(req.clientId).toBe('client-123');
            expect(next).toHaveBeenCalledWith();
        });

        it('should handle missing permissions gracefully', () => {
            const req: Partial<Request> = {
                user: {
                    userId: 'user-123',
                    email: 'test@example.com',
                    authType: 'jwt',
                } as any,
            };
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = loadScopes();
            middleware(req as Request, res as Response, next);

            expect(req.scopes).toEqual([]);
            expect(next).toHaveBeenCalledWith();
        });

        it('should not override existing scopes', () => {
            const req: Partial<Request> = {
                scopes: ['clients:read'] as Scope[], // Usar un scope válido
                user: {
                    userId: 'user-123',
                    email: 'test@example.com',
                    permissions: { scopes: ['tiers:read'] },
                    authType: 'apiKey',
                } as any,
            };
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = loadScopes();
            middleware(req as Request, res as Response, next);

            expect(req.scopes).toEqual(['clients:read']);
            expect(next).toHaveBeenCalledWith();
        });
    });

    describe('optionalScope', () => {
        it('should set hasOptionalScope to true when scope is present', () => {
            const req = createMockRequest(['clients:admin']) as any;
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = optionalScope(SCOPES.CLIENTS_ADMIN);
            middleware(req as Request, res as Response, next);

            expect(req.hasOptionalScope).toBe(true);
            expect(next).toHaveBeenCalledWith();
        });

        it('should set hasOptionalScope to false when scope is missing', () => {
            const req = createMockRequest(['clients:read']) as any;
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = optionalScope(SCOPES.CLIENTS_ADMIN);
            middleware(req as Request, res as Response, next);

            expect(req.hasOptionalScope).toBe(false);
            expect(next).toHaveBeenCalledWith();
        });

        it('should not block request when scope is missing', () => {
            const req = createMockRequest([]) as any;
            const res = createMockResponse();
            const next = createMockNext();

            const middleware = optionalScope(SCOPES.CLIENTS_READ);
            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
            expect(next).not.toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('checkScope helper', () => {
        it('should return true when scope is present', () => {
            const req = createMockRequest(['clients:read']);
            const result = checkScope(req as Request, SCOPES.CLIENTS_READ);
            expect(result).toBe(true);
        });

        it('should return true when superior scope is present', () => {
            const req = createMockRequest(['clients:admin']);
            const result = checkScope(req as Request, SCOPES.CLIENTS_READ);
            expect(result).toBe(true);
        });

        it('should return false when scope is missing', () => {
            const req = createMockRequest(['clients:read']);
            const result = checkScope(req as Request, SCOPES.CLIENTS_WRITE);
            expect(result).toBe(false);
        });

        it('should handle empty scopes', () => {
            const req = createMockRequest([]);
            const result = checkScope(req as Request, SCOPES.CLIENTS_READ);
            expect(result).toBe(false);
        });
    });

    describe('checkAnyScope helper', () => {
        it('should return true when any scope is present', () => {
            const req = createMockRequest(['clients:read']);
            const result = checkAnyScope(req as Request, [SCOPES.CLIENTS_READ, SCOPES.TIERS_READ]);
            expect(result).toBe(true);
        });

        it('should return false when no scope is present', () => {
            const req = createMockRequest(['usage:read']);
            const result = checkAnyScope(req as Request, [SCOPES.CLIENTS_READ, SCOPES.TIERS_READ]);
            expect(result).toBe(false);
        });
    });

    describe('checkAllScopes helper', () => {
        it('should return true when all scopes are present', () => {
            const req = createMockRequest(['clients:read', 'tiers:read']);
            const result = checkAllScopes(req as Request, [SCOPES.CLIENTS_READ, SCOPES.TIERS_READ]);
            expect(result).toBe(true);
        });

        it('should return false when missing one scope', () => {
            const req = createMockRequest(['clients:read']);
            const result = checkAllScopes(req as Request, [SCOPES.CLIENTS_READ, SCOPES.TIERS_READ]);
            expect(result).toBe(false);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle multiple middleware in chain', () => {
            const req = createMockRequest(['clients:admin', 'api_keys:write']);
            const res = createMockResponse();
            const next = createMockNext();

            // Primera validación
            const middleware1 = requireScope(SCOPES.CLIENTS_READ);
            middleware1(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledWith();

            // Segunda validación
            const middleware2 = requireScope(SCOPES.API_KEYS_WRITE);
            middleware2(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledTimes(2);
        });

        it('should fail fast on first missing scope', () => {
            const req = createMockRequest(['clients:read']);
            const res = createMockResponse();
            const next = createMockNext();

            const middleware1 = requireScope(SCOPES.CLIENTS_READ);
            middleware1(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledWith();

            const middleware2 = requireScope(SCOPES.CLIENTS_WRITE);
            middleware2(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
        });
    });
});
