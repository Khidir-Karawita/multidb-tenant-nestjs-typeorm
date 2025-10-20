import { Injectable, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if tenant with same name already exists
    const existingTenant = await this.dataSource
      .getRepository(Tenant)
      .findOne({ where: { name: createTenantDto.name } });

    if (existingTenant) {
      throw new ConflictException(
        `Tenant with name '${createTenantDto.name}' already exists`,
      );
    }

    // Create tenant record in public schema
    const tenant = new Tenant();
    tenant.name = createTenantDto.name;
    tenant.subdomain = createTenantDto.subdomain || null;

    await this.dataSource.getRepository(Tenant).save(tenant);

    // Create schema for the new tenant
    const schemaName = `tenant_${tenant.id}`;
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Run migrations for the new tenant schema
    await this.runMigrations(schemaName);

    return tenant;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.dataSource.getRepository(Tenant).find();
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.dataSource.getRepository(Tenant).findOne({ where: { id } });
  }

  private async runMigrations(schemaName: string) {
    const tenantConfig = this.configService.get('tenantOrm');
    const tenantDataSourceConfig = {
      ...tenantConfig,
      schema: schemaName,
    };

    const tenantDataSource = new DataSource(tenantDataSourceConfig);

    try {
      await tenantDataSource.initialize();

      await tenantDataSource.query(
        `SET search_path TO "${schemaName}", public`,
      );

      await tenantDataSource.runMigrations();

      console.log(`Migrations run successfully for schema: ${schemaName}`);
    } catch (error) {
      console.error(
        `Error running migrations for schema ${schemaName}:`,
        error,
      );
      throw error;
    } finally {
      if (tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
    }
  }
}
