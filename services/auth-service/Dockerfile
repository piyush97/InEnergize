# Base Node.js image with Alpine for minimal size
FROM node:22-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S inergize -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies stage
FROM base AS deps

# Install production and dev dependencies
RUN npm ci --include=dev && \
    npm cache clean --force

# Build stage
FROM base AS build

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM base AS production

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3001

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf ~/.npm

# Copy built application from build stage
COPY --from=build --chown=inergize:nodejs /app/dist ./dist

# Set proper permissions
RUN chown -R inergize:nodejs /app
USER inergize

# Expose port
EXPOSE 3001

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http'); http.get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "./dist/index.js"]