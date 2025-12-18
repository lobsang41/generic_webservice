/**
 * POSTGRESQL DATABASE - DESACTIVADO TEMPORALMENTE
 * 
 * Usando solo MySQL por ahora.
 * Para reactivar PostgreSQL:
 * 1. Descomentar todo el código abajo
 * 2. Descomentar servicio 'postgres' en docker-compose.yml
 * 3. Descomentar variables POSTGRES_* en .env
 * 4. Descomentar inicialización en src/services/api-gateway/index.ts
 */

/*
[... código comentado de PostgreSQL ...]
*/

// Wrapper para MySQL que emula la interfaz de PostgreSQL
import mysqlDB from '@database/mysql';

class PostgreSQLCompatibilityWrapper {
    async connect(): Promise<void> {
        return mysqlDB.connect();
    }

    async query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
        const rows = await mysqlDB.query<T>(text, params);
        return {
            rows,
            rowCount: rows.length,
        };
    }

    async getClient(): Promise<any> {
        return null; // MySQL no usa el patrón de client
    }

    async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
        return mysqlDB.transaction(callback as any);
    }

    async healthCheck(): Promise<boolean> {
        return mysqlDB.healthCheck();
    }

    async close(): Promise<void> {
        return mysqlDB.close();
    }

    getPoolStats() {
        return null;
    }
}

export const postgresDB = new PostgreSQLCompatibilityWrapper();
export default postgresDB;
