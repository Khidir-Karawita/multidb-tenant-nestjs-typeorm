import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

interface RevertResult {
  schemaName: string;
  success: boolean;
  error?: string;
}

async function revertTenants() {
  const results: RevertResult[] = [];
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
      'SELECT id, name FROM tenants ORDER BY "createdAt" DESC',
    );

    if (tenants.length === 0) {
      console.log('⚠️  No tenants found. Nothing to revert.');
      await publicDataSource.destroy();
      return;
    }

    console.log(`📋 Found ${tenants.length} tenant(s) to revert:\n`);
    tenants.forEach((t: any, i: number) => {
      console.log(`   ${i + 1}. ${t.name} (tenant_${t.id})`);
    });
    console.log('');

    // 3. Revert last migration for each tenant schema
    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id}`;
      let tenantDataSource: DataSource | null = null;

      try {
        console.log(`🔄 Reverting last migration for ${schemaName}...`);

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

        // Revert the last migration
        await tenantDataSource.undoLastMigration();

        console.log(`   ✅ Successfully reverted last migration\n`);

        await tenantDataSource.destroy();

        results.push({
          schemaName,
          success: true,
        });
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

        // Continue with other tenants instead of stopping
        console.log('⚠️  Continuing with remaining tenants...\n');
      }
    }

    // 4. Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Revert Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Successful: ${results.filter((r) => r.success).length}`);
    console.log(`❌ Failed: ${results.filter((r) => !r.success).length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.some((r) => !r.success)) {
      console.log('⚠️  Some reverts failed. Check errors above.\n');
      const failedSchemas = results.filter((r) => !r.success);
      failedSchemas.forEach((r) => {
        console.log(`   - ${r.schemaName}: ${r.error}`);
      });
      console.log('');
    }

    if (results.every((r) => r.success)) {
      console.log('🎉 All tenant migrations reverted successfully!\n');
    }

    await publicDataSource.destroy();
  } catch (error) {
    if (publicDataSource && publicDataSource.isInitialized) {
      await publicDataSource.destroy();
    }

    console.error('\n❌ Revert process failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run reverts
revertTenants().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
