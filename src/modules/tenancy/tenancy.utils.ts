import { DataSource, DataSourceOptions } from 'typeorm';
import { LRUCache } from 'lru-cache';
import { config } from 'dotenv';
config();
/**
 * Maximum number of tenant data sources to keep in cache.
 * Based on PostgreSQL connection limits:
 * - Default max connections: 100
 * - Reserved for superuser: 3
 * - Reserved for public schema: 10
 * - Available for tenants: 87
 *
 * Adjust based on your PostgreSQL max_connections setting.
 */

export const MAX_TENANT_DATA_SOURCES =
  Number(process.env.MAX_TENANT_DATA_SOURCES) || 90;

/**
 * LRU Cache for tenant database connections.
 * Automatically disposes (closes) connections when they're evicted from cache.
 */
const tenantConnectionCache = new LRUCache<string, DataSource>({
  max: MAX_TENANT_DATA_SOURCES,
  dispose: async (dataSource: DataSource, key: string) => {
    console.log(`[TenancyUtils] Disposing tenant connection: ${key}`);
    try {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        console.log(`[TenancyUtils] Successfully closed connection: ${key}`);
      }
    } catch (error) {
      console.error(`[TenancyUtils] Error disposing connection ${key}:`, error);
    }
  },
  ttl: 1000 * 60 * 10, // 10 minutes
});

/**
 * Gets or creates a tenant-specific database connection.
 * Uses LRU cache to manage connection lifecycle automatically.
 *
 * @param tenantId - The tenant UUID
 * @param tenantConfig - TypeORM DataSource configuration
 * @param maxPoolSize - Maximum connection pool size per tenant
 * @returns Promise<DataSource> - Tenant-specific database connection
 */
export async function getTenantConnection(
  tenantId: string,
  tenantConfig: DataSourceOptions,
  maxPoolSize: number,
): Promise<DataSource> {
  const connectionName = `tenant_${tenantId}`;

  // Check if connection exists in cache
  const existingConnection = tenantConnectionCache.get(connectionName);
  if (existingConnection) {
    return existingConnection;
  }

  // Create new connection
  console.log(`[TenancyUtils] Creating new connection for: ${connectionName}`);
  const dataSource = new DataSource({
    ...tenantConfig,
    name: connectionName,
    schema: connectionName,
    poolSize: maxPoolSize,
  } as DataSourceOptions);

  await dataSource.initialize();

  // Store in cache (LRU will automatically evict oldest if at capacity)
  tenantConnectionCache.set(connectionName, dataSource);

  console.log(
    `[TenancyUtils] Connection cached. Cache size: ${tenantConnectionCache.size}/${MAX_TENANT_DATA_SOURCES}`,
  );

  return dataSource;
}
