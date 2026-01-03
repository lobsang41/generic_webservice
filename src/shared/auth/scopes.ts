/**
 * Sistema de Scopes Granulares para API Keys
 * 
 * Define los permisos disponibles y su estructura jerárquica
 */

// ============================================================================
// DEFINICIÓN DE SCOPES
// ============================================================================

/**
 * Categorías de recursos
 */
export enum ScopeResource {
    CLIENTS = 'clients',
    TIERS = 'tiers',
    API_KEYS = 'api_keys',
    USERS = 'users',
    USAGE = 'usage',
    WEBHOOKS = 'webhooks',
    ANALYTICS = 'analytics',
}

/**
 * Acciones permitidas
 */
export enum ScopeAction {
    READ = 'read',
    WRITE = 'write',
    DELETE = 'delete',
    ADMIN = 'admin',
}

/**
 * Formato de scope: resource:action
 * Ejemplos: 
 * - "clients:read"
 * - "api_keys:write"
 * - "users:admin"
 */
export type Scope = `${ScopeResource}:${ScopeAction}`;

/**
 * Scopes predefinidos comunes
 */
export const SCOPES = {
    // Clients
    CLIENTS_READ: 'clients:read' as Scope,
    CLIENTS_WRITE: 'clients:write' as Scope,
    CLIENTS_DELETE: 'clients:delete' as Scope,
    CLIENTS_ADMIN: 'clients:admin' as Scope,

    // Tiers
    TIERS_READ: 'tiers:read' as Scope,
    TIERS_WRITE: 'tiers:write' as Scope,
    TIERS_DELETE: 'tiers:delete' as Scope,
    TIERS_ADMIN: 'tiers:admin' as Scope,

    // API Keys
    API_KEYS_READ: 'api_keys:read' as Scope,
    API_KEYS_WRITE: 'api_keys:write' as Scope,
    API_KEYS_DELETE: 'api_keys:delete' as Scope,
    API_KEYS_ADMIN: 'api_keys:admin' as Scope,

    // Users
    USERS_READ: 'users:read' as Scope,
    USERS_WRITE: 'users:write' as Scope,
    USERS_DELETE: 'users:delete' as Scope,
    USERS_ADMIN: 'users:admin' as Scope,

    // Usage
    USAGE_READ: 'usage:read' as Scope,
    USAGE_WRITE: 'usage:write' as Scope,

    // Webhooks
    WEBHOOKS_READ: 'webhooks:read' as Scope,
    WEBHOOKS_WRITE: 'webhooks:write' as Scope,
    WEBHOOKS_DELETE: 'webhooks:delete' as Scope,

    // Analytics
    ANALYTICS_READ: 'analytics:read' as Scope,
} as const;

/**
 * Grupos de scopes predefinidos para roles comunes
 */
export const SCOPE_GROUPS = {
    /**
     * Read-only: Solo lectura de recursos
     */
    READONLY: [
        SCOPES.CLIENTS_READ,
        SCOPES.TIERS_READ,
        SCOPES.USAGE_READ,
        SCOPES.ANALYTICS_READ,
    ],

    /**
     * Developer: Lectura y escritura básica
     */
    DEVELOPER: [
        SCOPES.CLIENTS_READ,
        SCOPES.CLIENTS_WRITE,
        SCOPES.TIERS_READ,
        SCOPES.API_KEYS_READ,
        SCOPES.API_KEYS_WRITE,
        SCOPES.USAGE_READ,
        SCOPES.WEBHOOKS_READ,
        SCOPES.WEBHOOKS_WRITE,
    ],

    /**
     * Admin: Control total (excepto eliminación)
     */
    ADMIN: [
        SCOPES.CLIENTS_READ,
        SCOPES.CLIENTS_WRITE,
        SCOPES.CLIENTS_ADMIN,
        SCOPES.TIERS_READ,
        SCOPES.TIERS_WRITE,
        SCOPES.API_KEYS_READ,
        SCOPES.API_KEYS_WRITE,
        SCOPES.API_KEYS_DELETE,
        SCOPES.USERS_READ,
        SCOPES.USERS_WRITE,
        SCOPES.USAGE_READ,
        SCOPES.USAGE_WRITE,
        SCOPES.WEBHOOKS_READ,
        SCOPES.WEBHOOKS_WRITE,
        SCOPES.WEBHOOKS_DELETE,
        SCOPES.ANALYTICS_READ,
    ],

    /**
     * Super Admin: Control total sin restricciones
     */
    SUPER_ADMIN: Object.values(SCOPES),
} as const;

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Valida si un scope tiene el formato correcto
 */
