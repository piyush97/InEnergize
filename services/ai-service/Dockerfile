# AI Service Dockerfile

# Use official Node.js runtime as the base image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Create logs directory
RUN mkdir -p logs

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm install

# Copy the source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose the port the app runs on
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1

# Define the command to run the application
CMD ["node", "dist/index.js"]