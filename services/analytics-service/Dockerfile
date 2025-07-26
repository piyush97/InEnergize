# Multi-stage build for production efficiency
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --silent

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Production stage
FROM node:22-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S analytics -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p logs && chown -R analytics:nodejs logs

# Set proper permissions
RUN chown -R analytics:nodejs /app

# Switch to non-root user
USER analytics

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e " \
    const http = require('http'); \
    const options = { \
      host: 'localhost', \
      port: process.env.PORT || 3006, \
      path: '/health', \
      timeout: 2000 \
    }; \
    http.get(options, (res) => { \
      if (res.statusCode === 200) process.exit(0); \
      else process.exit(1); \
    }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "dist/index.js"]