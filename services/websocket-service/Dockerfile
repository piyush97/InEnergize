# Use Node.js 18 LTS
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Create logs directory
RUN mkdir -p logs

# Install app dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S websocket && \
    adduser -S websocket -u 1001

# Change ownership of the app directory
RUN chown -R websocket:websocket /usr/src/app

# Switch to non-root user
USER websocket

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3007/health || exit 1

# Start the application
CMD ["npm", "start"]