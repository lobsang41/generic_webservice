# ⚡ EJECUTAR MIGRACIÓN - COPIA Y PEGA ESTE COMANDO

## 🔧 Paso 1: Agregar columna permissions

Copia y pega este comando en tu terminal:

```bash
cat << 'EOF' | mysql -u root -p123456 generic_webservice
ALTER TABLE users 
ADD COLUMN permissions JSON NULL COMMENT 'User permissions and scopes' 
AFTER role;
EOF
```

## 📊 Paso 2: Verificar que se agregó

```bash
mysql -u root -p123456 generic_webservice -e "DESCRIBE users;"
```

Deberías ver la columna `permissions` con tipo `json` y `NULL` como default.

## 👤 Paso 3: Dar scopes al usuario 'example'

```bash
cat << 'EOF' | mysql -u root -p123456 generic_webservice
UPDATE users 
SET permissions = JSON_OBJECT('scopes', JSON_ARRAY(
    'users:read',
    'clients:read',
    'tiers:read',
    'api_keys:read',
    'usage:read',
    'webhooks:read',
    'analytics:read'
))
WHERE email = 'example';
EOF
```

## ✅ Paso 4: Verificar usuarios

```bash
mysql -u root -p123456 generic_webservice -e "SELECT id, email, name, role, permissions FROM users;"
```

Deberías ver:
- **Admin**: `permissions: NULL` (correcto, obtiene todos los scopes automáticamente)
- **example**: `permissions: {"scopes": ["users:read", ...]}` (tiene scopes específicos)

---

## 🚀 TODO EN UN SOLO COMANDO

Si quieres ejecutar todo de una vez:

```bash
# Agregar columna
mysql -u root -p123456 generic_webservice -e "ALTER TABLE users ADD COLUMN permissions JSON NULL AFTER role;" && \

# Dar scopes al usuario example
mysql -u root -p123456 generic_webservice -e "UPDATE users SET permissions = JSON_OBJECT('scopes', JSON_ARRAY('users:read', 'clients:read', 'tiers:read', 'api_keys:read', 'usage:read', 'webhooks:read', 'analytics:read')) WHERE email = 'example';" && \

# Verificar
mysql -u root -p123456 generic_webservice -e "SELECT email, role, permissions FROM users;"
```

---

## ⚠️ Si no tienes mysql CLI

Usa MySQL Workbench, phpMyAdmin, o cualquier cliente MySQL y ejecuta:

```sql
USE generic_webservice;

-- Agregar columna
ALTER TABLE users 
ADD COLUMN permissions JSON NULL 
AFTER role;

-- Dar scopes al usuario
UPDATE users 
SET permissions = JSON_OBJECT('scopes', JSON_ARRAY(
    'users:read',
    'clients:read',
    'tiers:read',
    'api_keys:read',
    'usage:read',
    'webhooks:read',
    'analytics:read'
))
WHERE email = 'example';

-- Verificar
SELECT email, role, permissions FROM users;
```

---

## ✅ Después de ejecutar

1. Refresca el dashboard (F5)
2. Haz login con admin → Debería poder listar usuarios
3. Haz login con 'example' → Debería poder listar usuarios (tiene users:read)
