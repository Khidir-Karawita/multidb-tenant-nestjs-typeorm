import { DataSource, DataSourceOptions } from 'typeorm';

export const tenantConnections: { [schemaName: string]: DataSource } = {};

export async function getTenantConnection(
  tenantId: string,
  tenantConfig: DataSourceOptions,
  maxPoolSize: number,
): Promise<DataSource> {
  const connectionName = `tenant_${tenantId}`;

  if (tenantConnections[connectionName]) {
    const connection = tenantConnections[connectionName];
    return connection;
  } else {
    const dataSource = new DataSource({
      ...tenantConfig,
      name: connectionName,
      schema: connectionName,
      poolSize: maxPoolSize,
    } as DataSourceOptions);

    await dataSource.initialize();
    tenantConnections[connectionName] = dataSource;
    return dataSource;
  }
}
