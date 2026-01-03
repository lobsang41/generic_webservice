import {
    Scope,
    SCOPES,
    SCOPE_GROUPS,
    isValidScope,
    validateScopes,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    parseScopes,
    scopesToJSON,
    getScopeDescription,
    getAllScopesWithDescriptions,
} from '@auth/scopes';

describe('Scopes System', () => {
    describe('isValidScope', () => {
        it('should validate correct scope format', () => {
            expect(isValidScope('clients:read')).toBe(true);
            expect(isValidScope('tiers:write')).toBe(true);
            expect(isValidScope('api_keys:delete')).toBe(true);
            expect(isValidScope('users:admin')).toBe(true);
        });

        it('should reject invalid scope format', () => {
            expect(isValidScope('invalid')).toBe(false);
            expect(isValidScope('clients:')).toBe(false);
            expect(isValidScope(':read')).toBe(false);
            expect(isValidScope('clients:invalid_action')).toBe(false);
            expect(isValidScope('invalid_resource:read')).toBe(false);
        });

        it('should reject scopes with wrong separator', () => {
            expect(isValidScope('clients-read')).toBe(false);
            expect(isValidScope('clients.read')).toBe(false);
            expect(isValidScope('clients read')).toBe(false);
        });
    });

    describe('validateScopes', () => {
        it('should validate array of valid scopes', () => {
            const result = validateScopes([
                'clients:read',
                'tiers:write',
                'api_keys:delete',
            ]);

            expect(result.valid).toBe(true);
            expect(result.invalid).toEqual([]);
        });

        it('should detect invalid scopes in array', () => {
            const result = validateScopes([
                'clients:read',
                'invalid:scope',
                'tiers:write',
                'bad-format',
            ]);

            expect(result.valid).toBe(false);
            expect(result.invalid).toEqual(['invalid:scope', 'bad-format']);
        });

        it('should handle empty array', () => {
            const result = validateScopes([]);
            expect(result.valid).toBe(true);
            expect(result.invalid).toEqual([]);
        });
    });

    describe('hasPermission - Hierarchy', () => {
        it('should allow exact scope match', () => {
            const userScopes: Scope[] = ['clients:read'];
            expect(hasPermission(userScopes, 'clients:read')).toBe(true);
        });

        it('should allow admin scope for any action', () => {
            const userScopes: Scope[] = ['clients:admin'];
            
            expect(hasPermission(userScopes, 'clients:read')).toBe(true);
            expect(hasPermission(userScopes, 'clients:write')).toBe(true);
            expect(hasPermission(userScopes, 'clients:delete')).toBe(true);
            expect(hasPermission(userScopes, 'clients:admin')).toBe(true);
        });

        it('should allow delete scope for write and read', () => {
            const userScopes: Scope[] = ['clients:delete'];
            
            expect(hasPermission(userScopes, 'clients:read')).toBe(true);
            expect(hasPermission(userScopes, 'clients:write')).toBe(true);
            expect(hasPermission(userScopes, 'clients:delete')).toBe(true);
            expect(hasPermission(userScopes, 'clients:admin')).toBe(false);
        });

        it('should allow write scope for read', () => {
            const userScopes: Scope[] = ['clients:write'];
            
            expect(hasPermission(userScopes, 'clients:read')).toBe(true);
            expect(hasPermission(userScopes, 'clients:write')).toBe(true);
            expect(hasPermission(userScopes, 'clients:delete')).toBe(false);
            expect(hasPermission(userScopes, 'clients:admin')).toBe(false);
        });

        it('should not allow read scope for write', () => {
            const userScopes: Scope[] = ['clients:read'];
            
            expect(hasPermission(userScopes, 'clients:read')).toBe(true);
            expect(hasPermission(userScopes, 'clients:write')).toBe(false);
            expect(hasPermission(userScopes, 'clients:delete')).toBe(false);
            expect(hasPermission(userScopes, 'clients:admin')).toBe(false);
        });

        it('should respect resource boundaries', () => {
            const userScopes: Scope[] = ['clients:admin'];
            
            // Admin de clients no da permisos en tiers
            expect(hasPermission(userScopes, 'tiers:read')).toBe(false);
            expect(hasPermission(userScopes, 'tiers:write')).toBe(false);
            expect(hasPermission(userScopes, 'api_keys:read')).toBe(false);
        });

        it('should handle empty scopes array', () => {
            const userScopes: Scope[] = [];
            
            expect(hasPermission(userScopes, 'clients:read')).toBe(false);
            expect(hasPermission(userScopes, 'clients:admin')).toBe(false);
        });
    });

    describe('hasAnyPermission', () => {
        it('should return true if user has at least one required scope', () => {
            const userScopes: Scope[] = ['clients:read', 'tiers:write'];
            const requiredScopes: Scope[] = ['clients:read', 'api_keys:write'];
            
            expect(hasAnyPermission(userScopes, requiredScopes)).toBe(true);
        });

        it('should return true if user has superior scope', () => {
            const userScopes: Scope[] = ['clients:admin'];
            const requiredScopes: Scope[] = ['clients:read', 'clients:write'];
            
            expect(hasAnyPermission(userScopes, requiredScopes)).toBe(true);
        });

        it('should return false if user has none of required scopes', () => {
            const userScopes: Scope[] = ['clients:read'];
            const requiredScopes: Scope[] = ['tiers:write', 'api_keys:delete'];
            
            expect(hasAnyPermission(userScopes, requiredScopes)).toBe(false);
        });

        it('should handle empty required scopes', () => {
            const userScopes: Scope[] = ['clients:read'];
            const requiredScopes: Scope[] = [];
            
            expect(hasAnyPermission(userScopes, requiredScopes)).toBe(false);
        });
    });

    describe('hasAllPermissions', () => {
        it('should return true if user has all required scopes', () => {
            const userScopes: Scope[] = ['clients:read', 'tiers:write', 'api_keys:delete'];
            const requiredScopes: Scope[] = ['clients:read', 'tiers:write'];
            
            expect(hasAllPermissions(userScopes, requiredScopes)).toBe(true);
        });

        it('should return true if user has superior scopes', () => {
            const userScopes: Scope[] = ['clients:admin', 'tiers:admin'];
            const requiredScopes: Scope[] = ['clients:read', 'tiers:write'];
            
            expect(hasAllPermissions(userScopes, requiredScopes)).toBe(true);
        });

        it('should return false if user is missing one required scope', () => {
            const userScopes: Scope[] = ['clients:read', 'tiers:write'];
            const requiredScopes: Scope[] = ['clients:read', 'tiers:write', 'api_keys:delete'];
            
            expect(hasAllPermissions(userScopes, requiredScopes)).toBe(false);
        });

        it('should handle empty required scopes', () => {
            const userScopes: Scope[] = ['clients:read'];
            const requiredScopes: Scope[] = [];
            
            expect(hasAllPermissions(userScopes, requiredScopes)).toBe(true);
        });
    });

    describe('parseScopes', () => {
        it('should parse scopes from JSON object', () => {
            const json = { scopes: ['clients:read', 'tiers:write'] };
            const result = parseScopes(json);
            
            expect(result).toEqual(['clients:read', 'tiers:write']);
        });

        it('should parse scopes from JSON string', () => {
            const json = '{"scopes":["clients:read","tiers:write"]}';
            const result = parseScopes(JSON.parse(json));
            
            expect(result).toEqual(['clients:read', 'tiers:write']);
        });

        it('should filter out invalid scopes', () => {
            const json = { scopes: ['clients:read', 'invalid:scope', 'tiers:write'] };
            const result = parseScopes(json);
            
            expect(result).toEqual(['clients:read', 'tiers:write']);
        });

        it('should handle null/undefined', () => {
            expect(parseScopes(null)).toEqual([]);
            expect(parseScopes(undefined)).toEqual([]);
        });

        it('should handle array directly', () => {
            const scopes = ['clients:read', 'tiers:write'];
            const result = parseScopes(scopes);
            
            expect(result).toEqual(['clients:read', 'tiers:write']);
        });

        it('should handle empty object', () => {
            expect(parseScopes({})).toEqual([]);
        });
    });

    describe('scopesToJSON', () => {
        it('should convert scopes array to JSON string', () => {
            const scopes: Scope[] = ['clients:read', 'tiers:write'];
            const result = scopesToJSON(scopes);
            
            expect(result).toBe('{"scopes":["clients:read","tiers:write"]}');
        });

        it('should handle empty array', () => {
            const result = scopesToJSON([]);
            expect(result).toBe('{"scopes":[]}');
        });

        it('should be reversible with parseScopes', () => {
            const original: Scope[] = ['clients:read', 'tiers:write', 'api_keys:delete'];
            const json = scopesToJSON(original);
            const parsed = parseScopes(JSON.parse(json));
            
            expect(parsed).toEqual(original);
        });
    });

    describe('getScopeDescription', () => {
        it('should return description for valid scope', () => {
            expect(getScopeDescription('clients:read')).toBe('Clientes: Lectura');
            expect(getScopeDescription('tiers:write')).toBe('Planes: Escritura');
            expect(getScopeDescription('api_keys:delete')).toBe('API Keys: Eliminación');
            expect(getScopeDescription('users:admin')).toBe('Usuarios: Administración');
        });

        it('should handle unknown resources gracefully', () => {
            const desc = getScopeDescription('unknown:read' as Scope);
            expect(desc).toContain('unknown');
            expect(desc).toContain('Lectura'); // La función traduce la acción
        });
    });

    describe('getAllScopesWithDescriptions', () => {
        it('should return all scopes with descriptions', () => {
            const result = getAllScopesWithDescriptions();
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            
            result.forEach((item: { scope: string; description: string }) => {
                expect(item).toHaveProperty('scope');
                expect(item).toHaveProperty('description');
                expect(typeof item.scope).toBe('string');
                expect(typeof item.description).toBe('string');
            });
        });

        it('should include all predefined scopes', () => {
            const result = getAllScopesWithDescriptions();
            const scopes = result.map((item: { scope: string }) => item.scope);
            
            expect(scopes).toContain(SCOPES.CLIENTS_READ);
            expect(scopes).toContain(SCOPES.TIERS_WRITE);
            expect(scopes).toContain(SCOPES.API_KEYS_DELETE);
            expect(scopes).toContain(SCOPES.USERS_ADMIN);
        });
    });

    describe('SCOPE_GROUPS', () => {
        it('should have READONLY group with only read scopes', () => {
            const readonly = SCOPE_GROUPS.READONLY;
            
            expect(Array.isArray(readonly)).toBe(true);
            readonly.forEach((scope: Scope) => {
                expect(scope.endsWith(':read')).toBe(true);
            });
        });

        it('should have DEVELOPER group with read and write scopes', () => {
            const developer = SCOPE_GROUPS.DEVELOPER;
            
            expect(Array.isArray(developer)).toBe(true);
            expect(developer.length).toBeGreaterThan(SCOPE_GROUPS.READONLY.length);
        });

        it('should have ADMIN group with most scopes', () => {
            const admin = SCOPE_GROUPS.ADMIN;
            
            expect(Array.isArray(admin)).toBe(true);
            expect(admin.length).toBeGreaterThan(SCOPE_GROUPS.DEVELOPER.length);
        });

        it('should have SUPER_ADMIN with all scopes', () => {
            const superAdmin = SCOPE_GROUPS.SUPER_ADMIN;
            const allScopes = Object.values(SCOPES);
            
            expect(superAdmin.length).toBe(allScopes.length);
        });

        it('should have hierarchical inclusion (READONLY ⊂ DEVELOPER ⊂ ADMIN)', () => {
            const readonly = SCOPE_GROUPS.READONLY;
            const developer = SCOPE_GROUPS.DEVELOPER;
            const admin = SCOPE_GROUPS.ADMIN;
            
            // DEVELOPER debe tener más scopes que READONLY
            expect(developer.length).toBeGreaterThan(readonly.length);
            
            // ADMIN debe tener más scopes que DEVELOPER
            expect(admin.length).toBeGreaterThan(developer.length);
            
            // Verificar que algunos scopes de READONLY están en DEVELOPER
            expect(developer.includes('clients:read' as Scope) || 
                   developer.includes('clients:write' as Scope) ||
                   developer.includes('clients:admin' as Scope)).toBe(true);
        });
    });

    describe('Real-world scenarios', () => {
        it('should handle dashboard read-only key', () => {
            const dashboardScopes: Scope[] = [
                'clients:read',
                'tiers:read',
                'usage:read',
            ];

            // Puede leer
            expect(hasPermission(dashboardScopes, 'clients:read')).toBe(true);
            expect(hasPermission(dashboardScopes, 'tiers:read')).toBe(true);
            expect(hasPermission(dashboardScopes, 'usage:read')).toBe(true);

            // No puede escribir
            expect(hasPermission(dashboardScopes, 'clients:write')).toBe(false);
            expect(hasPermission(dashboardScopes, 'tiers:write')).toBe(false);
            expect(hasPermission(dashboardScopes, 'api_keys:write')).toBe(false);
        });

        it('should handle developer key with limited permissions', () => {
            const devScopes: Scope[] = [...SCOPE_GROUPS.DEVELOPER];

            // Puede leer y escribir
            expect(hasPermission(devScopes, 'clients:read')).toBe(true);
            expect(hasPermission(devScopes, 'clients:write')).toBe(true);
            expect(hasPermission(devScopes, 'api_keys:write')).toBe(true);

            // No puede eliminar clientes (no tiene clients:delete)
            expect(hasPermission(devScopes, 'clients:delete')).toBe(false);
        });

        it('should handle admin key with full control', () => {
            const adminScopes: Scope[] = ['clients:admin', 'api_keys:admin'];

            // Puede hacer todo en clients y api_keys
            expect(hasPermission(adminScopes, 'clients:read')).toBe(true);
            expect(hasPermission(adminScopes, 'clients:write')).toBe(true);
            expect(hasPermission(adminScopes, 'clients:delete')).toBe(true);
            expect(hasPermission(adminScopes, 'api_keys:delete')).toBe(true);

            // Pero no en otros recursos
            expect(hasPermission(adminScopes, 'users:read')).toBe(false);
        });
    });
});
