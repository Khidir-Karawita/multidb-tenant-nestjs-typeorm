import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig, publicOrmConfig, tenantOrmConfig } from './config';
import { TenantsModule } from './modules/public/tenants.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { TenancyMiddleware } from './modules/tenancy/tenancy.middleware';
import { PostsModule } from './modules/tenanted/posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, publicOrmConfig, tenantOrmConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('publicOrm'),
      }),
    }),
    TenancyModule,
    TenantsModule,
    PostsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenancy middleware to all routes except tenant creation
    consumer
      .apply(TenancyMiddleware)
      .exclude('tenants', 'tenants/(.*)')
      .forRoutes('*');
  }
}
