#!/bin/bash

# Script para ejecutar la migración de permissions
# Uso: ./run_migration.sh

echo "🔧 Ejecutando migración: add_permissions_to_users.sql"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Configuración de la base de datos
DB_NAME="generic_webservice"
DB_USER="root"
DB_PASS="123456"

# Ejecutar migración
mysql -u $DB_USER -p$DB_PASS $DB_NAME < migrations/add_permissions_to_users.sql

if [ $? -eq 0 ]; then
    echo "✅ Migración ejecutada exitosamente"
    echo ""
    echo "📊 Usuarios actuales:"
    mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT id, email, name, role, permissions FROM users;"
else
    echo "❌ Error al ejecutar la migración"
    exit 1
fi
