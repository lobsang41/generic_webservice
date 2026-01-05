# Sistema de Permisos (Scopes)

## Introducción

Este proyecto utiliza un sistema de **Scopes Granulares** para controlar el acceso a los recursos de la API. Los scopes definen qué acciones puede realizar un usuario o una API Key sobre un recurso específico.

---

## 🏗️ Estructura de un Scope

Un scope sigue el formato `recurso:accion`.

### Recursos Disponibles (`ScopeResource`)
- `clients`: Gestión de clientes (tenants).
- `tiers`: Planes y límites de consumo.
- `api_keys`: Claves de acceso para usuarios y clientes.
- `users`: Gestión de usuarios del sistema.
- `usage`: Estadísticas de consumo y cuotas.
- `audit`: Logs de auditoría y políticas de retención.
- `webhooks`, `analytics`: Módulos de soporte.

### Acciones (`ScopeAction`)
- `read`: Consultar datos.
- `write`: Crear o modificar datos.
- `delete`: Eliminar registros.
- `admin`: Permisos administrativos totales sobre el recurso.

---

## 🏛️ Jerarquía de Permisos

El sistema implementa una jerarquía automática. Si tienes un permiso superior, obtienes automáticamente los inferiores:

**`admin` > `delete` > `write` > `read`**

*Ejemplo: Si un usuario tiene el scope `clients:admin`, puede leer, escribir y eliminar clientes aunque no tenga los scopes específicos `clients:read` o `clients:delete`.*

---

## 👥 Grupos de Scopes (Roles)

Para facilitar la gestión, existen grupos de scopes predefinidos:

| Grupo | Descripción | Scopes Incluidos |
|-------|-------------|------------------|
| **READONLY** | Solo lectura | `clients:read`, `tiers:read`, `usage:read`, `analytics:read` |
| **DEVELOPER** | Desarrollo estándar | Scopes de lectura + escritura de clientes, tiers y API keys. |
| **ADMIN** | Gestión total | Casi todos los scopes, incluyendo auditoría y administración. |
| **SUPER_ADMIN** | Acceso sin restricciones | Todos los scopes definidos en el sistema. |

---

## 🔐 Aplicación en la API

### Middlewares de Protección

En el código principal (`Express`), protegemos las rutas usando el middleware `requireScope`:

```typescript
import { requireScope } from '@middleware/auth';
import { SCOPES } from '@shared/auth/scopes';

// Ejemplo: Solo usuarios/keys con permiso de lectura de auditoría
router.get('/audit-logs', 
    authenticate, 
    requireScope(SCOPES.AUDIT_READ), 
    handler
);
```

### Usuarios vs API Keys
1. **Admins**: Los usuarios con rol `admin` obtienen automáticamente el grupo `SUPER_ADMIN` al hacer login (JWT).
2. **Usuarios Normales**: Se les asignan scopes específicos al ser creados por un admin.
3. **API Keys**: Cada API Key (de usuario o de cliente) se genera con una lista estricta de scopes que limitan lo que esa clave puede hacer.

---

## 🔧 Mantenimiento

Para agregar nuevos scopes:
1. Edita `src/shared/auth/scopes.ts`.
2. Agrega el nuevo recurso en `ScopeResource` o acción en `ScopeAction`.
3. Agrégalo al objeto `SCOPES`.
4. (Opcional) Inclúyelo en los `SCOPE_GROUPS` correspondientes.
