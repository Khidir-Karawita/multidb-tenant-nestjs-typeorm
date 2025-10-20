# Multi-Tenancy with NestJS and TypeORM

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">A production-ready implementation of <strong>schema-level multi-tenancy</strong> using NestJS, TypeORM, and PostgreSQL.</p>

## 📚 Table of Contents

- [What is Multi-Tenancy?](#what-is-multi-tenancy)
- [Why Schema-Level Multi-Tenancy?](#why-schema-level-multi-tenancy)
- [Installation & Setup](#installation--setup)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [API Usage](#api-usage)
- [CRUD Example: Posts](#crud-example-posts)
- [Adding New Tenant Resources](#adding-new-tenant-resources)
- [Migrations](#migrations)
- [Configuration](#configuration)
- [Available Scripts](#available-scripts)
- [Security & Best Practices](#security--best-practices)
- [References](#references)

---

## What is Multi-Tenancy?

**Multi-tenancy** is an architecture where a single application instance serves multiple customers (tenants). Each tenant's data is isolated and invisible to other tenants.

### Common Multi-Tenancy Approaches:

1. **Database-Level**: Each tenant gets their own database
2. **Schema-Level**: Each tenant gets their own schema within a shared database ⭐ **(This project)**
3. **Row-Level**: All tenants share tables, filtered by `tenant_id` column

### Why Schema-Level?

✅ **Strong Data Isolation**: Physical separation at schema level  
✅ **Better Performance**: No row-level filtering overhead  
✅ **Easier Scaling**: Can move schemas to different databases  
✅ **Simpler Queries**: No need for `WHERE tenantId = ?` everywhere  
✅ **Per-Tenant Backups**: Easy to backup/restore individual tenants  

---

## Why Schema-Level Multi-Tenancy?

This implementation is based on the excellent article by [@logeek](https://dev.to/logeek):

📖 **[NestJS and TypeORM — Efficient Schema-Level Multi-Tenancy](https://dev.to/logeek/nestjs-and-typeorm-efficient-schema-level-multi-tenancy-with-auto-generated-migrations-a-dx-approach-jla)**

### Key Benefits:

- **Physical Isolation**: Each tenant has `tenant_<uuid>` schema in PostgreSQL
- **Automatic Setup**: New tenant schemas created automatically with migrations
- **Request-Scoped**: Tenant context injected per HTTP request
- **Type-Safe**: Full TypeScript support with strict typing
- **Production-Ready**: Connection pooling, caching, error handling

---

## Installation & Setup

### Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **Yarn** package manager ([Install](https://yarnpkg.com/getting-started/install))

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd multi-tenancy-typeorm-setup

# Install dependencies
yarn install
```

**Key Dependencies:**
- `@nestjs/core` - NestJS framework ([Docs](https://docs.nestjs.com))
- `@nestjs/typeorm` - TypeORM integration ([Docs](https://docs.nestjs.com/techniques/database))
- `@nestjs/config` - Configuration management ([Docs](https://docs.nestjs.com/techniques/configuration))
- `typeorm` - ORM for TypeScript ([Docs](https://typeorm.io))
- `pg` - PostgreSQL client ([Docs](https://node-postgres.com/))

### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password_here
DB_NAME=multi_tenancy_db
MAX_CONNECTION_POOL_SIZE=10
```

**Configuration Details:**
- `DB_HOST`: PostgreSQL server address
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_USERNAME`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name for the application
- `MAX_CONNECTION_POOL_SIZE`: Max connections per tenant schema

### Step 3: Create PostgreSQL Database

```bash
# Using createdb command
createdb multi_tenancy_db

# OR using psql
psql -U postgres
CREATE DATABASE multi_tenancy_db;
\q
```

### Step 4: Run Migrations for Public Schema

The **public schema** stores tenant metadata (the `tenants` table).

```bash
# Generate migration (if not exists)
yarn migration:generate src/modules/public/migrations/InitialMigration

# Run migrations
yarn migration:run
```

This creates the `tenants` table in the `public` schema:

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL UNIQUE,
  subdomain VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Step 5: Start the Application

```bash
# Development mode (with hot reload)
yarn start:dev

# Production mode
yarn build
yarn start:prod
```

The application will start on `http://localhost:3000`

✅ **Setup Complete!** You're now ready to create tenants and use the multi-tenancy features.

---

## Project Structure

```bash
src/
├── config/                      # Configuration files
│   ├── database.config.ts       # Database settings
│   ├── typeorm.config.ts        # TypeORM configs (public & tenant)
│   └── index.ts                 # Config exports
├── modules/
│   ├── public/                  # Public schema (tenant metadata)
│   │   ├── entities/
│   │   │   └── tenant.entity.ts # Tenant entity
│   │   ├── migrations/          # Public schema migrations
│   │   ├── dto/
│   │   │   └── create-tenant.dto.ts
│   │   ├── tenants.controller.ts
│   │   ├── tenants.service.ts
│   │   └── tenants.module.ts
│   ├── tenanted/                # Tenant-specific resources
│   │   ├── entities/            # Shared tenant entities
│   │   ├── migrations/          # Tenant schema migrations
│   │   └── posts/               # Example: Posts CRUD
│   │       ├── entities/
│   │       │   └── post.entity.ts
│   │       ├── dto/
│   │       ├── posts.controller.ts
│   │       ├── posts.service.ts
│   │       └── posts.module.ts
│   └── tenancy/                 # Multi-tenancy infrastructure
│       ├── tenancy.middleware.ts  # Extract tenant ID from header
│       ├── tenancy.module.ts      # Provide tenant connection
│       ├── tenancy.symbols.ts     # DI tokens
│       └── tenancy.utils.ts       # Connection caching
├── data-source.ts               # DataSource for migrations
├── app.module.ts                # Root module
└── main.ts                      # Application entry point
```

### Key Directories:

- **`config/`**: Centralized configuration using `@nestjs/config`
- **`modules/public/`**: Manages tenant records in public schema
- **`modules/tenanted/`**: Tenant-scoped resources (posts, users, etc.)
- **`modules/tenancy/`**: Core multi-tenancy infrastructure

---

## How It Works

This section explains the complete flow of how multi-tenancy works in this application, with code examples.

### Architecture Overview

```
┌─────────────────────────────────────────┐
│          Client Request                     │
│   (with x-tenant-id header)                │
└──────────────────────┬──────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────┐
│      TenancyMiddleware                      │
│   Extracts & validates tenant ID          │
└──────────────────────┬──────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────┐
│       TenancyModule                        │
│   Provides request-scoped CONNECTION      │
└──────────────────────┬──────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────┐
│      Service Layer                         │
│   Injects CONNECTION token                │
└──────────────────────┬──────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────┐
│         PostgreSQL                        │
│  ┌──────────────────────────────────┐  │
│  │ public schema (tenants table)  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ tenant_<uuid1> schema          │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ tenant_<uuid2> schema          │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 1. Configuration Layer

#### Database Configuration (`src/config/database.config.ts`)

Uses [@nestjs/config](https://docs.nestjs.com/techniques/configuration) for type-safe configuration:

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  name: process.env.DB_NAME || 'multi_tenancy_db',
  maxConnectionPoolSize: parseInt(process.env.MAX_CONNECTION_POOL_SIZE || '10', 10),
}));
```

**Key Points:**
- Uses `registerAs()` to namespace configuration
- Provides default values for all settings
- Type-safe access via `ConfigService`

#### TypeORM Configuration (`src/config/typeorm.config.ts`)

Separate configurations for **public** and **tenant** schemas:

```typescript
import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

// Public schema config (for tenant metadata)
export const publicOrmConfig = registerAs(
  'publicOrm',
  (): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'multi_tenancy_db',
    entities: [__dirname + '/../modules/public/entities/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../modules/public/migrations/*{.ts,.js}'],
    synchronize: false,
  }),
);

// Tenant schema config (for tenant-specific data)
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
```

**Why Two Configs?**
- **Public**: Manages tenant records in `public` schema
- **Tenant**: Template for creating tenant-specific schemas

### 2. Application Bootstrap (`src/app.module.ts`)

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig, publicOrmConfig, tenantOrmConfig } from './config';
import { TenantsModule } from './modules/public/tenants.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { TenancyMiddleware } from './modules/tenancy/tenancy.middleware';
import { PostsModule } from './modules/tenanted/posts/posts.module';

@Module({
  imports: [
    // 1. Global configuration
    ConfigModule.forRoot({
      isGlobal: true,  // Available everywhere
      load: [databaseConfig, publicOrmConfig, tenantOrmConfig],
      envFilePath: '.env',
    }),
    
    // 2. Public schema connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('publicOrm'),
      }),
    }),
    
    // 3. Multi-tenancy infrastructure
    TenancyModule,      // Provides tenant connections
    TenantsModule,      // Manages tenant CRUD
    PostsModule,        // Example tenant-scoped resource
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenancy middleware to all routes except tenant management
    consumer
      .apply(TenancyMiddleware)
      .exclude('tenants', 'tenants/(.*)')  // Don't require tenant ID for tenant creation
      .forRoutes('*');
  }
}
```

**Breakdown:**
1. **ConfigModule**: Loads all configurations globally
2. **TypeOrmModule**: Connects to public schema for tenant metadata
3. **TenancyModule**: Provides request-scoped tenant connections
4. **Middleware**: Extracts tenant ID from headers (except for tenant routes)

**Learn More:**
- [NestJS Modules](https://docs.nestjs.com/modules)
- [NestJS Middleware](https://docs.nestjs.com/middleware)
- [TypeORM Module](https://docs.nestjs.com/techniques/database)

### 3. Tenancy Middleware (`src/modules/tenancy/tenancy.middleware.ts`)

Extracts and validates the tenant ID from request headers:

```typescript
import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID is missing in request headers');
    }

    // Attach tenant ID to request object
    (req as any).tenantId = tenantId;
    next();
  }
}
```

**What It Does:**
1. Reads `x-tenant-id` header from incoming request
2. Validates that tenant ID exists
3. Attaches tenant ID to request object for downstream use
4. Throws error if tenant ID is missing

**Applied To:** All routes except `/tenants/*` (see `app.module.ts`)

**Learn More:** [NestJS Middleware](https://docs.nestjs.com/middleware)

### 4. Tenancy Module (`src/modules/tenancy/tenancy.module.ts`)

The **heart** of the multi-tenancy system. Provides request-scoped database connections:

```typescript
import { Global, Module, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { CONNECTION } from './tenancy.symbols';
import { getTenantConnection } from './tenancy.utils';

const connectionFactory = {
  provide: CONNECTION,
  scope: Scope.REQUEST,  // 🔑 New instance per HTTP request
  useFactory: async (request: Request, configService: ConfigService) => {
    const { tenantId } = request as any;

    if (tenantId) {
      // Get tenant-specific configuration
      const tenantConfig = configService.get('tenantOrm');
      const maxPoolSize = configService.get('database.maxConnectionPoolSize');
      
      // Get or create connection for this tenant
      const connection = await getTenantConnection(tenantId, tenantConfig, maxPoolSize);
      
      // Create query runner for this request
      const queryRunner = await connection.createQueryRunner();
      await queryRunner.connect();
      
      return queryRunner.manager;
    }

    return null;
  },
  inject: [REQUEST, ConfigService],
};

@Global()  // 🌍 Available everywhere
@Module({
  providers: [connectionFactory],
  exports: [CONNECTION],
})
export class TenancyModule {}
```

**Key Concepts:**

1. **`Scope.REQUEST`**: Creates a new provider instance for each HTTP request
   - [Injection Scopes Docs](https://docs.nestjs.com/fundamentals/injection-scopes)

2. **`useFactory`**: Dynamic provider that runs per request
   - Receives `REQUEST` object with tenant ID
   - Receives `ConfigService` for database config

3. **`getTenantConnection()`**: Manages connection pooling (see below)

4. **`@Global()`**: Makes `CONNECTION` token available in all modules

**Learn More:** [Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)

### 5. Connection Caching (`src/modules/tenancy/tenancy.utils.ts`)

Caches database connections to avoid creating new ones for every request:

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';

// In-memory cache of tenant connections
export const tenantConnections: { [schemaName: string]: DataSource } = {};

export async function getTenantConnection(
  tenantId: string,
  tenantConfig: DataSourceOptions,
  maxPoolSize: number,
): Promise<DataSource> {
  const connectionName = `tenant_${tenantId}`;

  // Return cached connection if exists
  if (tenantConnections[connectionName]) {
    return tenantConnections[connectionName];
  }

  // Create new connection for this tenant
  const dataSource = new DataSource({
    ...tenantConfig,
    name: connectionName,
    schema: connectionName,  // 🔑 Use tenant-specific schema
    poolSize: maxPoolSize,
  } as DataSourceOptions);

  await dataSource.initialize();
  
  // Cache for future requests
  tenantConnections[connectionName] = dataSource;
  
  return dataSource;
}
```

**How It Works:**
1. First request for tenant creates connection and caches it
2. Subsequent requests reuse cached connection
3. Each connection uses `schema: tenant_<uuid>` to isolate data

**Performance:** Avoids connection overhead on every request

### 6. Tenant-Scoped Service (`src/modules/tenanted/posts/posts.service.ts`)

Example of a service that uses tenant-scoped data:

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  private postRepository: Repository<Post>;

  constructor(@Inject(CONNECTION) private readonly connection: any) {
    // Get repository from tenant-specific connection
    this.postRepository = connection.getRepository(Post);
  }

  async create(createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create(createPostDto);
    return this.postRepository.save(post);
  }

  async findAll(): Promise<Post[]> {
    // Automatically queries tenant_<uuid>.posts table
    return this.postRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }
}
```

**Key Points:**
1. **No `scope: Scope.REQUEST` needed** - Inherits from `CONNECTION` provider
2. **Injects `CONNECTION`** - Gets tenant-specific database connection
3. **No manual tenant filtering** - All queries automatically scoped to tenant schema
4. **Clean code** - No mention of tenancy in business logic

**Learn More:** [TypeORM Repository API](https://typeorm.io/repository-api)

### 7. Tenant Creation Flow

When you create a new tenant via `POST /tenants`:

```typescript
// src/modules/public/tenants.service.ts
async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
  // 1. Create tenant record in public schema
  const tenant = new Tenant();
  tenant.name = createTenantDto.name;
  tenant.subdomain = createTenantDto.subdomain || null;
  await this.dataSource.getRepository(Tenant).save(tenant);

  // 2. Create PostgreSQL schema for this tenant
  const schemaName = `tenant_${tenant.id}`;
  await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // 3. Run all tenant migrations in new schema
  await this.runMigrations(schemaName);

  return tenant;
}

private async runMigrations(schemaName: string) {
  const tenantConfig = this.configService.get('tenantOrm');
  const tenantDataSource = new DataSource({
    ...tenantConfig,
    schema: schemaName,
  });

  await tenantDataSource.initialize();
  await tenantDataSource.runMigrations();  // 🔑 Auto-apply migrations
  await tenantDataSource.destroy();
}
```

**What Happens:**
1. Tenant record saved to `public.tenants` table
2. New schema created: `tenant_<uuid>`
3. All migrations from `src/modules/tenanted/migrations/` run in new schema
4. Schema is ready for tenant-specific data

### 8. Request Flow Example

Let's trace a request: `GET /posts` with `x-tenant-id: abc-123`

```
1. Request arrives
   ↓
2. TenancyMiddleware extracts tenant ID
   req.tenantId = 'abc-123'
   ↓
3. PostsController.findAll() called
   ↓
4. NestJS resolves PostsService dependencies
   ↓
5. TenancyModule.connectionFactory runs
   - Reads req.tenantId = 'abc-123'
   - Calls getTenantConnection('abc-123', config, poolSize)
   - Returns connection to tenant_abc-123 schema
   ↓
6. PostsService constructor receives CONNECTION
   - Creates repository from tenant_abc-123 connection
   ↓
7. postRepository.find() executes
   - Queries: SELECT * FROM tenant_abc-123.posts
   ↓
8. Results returned (only tenant abc-123's posts)
```

**Data Isolation:** Tenant `xyz-456` making the same request would query `tenant_xyz-456.posts` instead.

---

## API Usage

### Create a Tenant

```bash
POST http://localhost:3000/tenants
Content-Type: application/json

{
  "name": "Acme Corp",
  "subdomain": "acme"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "subdomain": "acme",
  "createdAt": "2024-01-20T10:00:00.000Z",
  "updatedAt": "2024-01-20T10:00:00.000Z"
}
```

This automatically:
1. Creates a tenant record in the public schema
2. Creates a new PostgreSQL schema `tenant_<uuid>`
3. Runs all tenant migrations in the new schema

### List All Tenants

```bash
GET http://localhost:3000/tenants
```

### Get Tenant by ID

```bash
GET http://localhost:3000/tenants/:id
```

### Access Tenant-Specific Routes

Include the `x-tenant-id` header in requests:

```bash
GET http://localhost:3000/your-route
x-tenant-id: 550e8400-e29b-41d4-a716-446655440000
```

---

## CRUD Example: Posts

A complete CRUD implementation demonstrating tenant-scoped operations.

### Post Entity (`src/modules/tenanted/posts/entities/post.entity.ts`)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ default: false })
  published: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Posts Service (Tenant-Scoped)

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  private postRepository: Repository<Post>;

  constructor(@Inject(CONNECTION) private readonly connection: any) {
    this.postRepository = connection.getRepository(Post);
  }

  async create(createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create(createPostDto);
    return this.postRepository.save(post);
  }

  async findAll(): Promise<Post[]> {
    return this.postRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findPublished(): Promise<Post[]> {
    return this.postRepository.find({
      where: { published: true },
      order: { createdAt: 'DESC' },
    });
  }
}
```

### API Endpoints

**Create Post:**
```bash
POST /posts
Content-Type: application/json
x-tenant-id: <tenant-uuid>

{
  "title": "My First Post",
  "content": "This is tenant-specific content",
  "published": true
}
```

**Get All Posts (for tenant):**
```bash
GET /posts
x-tenant-id: <tenant-uuid>
```

**Get Published Posts:**
```bash
GET /posts/published
x-tenant-id: <tenant-uuid>
```

### Testing Data Isolation

```bash
# 1. Create Tenant A
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Tenant A", "subdomain": "tenant-a"}'
# Response: {"id": "uuid-a", ...}

# 2. Create Tenant B
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Tenant B", "subdomain": "tenant-b"}'
# Response: {"id": "uuid-b", ...}

# 3. Create post for Tenant A
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: uuid-a" \
  -d '{"title": "Tenant A Post", "content": "A content", "published": true}'

# 4. Create post for Tenant B
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: uuid-b" \
  -d '{"title": "Tenant B Post", "content": "B content", "published": true}'

# 5. Get Tenant A posts (only sees their own)
curl http://localhost:3000/posts -H "x-tenant-id: uuid-a"
# Returns: [{"title": "Tenant A Post", ...}]

# 6. Get Tenant B posts (only sees their own)
curl http://localhost:3000/posts -H "x-tenant-id: uuid-b"
# Returns: [{"title": "Tenant B Post", ...}]
```

✅ **Data is completely isolated!** Each tenant only sees their own posts.

---

## Adding New Tenant Resources

Follow these steps to add new tenant-scoped resources (e.g., Comments, Orders, etc.):

### Step 1: Create Entity

Create entity in `src/modules/tenanted/<resource>/entities/`:

```typescript
// src/modules/tenanted/comments/entities/comment.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column()
  postId: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Step 2: Create Service

Inject `CONNECTION` token for tenant-scoped repository:

```typescript
// src/modules/tenanted/comments/comments.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  private commentRepository: Repository<Comment>;

  constructor(@Inject(CONNECTION) private readonly connection: any) {
    this.commentRepository = connection.getRepository(Comment);
  }

  async create(createCommentDto: CreateCommentDto): Promise<Comment> {
    const comment = this.commentRepository.create(createCommentDto);
    return this.commentRepository.save(comment);
  }

  async findByPost(postId: string): Promise<Comment[]> {
    return this.commentRepository.find({ where: { postId } });
  }
}
```

### Step 3: Create Controller

```typescript
// src/modules/tenanted/comments/comments.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CommentsService } from './comments.service';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@Body() createCommentDto: CreateCommentDto) {
    return this.commentsService.create(createCommentDto);
  }

  @Get('post/:postId')
  findByPost(@Param('postId') postId: string) {
    return this.commentsService.findByPost(postId);
  }
}
```

### Step 4: Create Module

```typescript
// src/modules/tenanted/comments/comments.module.ts
import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
```

### Step 5: Import in AppModule

```typescript
// src/app.module.ts
import { CommentsModule } from './modules/tenanted/comments/comments.module';

@Module({
  imports: [
    // ... other imports
    CommentsModule,  // Add here
  ],
})
export class AppModule {}
```

### Step 6: Generate Migration

```bash
# Generate migration for tenant schema
yarn migration:generate src/modules/tenanted/migrations/AddComments

# Migration will be auto-applied to:
# - All new tenants (on creation)
# - Existing tenants (run manually if needed)
```

**That's it!** Your new resource is now tenant-scoped and ready to use.

---

## Migrations

This project uses **two separate migration systems** for public and tenant schemas.

### Public Schema Migrations

Public migrations manage tenant metadata (the `tenants` table in the `public` schema).

**Generate Migration:**
```bash
# After modifying entities in src/modules/public/entities/
yarn migration:generate src/modules/public/migrations/MigrationName
```

**Example:**
```bash
yarn migration:generate src/modules/public/migrations/CreateTenantsTable
```

**Run Migrations:**
```bash
yarn migration:run
```

**Revert Migration:**
```bash
yarn migration:revert
```

### Tenant Schema Migrations

Tenant migrations manage tenant-specific tables (like `posts`, `comments`, etc.) that exist in each `tenant_<uuid>` schema.

**Generate Migration:**
```bash
# After modifying entities in src/modules/tenanted/
yarn migration:generate:tenant src/modules/tenanted/migrations/MigrationName
```

**Example:**
```bash
# After creating the Post entity
yarn migration:generate:tenant src/modules/tenanted/migrations/CreatePostsTable
```

### How Tenant Migrations Work

⚠️ **Important:** Tenant migrations are **NOT run manually**. They automatically apply when:

1. **New tenant is created** - All existing migrations run in the new `tenant_<uuid>` schema
2. **On tenant creation**, this happens:

```typescript
// src/modules/public/tenants.service.ts
async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
  // 1. Save tenant record to public.tenants
  const tenant = await this.saveTenant(createTenantDto);

  // 2. Create PostgreSQL schema
  const schemaName = `tenant_${tenant.id}`;
  await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // 3. Run ALL tenant migrations in the new schema
  await this.runMigrations(schemaName);

  return tenant;
}

private async runMigrations(schemaName: string) {
  const tenantDataSource = new DataSource({
    ...tenantConfig,
    schema: schemaName,  // 🔑 Run in tenant's schema
  });

  await tenantDataSource.initialize();
  await tenantDataSource.runMigrations();  // Auto-apply all migrations
  await tenantDataSource.destroy();
}
```

### Complete Migration Example

Let's add a `Comment` entity:

**Step 1: Create Entity**
```typescript
// src/modules/tenanted/comments/entities/comment.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column()
  postId: string;
}
```

**Step 2: Generate Migration**
```bash
yarn migration:generate:tenant src/modules/tenanted/migrations/CreateCommentsTable
```

**Output:**
```
Migration src/modules/tenanted/migrations/1234567890-CreateCommentsTable.ts has been generated successfully.
```

**Step 3: Create New Tenant**
```bash
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Corp", "subdomain": "test"}'
```

**What Happens:**
1. Tenant record created in `public.tenants`
2. Schema `tenant_<uuid>` created
3. **All migrations run** (including `CreateCommentsTable`)
4. New tenant has `posts` AND `comments` tables ready!

### Applying Migrations to Existing Tenants

If you add a new migration and need to apply it to **existing** tenants, use the migration runner:

```bash
yarn migration:run:tenant
```

**What it does:**
1. Connects to the public schema and fetches all tenants
2. Loops through each tenant schema (`tenant_<uuid>`)
3. Runs pending migrations on each schema
4. **If any migration fails**, automatically rolls back all successful migrations
5. Provides a detailed summary

**Example output:**
```
✅ Connected to public schema

📋 Found 3 tenant(s) to migrate:

   1. Acme Corp (tenant_abc-123)
   2. Tech Inc (tenant_def-456)
   3. Startup LLC (tenant_ghi-789)

🔄 Migrating tenant_abc-123...
   ✅ Applied 1 migration(s)
      - CreateCommentsTable1760977872158

🔄 Migrating tenant_def-456...
   ✅ Applied 1 migration(s)
      - CreateCommentsTable1760977872158

🔄 Migrating tenant_ghi-789...
   ✅ Applied 1 migration(s)
      - CreateCommentsTable1760977872158

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Migration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successful: 3
❌ Failed: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 All tenant migrations completed successfully!
```

**Rollback on Failure:**

If a migration fails on any tenant, all previously successful migrations are automatically rolled back:

```
🔄 Migrating tenant_abc-123...
   ✅ Applied 1 migration(s)

🔄 Migrating tenant_def-456...
   ❌ Failed: syntax error at or near "INVALID"

🔄 Rolling back all successful migrations...
   🔄 Rolling back tenant_abc-123...
      ✅ Rolled back successfully

❌ Migration failed for tenant_def-456. All migrations have been rolled back.
```

This ensures **all tenants stay in sync** - either all get the migration or none do.

### Migration Commands Reference

**Public Schema:**
```bash
yarn migration:generate src/modules/public/migrations/Name  # Generate
yarn migration:run                                          # Run
yarn migration:revert                                       # Revert
```

**Tenant Schema:**
```bash
yarn migration:generate:tenant src/modules/tenanted/migrations/Name  # Generate
yarn migration:run:tenant                                            # Run on ALL existing tenants
yarn migration:revert:tenant                                         # Revert (use with caution)
```

**Note:** New tenants automatically get all migrations on creation. Use `yarn migration:run:tenant` only when you need to apply new migrations to existing tenants.

### Best Practices

✅ **DO:**
- Generate migrations for all entity changes
- Review generated migrations before committing
- Test with a new tenant first
- Keep migrations small and focused
- Version control all migration files

❌ **DON'T:**
- Edit generated migrations unless necessary
- Delete old migration files
- Run tenant migrations manually (they auto-run)
- Use `synchronize: true` in production

**Learn More:** See [MIGRATIONS_GUIDE.md](MIGRATIONS_GUIDE.md) for detailed documentation.

---

## Configuration

All configuration is centralized in `src/config/` using [@nestjs/config](https://docs.nestjs.com/techniques/configuration).

### Environment Variables

```env
DB_HOST=localhost              # PostgreSQL host
DB_PORT=5432                   # PostgreSQL port
DB_USERNAME=postgres           # Database user
DB_PASSWORD=your_password      # Database password
DB_NAME=multi_tenancy_db       # Database name
MAX_CONNECTION_POOL_SIZE=10    # Max connections per tenant
```

### Accessing Configuration

In any service:

```typescript
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService) {}

  getDbHost() {
    return this.configService.get('database.host');
  }
}
```

**Learn More:** [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

---

## Available Scripts

```bash
# Development
yarn start:dev          # Start with hot reload
yarn start:debug        # Start in debug mode

# Production
yarn build              # Build for production
yarn start:prod         # Run production build

# Migrations (Public Schema)
yarn migration:generate src/modules/public/migrations/MigrationName
yarn migration:run      # Run pending migrations
yarn migration:revert   # Revert last migration

# Testing
yarn test               # Run unit tests
yarn test:e2e           # Run e2e tests
yarn test:cov           # Test coverage

# Code Quality
yarn lint               # Lint code
yarn format             # Format code
```

---

## Security & Best Practices

### Data Isolation

✅ **Physical Separation**: Each tenant has their own PostgreSQL schema  
✅ **No Cross-Tenant Queries**: Impossible to accidentally query wrong tenant  
✅ **No Row-Level Filtering**: No need for `WHERE tenantId = ?` in every query  
✅ **Schema-Level Permissions**: Can set PostgreSQL permissions per schema  

### Performance

✅ **Connection Pooling**: Connections cached and reused per tenant  
✅ **No Query Overhead**: No row-level filtering on every query  
✅ **Indexed Naturally**: Each schema has its own indexes  

### Scalability

✅ **Easy to Shard**: Move tenant schemas to different databases  
✅ **Per-Tenant Backups**: Backup/restore individual tenants easily  
✅ **Independent Scaling**: Scale resources per tenant if needed  

### Best Practices

1. **Always validate tenant ID** in middleware
2. **Use connection pooling** (already implemented)
3. **Monitor connection counts** per tenant
4. **Set appropriate pool sizes** based on load
5. **Regular backups** of both public and tenant schemas
6. **Test data isolation** thoroughly

---

## References

### Original Article

📖 **[NestJS and TypeORM — Efficient Schema-Level Multi-Tenancy](https://dev.to/logeek/nestjs-and-typeorm-efficient-schema-level-multi-tenancy-with-auto-generated-migrations-a-dx-approach-jla)** by [@logeek](https://dev.to/logeek)

This implementation is based on the patterns described in this excellent article.

### Documentation

**NestJS:**
- [Official Documentation](https://docs.nestjs.com)
- [Modules](https://docs.nestjs.com/modules)
- [Middleware](https://docs.nestjs.com/middleware)
- [Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [Injection Scopes](https://docs.nestjs.com/fundamentals/injection-scopes)
- [Configuration](https://docs.nestjs.com/techniques/configuration)

**TypeORM:**
- [Official Documentation](https://typeorm.io)
- [Data Source](https://typeorm.io/data-source)
- [Repository API](https://typeorm.io/repository-api)
- [Migrations](https://typeorm.io/migrations)
- [Entities](https://typeorm.io/entities)

**PostgreSQL:**
- [Schema Documentation](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)

### Related Topics

- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/multi-tenancy)
- [Database Sharding](https://en.wikipedia.org/wiki/Shard_(database_architecture))
- [Request Scoping in NestJS](https://docs.nestjs.com/fundamentals/injection-scopes#request-provider)

---

## License

This project is [MIT licensed](LICENSE).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ using [NestJS](https://nestjs.com), [TypeORM](https://typeorm.io), and [PostgreSQL](https://www.postgresql.org)**
