import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async createTenant(
    @Body() createTenantDto: CreateTenantDto,
  ): Promise<Tenant> {
    return this.tenantsService.createTenant(createTenantDto);
  }

  @Get()
  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantsService.getAllTenants();
  }

  @Get(':id')
  async getTenantById(@Param('id') id: string): Promise<Tenant | null> {
    return this.tenantsService.getTenantById(id);
  }
}