export function isValidScope(scope: string): scope is Scope {
    const parts = scope.split(':');
    if (parts.length !== 2) return false;

    const [resource, action] = parts;
    return (
        Object.values(ScopeResource).includes(resource as ScopeResource) &&
        Object.values(ScopeAction).includes(action as ScopeAction)
    );
}

/**
 * Valida si un conjunto de scopes es válido
 */
export function validateScopes(scopes: string[]): { valid: boolean; invalid: string[] } {
    const invalid = scopes.filter(scope => !isValidScope(scope));
    return {
        valid: invalid.length === 0,
        invalid,
    };
}

/**
 * Verifica si un scope tiene permiso para una acción
 * 
 * Jerarquía de permisos:
 * - admin > delete > write > read
 */
export function hasPermission(userScopes: Scope[], requiredScope: Scope): boolean {
    const [resource, requiredAction] = requiredScope.split(':') as [ScopeResource, ScopeAction];

    // Verificar si tiene el scope exacto
    if (userScopes.includes(requiredScope)) {
        return true;
    }

    // Verificar si tiene un scope superior en la jerarquía
    const actionHierarchy: Record<ScopeAction, ScopeAction[]> = {
        [ScopeAction.READ]: [ScopeAction.WRITE, ScopeAction.DELETE, ScopeAction.ADMIN],
        [ScopeAction.WRITE]: [ScopeAction.DELETE, ScopeAction.ADMIN],
        [ScopeAction.DELETE]: [ScopeAction.ADMIN],
        [ScopeAction.ADMIN]: [],
    };

    const superiorActions = actionHierarchy[requiredAction] || [];
    
    for (const action of superiorActions) {
        const superiorScope = `${resource}:${action}` as Scope;
        if (userScopes.includes(superiorScope)) {
            return true;
        }
    }

    return false;
}

/**
 * Verifica si tiene alguno de los scopes requeridos
 */
export function hasAnyPermission(userScopes: Scope[], requiredScopes: Scope[]): boolean {
    return requiredScopes.some(scope => hasPermission(userScopes, scope));
}

/**
 * Verifica si tiene todos los scopes requeridos
 */
export function hasAllPermissions(userScopes: Scope[], requiredScopes: Scope[]): boolean {
    return requiredScopes.every(scope => hasPermission(userScopes, scope));
}

/**
 * Parsea scopes desde JSON (base de datos)
 */
export function parseScopes(permissions: unknown): Scope[] {
    if (!permissions) return [];
    
    if (Array.isArray(permissions)) {
        return permissions.filter(isValidScope);
    }

    if (typeof permissions === 'object' && permissions !== null) {
        const perms = permissions as Record<string, unknown>;
        if (Array.isArray(perms.scopes)) {
            return perms.scopes.filter(isValidScope);
        }
    }

    return [];
}

/**
 * Convierte scopes a formato JSON para la base de datos
 */
export function scopesToJSON(scopes: Scope[]): string {
    return JSON.stringify({ scopes });
}

/**
 * Obtiene una descripción legible de un scope
 */
export function getScopeDescription(scope: Scope): string {
    const [resource, action] = scope.split(':');
    
    const resourceNames: Record<string, string> = {
        clients: 'Clientes',
        tiers: 'Planes',
        api_keys: 'API Keys',
        users: 'Usuarios',
        usage: 'Uso/Consumo',
        webhooks: 'Webhooks',
        analytics: 'Analíticas',
    };

    const actionNames: Record<string, string> = {
        read: 'Lectura',
        write: 'Escritura',
        delete: 'Eliminación',
        admin: 'Administración',
    };

    return `${resourceNames[resource] || resource}: ${actionNames[action] || action}`;
}

/**
 * Obtiene todos los scopes disponibles con sus descripciones
 */
export function getAllScopesWithDescriptions(): Array<{ scope: Scope; description: string }> {
    return Object.values(SCOPES).map(scope => ({
        scope,
        description: getScopeDescription(scope),
    }));
}
