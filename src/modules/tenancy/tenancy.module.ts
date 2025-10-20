import { Global, Module, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { CONNECTION } from './tenancy.symbols';
import { getTenantConnection } from './tenancy.utils';

/**
 * Note that because of Scope Hierarchy, all injectors of this
 * provider will be request-scoped by default. Hence there is
 * no need for example to specify that a consuming tenant-level
 * service is itself request-scoped.
 * https://docs.nestjs.com/fundamentals/injection-scopes#scope-hierarchy
 */
const connectionFactory = {
  provide: CONNECTION,
  scope: Scope.REQUEST,
  useFactory: async (request: Request, configService: ConfigService) => {
    const { tenantId } = request as any;

    if (tenantId) {
      const tenantConfig = configService.get('tenantOrm');
      const maxPoolSize = configService.get('database.maxConnectionPoolSize');
      const connection = await getTenantConnection(tenantId, tenantConfig, maxPoolSize);
      const queryRunner = await connection.createQueryRunner();
      await queryRunner.connect();
      return queryRunner.manager;
    }

    return null;
  },
  inject: [REQUEST, ConfigService],
};

@Global()
@Module({
  providers: [connectionFactory],
  exports: [CONNECTION],
})
export class TenancyModule {}
