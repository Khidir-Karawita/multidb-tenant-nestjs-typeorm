import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export const publicOrmConfig = registerAs(
  'publicOrm',
  (): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'multi_tenancy_db',
    entities: [
      __dirname + '/../modules/public/entities/*.entity{.ts,.js}',
      __dirname + '/../modules/public/**/entities/*.entity{.ts,.js}',
    ],
    migrations: [__dirname + '/../modules/public/migrations/*{.ts,.js}'],
    synchronize: false,
  }),
);

export const tenantOrmConfig = registerAs(
  'tenantOrm',
  (): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'multi_tenancy_db',
    entities: [
      __dirname + '/../modules/tenanted/entities/*.entity{.ts,.js}',
      __dirname + '/../modules/tenanted/**/entities/*.entity{.ts,.js}',
    ],
    migrations: [__dirname + '/../modules/tenanted/migrations/*{.ts,.js}'],
    synchronize: false,
  }),
);
