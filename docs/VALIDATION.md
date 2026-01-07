# Sistema de Validación con Zod

## Introducción

Este proyecto utiliza **Zod** para validar todos los datos de entrada en los endpoints de la API, garantizando integridad y seguridad de datos con mensajes de error estandarizados.

---

## 🏗️ Arquitectura

### Middleware Centralizado

El middleware `validateRequest` se encuentra en `src/shared/validation/middleware/validateRequest.ts` y permite validar:
- **Body**: Datos del cuerpo de la petición
- **Query**: Parámetros de consulta (URL)
- **Params**: Parámetros de ruta (`:id`)
- **Headers**: Encabezados HTTP

### Esquemas Organizados por Módulo

Los esquemas de validación están organizados en `src/shared/validation/schemas/`:
- `common.schemas.ts`: Esquemas reutilizables (email, UUID, paginación, etc.)
- `auth.schemas.ts`: Autenticación (login, register, refresh)
- `user.schemas.ts`: Gestión de usuarios
- `client.schemas.ts`: Gestión de clientes
- `tier.schemas.ts`: Planes y límites
- `apiKey.schemas.ts`: API Keys
- `audit.schemas.ts`: Logs de auditoría

---

## 📝 Uso en Rutas

### Ejemplo Básico

```typescript
import { validateRequest } from '@validation/middleware/validateRequest';
import { createUserSchema } from '@validation/schemas/user.schemas';

router.post('/users',
    authenticate,
    validateRequest({ body: createUserSchema }),
    asyncHandler(async (req, res) => {
        // req.body ya está validado y tipado
        const { email, password, name } = req.body;
        // ...
    })
);
```

### Validación Múltiple

```typescript
router.patch('/users/:id',
    authenticate,
    validateRequest({
        params: getUserParamsSchema,  // Valida :id
        body: updateUserSchema,       // Valida body
    }),
    asyncHandler(async (req, res) => {
        // Ambos están validados
    })
);
```

### Validación de Query Params

```typescript
router.get('/users',
    authenticate,
    validateRequest({ query: listUsersQuerySchema }),
    asyncHandler(async (req, res) => {
        // req.query.page y req.query.limit están validados
        const { page, limit } = req.query;
    })
);
```

---

## 🔧 Crear Nuevos Esquemas

### 1. Usar Esquemas Comunes

```typescript
import { z } from 'zod';
import { emailSchema, uuidSchema } from './common.schemas';

export const mySchema = z.object({
    email: emailSchema,
    userId: uuidSchema,
    age: z.number().int().positive().max(120),
});
```

### 2. Validaciones Personalizadas

```typescript
export const passwordChangeSchema = z.object({
    oldPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
}).refine(
    (data) => data.newPassword === data.confirmPassword,
    {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    }
);
```

### 3. Transformaciones

```typescript
export const booleanQuerySchema = z.object({
    active: z.enum(['true', 'false'])
        .transform((val) => val === 'true'),
});
```

---

## ❌ Formato de Errores

Cuando la validación falla, se retorna un error 400 con el siguiente formato:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "statusCode": 400,
    "details": [
      {
        "field": "body.email",
        "message": "Invalid email format",
        "code": "invalid_string"
      },
      {
        "field": "body.password",
        "message": "Password must be at least 8 characters",
        "code": "too_small"
      }
    ]
  }
}
```

---

## 🎯 Esquemas Disponibles

### Comunes (`common.schemas.ts`)
- `emailSchema`: Validación de email
- `uuidSchema`: UUID v4
- `passwordSchema`: Contraseña (min 8 caracteres)
- `nameSchema`: Nombre (1-255 caracteres)
- `paginationQuerySchema`: page y limit
- `slugSchema`: Slug (lowercase, alphanumeric con guiones)
- `roleSchema`: 'admin' | 'user'

### Autenticación (`auth.schemas.ts`)
- `registerSchema`: Registro de usuario
- `loginSchema`: Login
- `refreshSchema`: Refresh token
- `createApiKeySchema`: Crear API key

### Usuarios (`user.schemas.ts`)
- `createUserSchema`: Crear usuario
- `updateUserSchema`: Actualizar usuario
- `getUserParamsSchema`: Validar :id
- `listUsersQuerySchema`: Paginación

### Clientes (`client.schemas.ts`)
- `createClientSchema`: Crear cliente
- `updateClientSchema`: Actualizar cliente
- `listClientsQuerySchema`: Filtros y paginación

### Auditoría (`audit.schemas.ts`)
- `listAuditLogsQuerySchema`: Filtros de logs
- `retentionConfigSchema`: Configuración de retención

---

## ✅ Mejores Prácticas

1. **Reutilizar esquemas comunes**: No duplicar validaciones de email, UUID, etc.
2. **Validar en el middleware**: No validar manualmente en los handlers
3. **Usar transformaciones**: Para convertir tipos (strings a booleans, etc.)
4. **Mensajes claros**: Personalizar mensajes de error cuando sea necesario
5. **Type safety**: Exportar tipos TypeScript desde los esquemas

```typescript
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

---

## 🧪 Testing

Para probar la validación:

```typescript
import { registerSchema } from '@validation/schemas/auth.schemas';

describe('registerSchema', () => {
    it('should validate correct data', () => {
        const result = registerSchema.safeParse({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
        const result = registerSchema.safeParse({
            email: 'invalid',
            password: 'password123',
            name: 'Test User',
        });
        expect(result.success).toBe(false);
    });
});
```

---

## 📚 Referencias

- [Zod Documentation](https://zod.dev/)
- Middleware: `src/shared/validation/middleware/validateRequest.ts`
- Esquemas: `src/shared/validation/schemas/`
