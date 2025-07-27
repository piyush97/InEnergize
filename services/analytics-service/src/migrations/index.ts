import { database } from '@/config/database';
import { logger } from '@/config/logger';
import fs from 'fs';
import path from 'path';

interface Migration {
  id: number;
  name: string;
  filename: string;
  executed_at?: Date;
}

export class MigrationRunner {
  private readonly migrationTableName = 'analytics_migrations';
  private readonly migrationsPath = path.join(__dirname);

  /**
   * Initialize migration system
   */
  public async initialize(): Promise<void> {
    try {
      await this.createMigrationTable();
      logger.info('Migration system initialized');
    } catch (error) {
      logger.error('Failed to initialize migration system', { error });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<void> {
    try {
      logger.info('Starting migration process');

      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return;
      }

      logger.info('Found pending migrations', { 
        count: pendingMigrations.length,
        migrations: pendingMigrations.map(m => m.name)
      });

      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration process failed', { error });
      throw error;
    }
  }

  /**
   * Create migration tracking table
   */
  private async createMigrationTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTableName} (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await database.query(query);
    logger.debug('Migration table created or verified');
  }

  /**
   * Get all migration files
   */
  private getAllMigrationFiles(): Migration[] {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const match = filename.match(/^(\d+)-(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename format: ${filename}`);
      }

      return {
        id: parseInt(match[1]),
        name: match[2],
        filename
      };
    });
  }

  /**
   * Get executed migrations from database
   */
  private async getExecutedMigrations(): Promise<Migration[]> {
    try {
      const result = await database.query(`
        SELECT id, name, filename, executed_at 
        FROM ${this.migrationTableName}
        ORDER BY id ASC
      `);

      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        filename: row.filename,
        executed_at: row.executed_at
      }));
    } catch (error) {
      // Table might not exist yet
      logger.debug('Could not fetch executed migrations, table may not exist');
      return [];
    }
  }

  /**
   * Get pending migrations
   */
  private async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = this.getAllMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    const executedIds = new Set(executedMigrations.map(m => m.id));

    return allMigrations.filter(migration => !executedIds.has(migration.id));
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    const client = await database.getClient();
    
    try {
      await client.query('BEGIN');

      logger.info('Running migration', { 
        id: migration.id, 
        name: migration.name 
      });

      // Read and execute migration SQL
      const sqlPath = path.join(this.migrationsPath, migration.filename);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      // Split SQL by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (error) {
          logger.error('Failed to execute SQL statement', { 
            error, 
            statement: statement.substring(0, 100) + '...',
            migration: migration.name
          });
          throw error;
        }
      }

      // Record migration as executed
      await client.query(`
        INSERT INTO ${this.migrationTableName} (id, name, filename)
        VALUES ($1, $2, $3)
      `, [migration.id, migration.name, migration.filename]);

      await client.query('COMMIT');

      logger.info('Migration completed', { 
        id: migration.id, 
        name: migration.name 
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Migration failed, rolled back', { 
        error, 
        migration: migration.name 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rollback last migration (USE WITH CAUTION)
   */
  public async rollbackLastMigration(): Promise<void> {
    try {
      const executedMigrations = await this.getExecutedMigrations();
      
      if (executedMigrations.length === 0) {
        logger.warn('No migrations to rollback');
        return;
      }

      const lastMigration = executedMigrations[executedMigrations.length - 1];

      logger.warn('Rolling back migration', { 
        id: lastMigration.id, 
        name: lastMigration.name 
      });

      // Check if rollback SQL exists
      const rollbackPath = path.join(
        this.migrationsPath, 
        `${lastMigration.id.toString().padStart(3, '0')}-${lastMigration.name}-rollback.sql`
      );

      if (!fs.existsSync(rollbackPath)) {
        throw new Error(`Rollback file not found: ${rollbackPath}`);
      }

      const client = await database.getClient();
      
      try {
        await client.query('BEGIN');

        // Execute rollback SQL
        const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
        const statements = rollbackSql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);

        for (const statement of statements) {
          await client.query(statement);
        }

        // Remove migration record
        await client.query(`
          DELETE FROM ${this.migrationTableName} 
          WHERE id = $1
        `, [lastMigration.id]);

        await client.query('COMMIT');

        logger.info('Migration rolled back successfully', { 
          id: lastMigration.id, 
          name: lastMigration.name 
        });

      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Rollback failed', { error, migration: lastMigration.name });
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to rollback migration', { error });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  public async getMigrationStatus(): Promise<{
    executed: Migration[];
    pending: Migration[];
    total: number;
  }> {
    try {
      const allMigrations = this.getAllMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();
      const pendingMigrations = await this.getPendingMigrations();

      return {
        executed: executedMigrations,
        pending: pendingMigrations,
        total: allMigrations.length
      };
    } catch (error) {
      logger.error('Failed to get migration status', { error });
      throw error;
    }
  }

  /**
   * Verify database schema integrity
   */
  public async verifySchemaIntegrity(): Promise<boolean> {
    try {
      // Check required tables exist
      const requiredTables = [
        'analytics.profile_metrics',
        'analytics.engagement_metrics',
        'analytics.real_time_events',
        'analytics.metric_aggregations',
        'analytics.alert_configs',
        'analytics.alert_history',
        'analytics.user_goals',
        'analytics.performance_metrics'
      ];

      for (const table of requiredTables) {
        const result = await database.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = split_part($1, '.', 1)
              AND table_name = split_part($1, '.', 2)
          )
        `, [table]);

        if (!result.rows[0].exists) {
          logger.error('Required table missing', { table });
          return false;
        }
      }

      // Check TimescaleDB extension
      const extensionResult = await database.query(`
        SELECT EXISTS (
          SELECT FROM pg_extension 
          WHERE extname = 'timescaledb'
        )
      `);

      if (!extensionResult.rows[0].exists) {
        logger.error('TimescaleDB extension not installed');
        return false;
      }

      // Check hypertables
      const hypertables = await database.query(`
        SELECT schemaname, tablename 
        FROM timescaledb_information.hypertables
        WHERE schemaname = 'analytics'
      `);

      const expectedHypertables = [
        'profile_metrics',
        'engagement_metrics', 
        'real_time_events',
        'metric_aggregations',
        'alert_history',
        'performance_metrics'
      ];

      const actualHypertables = hypertables.rows.map((row: any) => row.tablename);
      
      for (const expected of expectedHypertables) {
        if (!actualHypertables.includes(expected)) {
          logger.error('Required hypertable missing', { hypertable: expected });
          return false;
        }
      }

      // Check continuous aggregates
      const aggregates = await database.query(`
        SELECT view_name 
        FROM timescaledb_information.continuous_aggregates
        WHERE view_schema = 'analytics'
      `);

      const expectedAggregates = [
        'profile_metrics_5min',
        'profile_metrics_hourly',
        'profile_metrics_daily',
        'engagement_hourly'
      ];

      const actualAggregates = aggregates.rows.map((row: any) => row.view_name);
      
      for (const expected of expectedAggregates) {
        if (!actualAggregates.includes(expected)) {
          logger.warn('Continuous aggregate missing', { aggregate: expected });
          // Don't fail on missing aggregates, just warn
        }
      }

      logger.info('Schema integrity verification passed');
      return true;

    } catch (error) {
      logger.error('Schema integrity verification failed', { error });
      return false;
    }
  }

  /**
   * Create a new migration file template
   */
  public createMigrationTemplate(name: string): string {
    const timestamp = Date.now();
    const id = Math.floor(timestamp / 1000); // Unix timestamp as ID
    const filename = `${id.toString().padStart(3, '0')}-${name.replace(/\s+/g, '-').toLowerCase()}.sql`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add description here

-- Begin migration
BEGIN;

-- Add your SQL statements here
-- Example:
-- CREATE TABLE analytics.example_table (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- End migration
COMMIT;

-- Note: Create corresponding rollback file if needed:
-- ${id.toString().padStart(3, '0')}-${name.replace(/\s+/g, '-').toLowerCase()}-rollback.sql
`;

    fs.writeFileSync(filepath, template);
    
    logger.info('Migration template created', { filename: filepath });
    return filepath;
  }
}