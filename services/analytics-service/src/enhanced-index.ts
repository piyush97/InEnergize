import 'module-alias/register';
import dotenv from 'dotenv';
import { EnhancedAnalyticsApp } from './enhanced-app';
import { logger } from '@/config/logger';

// Load environment variables
dotenv.config();

/**
 * Enhanced Analytics Service Entry Point
 * 
 * Features:
 * - TimescaleDB integration with hypertables and continuous aggregates
 * - Real-time WebSocket streaming with subscriptions
 * - Batch data ingestion pipeline with Redis queuing
 * - Smart alerting system with configurable thresholds
 * - Automated data retention and cleanup policies
 * - Performance monitoring and metrics collection
 * - Database migrations and development seeding
 */

async function startEnhancedAnalyticsService(): Promise<void> {
  try {
    logger.info('Starting Enhanced Analytics Service...');

    // Validate required environment variables
    const requiredEnvVars = [
      'TIMESCALE_HOST',
      'TIMESCALE_USER', 
      'TIMESCALE_PASSWORD',
      'TIMESCALE_DATABASE',
      'REDIS_HOST',
      'JWT_SECRET'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    // Create and initialize the enhanced application
    const app = new EnhancedAnalyticsApp();

    // Initialize all services (database, WebSocket, ingestion, alerting)
    await app.initializeServices();

    // Start the HTTP server
    await app.listen();

    logger.info('Enhanced Analytics Service startup complete');

  } catch (error) {
    logger.error('Failed to start Enhanced Analytics Service', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, initiating graceful shutdown');
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, initiating graceful shutdown');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
  process.exit(1);
});

// Start the service
startEnhancedAnalyticsService().catch((error) => {
  logger.error('Service startup failed', { error });
  process.exit(1);
});