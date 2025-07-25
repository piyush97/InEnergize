import './module-alias';
import { App } from './app';
import { WebSocketService } from '@/services/websocket.service';
import { logger } from '@/config/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  try {
    // Create application instance
    const app = new App();

    // Initialize database connections
    await app.initializeDatabase();

    // Initialize WebSocket service if enabled
    let wsService: WebSocketService | null = null;
    if (process.env.WS_ENABLED === 'true') {
      wsService = new WebSocketService();
      const wsPort = parseInt(process.env.WS_PORT || '3007');
      wsService.initialize(wsPort);
      logger.info('WebSocket service initialized', { port: wsPort });
    }

    // Start HTTP server
    await app.listen();

    // Setup graceful shutdown for WebSocket service
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down WebSocket service`);
      if (wsService) {
        wsService.close();
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start analytics service', { error });
    process.exit(1);
  }
}

// Start the application
bootstrap();