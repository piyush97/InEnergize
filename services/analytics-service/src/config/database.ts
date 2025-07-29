import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from './logger';

export interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

class DatabaseManager {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5432'),
      user: process.env.TIMESCALE_USER || 'inergize_user',
      password: process.env.TIMESCALE_PASSWORD || '',
      database: process.env.TIMESCALE_DATABASE || 'inergize_analytics',
      max: parseInt(process.env.TIMESCALE_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: parseInt(process.env.TIMESCALE_CONNECTION_TIMEOUT || '60000'),
    };
  }

  public async connect(): Promise<void> {
    try {
      this.pool = new Pool(this.config);
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Connected to TimescaleDB successfully', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      });
    } catch (error) {
      logger.error('Failed to connect to TimescaleDB', { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        config: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user
        }
      });
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }
    return this.pool.connect();
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }
    
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Query executed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      logger.error('Query failed', { query: text, params, error });
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection closed');
    }
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }

  public getPool(): Pool | null {
    return this.pool;
  }
}

export const database = new DatabaseManager();
export default database;