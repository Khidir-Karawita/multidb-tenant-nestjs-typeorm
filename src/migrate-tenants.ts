import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

interface MigrationResult {
  schemaName: string;
  success: boolean;
  error?: string;
}

async function migrateTenants() {
  const results: MigrationResult[] = [];
  let publicDataSource: DataSource | null = null;

  try {
    // 1. Connect to public schema to get all tenants
    publicDataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'multi_tenancy_db',
    });

    await publicDataSource.initialize();
    console.log('✅ Connected to public schema\n');

    // 2. Get all tenant IDs
    const tenants = await publicDataSource.query(
      'SELECT id, name FROM tenants ORDER BY "createdAt"',
    );

    if (tenants.length === 0) {
      console.log('⚠️  No tenants found. Nothing to migrate.');
      await publicDataSource.destroy();
      return;
    }

    console.log(`📋 Found ${tenants.length} tenant(s) to migrate:\n`);
    tenants.forEach((t: any, i: number) => {
      console.log(`   ${i + 1}. ${t.name} (tenant_${t.id})`);
    });
    console.log('');

    // 3. Migrate each tenant schema
    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id}`;
      let tenantDataSource: DataSource | null = null;

      try {
        console.log(`🔄 Migrating ${schemaName}...`);

        // Create DataSource for this tenant schema
        tenantDataSource = new DataSource({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'multi_tenancy_db',
          schema: schemaName,
          entities: [
            __dirname + '/modules/tenanted/entities/*.entity{.ts,.js}',
            __dirname + '/modules/tenanted/**/entities/*.entity{.ts,.js}',
          ],
          migrations: [__dirname + '/modules/tenanted/migrations/*{.ts,.js}'],
          synchronize: false,
        });

        await tenantDataSource.initialize();

        await tenantDataSource.query(
          `SET search_path TO "${schemaName}", public`,
        );
        await tenantDataSource.query(
          `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
        );
        // Run pending migrations
        const pendingMigrations = await tenantDataSource.showMigrations();

        if (pendingMigrations) {
          const executedMigrations = await tenantDataSource.runMigrations();

          if (executedMigrations.length > 0) {
            console.log(
              `   ✅ Applied ${executedMigrations.length} migration(s)`,
            );
            executedMigrations.forEach((m) => {
              console.log(`      - ${m.name}`);
            });
          } else {
            console.log(`   ℹ️  No pending migrations`);
          }
        } else {
          console.log(`   ℹ️  No pending migrations`);
        }

        await tenantDataSource.destroy();

        results.push({
          schemaName,
          success: true,
        });

        console.log('');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Failed: ${errorMessage}\n`);

        results.push({
          schemaName,
          success: false,
          error: errorMessage,
        });

        // Clean up connection if it exists
        if (tenantDataSource && tenantDataSource.isInitialized) {
          await tenantDataSource.destroy();
        }

        // ROLLBACK: Revert all successful migrations
        console.log('🔄 Rolling back all successful migrations...\n');
        await rollbackSuccessfulMigrations(results.filter((r) => r.success));

        throw new Error(
          `Migration failed for ${schemaName}. All migrations have been rolled back.`,
        );
      }
    }

    // 4. Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Successful: ${results.filter((r) => r.success).length}`);
    console.log(`❌ Failed: ${results.filter((r) => !r.success).length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.every((r) => r.success)) {
      console.log('🎉 All tenant migrations completed successfully!\n');
    }

    await publicDataSource.destroy();
  } catch (error) {
    if (publicDataSource && publicDataSource.isInitialized) {
      await publicDataSource.destroy();
    }

    console.error('\n❌ Migration process failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function rollbackSuccessfulMigrations(
  successfulResults: MigrationResult[],
) {
  if (successfulResults.length === 0) {
    console.log('   ℹ️  No migrations to rollback\n');
    return;
  }

  // Rollback in reverse order
  for (let i = successfulResults.length - 1; i >= 0; i--) {
    const result = successfulResults[i];
    let tenantDataSource: DataSource | null = null;

    try {
      console.log(`   🔄 Rolling back ${result.schemaName}...`);

      tenantDataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'multi_tenancy_db',
        schema: result.schemaName,
        entities: [
          __dirname + '/modules/tenanted/entities/*.entity{.ts,.js}',
          __dirname + '/modules/tenanted/**/entities/*.entity{.ts,.js}',
        ],
        migrations: [__dirname + '/modules/tenanted/migrations/*{.ts,.js}'],
        synchronize: false,
      });

      await tenantDataSource.initialize();

      // Revert the last migration
      await tenantDataSource.undoLastMigration();

      console.log(`      ✅ Rolled back successfully`);

      await tenantDataSource.destroy();
    } catch (error) {
      console.error(
        `      ⚠️  Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (tenantDataSource && tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
    }
  }

  console.log('');
}

// Run migrations
migrateTenants().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
