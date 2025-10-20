import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig, publicOrmConfig, tenantOrmConfig } from '../config';
import { TenantsModule } from './public/tenants/tenants.module';
import { TenancyModule } from './public/tenancy/tenancy.module';
import { TenancyMiddleware } from './public/tenancy/tenancy.middleware';
import { PostsModule } from './tenanted/posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, publicOrmConfig, tenantOrmConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync(publicOrmConfig.asProvider()),
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
      .exclude(
        { path: 'tenants', method: RequestMethod.ALL },
        { path: 'tenants/*path', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
