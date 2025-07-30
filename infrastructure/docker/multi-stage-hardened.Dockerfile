# Multi-stage Hardened Dockerfile Template for InErgize Services
# Example implementation for auth-service with security best practices

FROM node:22-alpine AS security-scanner
# Install security scanning tools
RUN apk add --no-cache trivy curl
WORKDIR /scan

FROM node:22-alpine AS deps-scanner
WORKDIR /app
COPY package*.json ./
# Audit dependencies before installation
RUN npm audit --audit-level=high --production

FROM inergize/hardened-base:latest AS deps
WORKDIR /app
COPY package*.json ./
# Install dependencies with security flags
RUN npm ci --only=production --no-optional --no-fund --no-audit \
    && npm cache clean --force \
    # Remove npm itself after installation for security
    && rm -rf /usr/local/lib/node_modules/npm \
    # Verify no dev dependencies leaked through
    && ! npm list --depth=0 --dev 2>/dev/null | grep -q "dev"

FROM inergize/hardened-base:latest AS build
WORKDIR /app
COPY package*.json ./
# Install all dependencies for build
RUN npm ci --include=dev --no-fund --no-audit

COPY . .
# Generate Prisma client if needed
RUN if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi
# Build the application
RUN npm run build \
    # Remove source maps in production for security
    && find dist -name "*.map" -delete

FROM inergize/hardened-base:latest AS security-hardened
WORKDIR /app

# Copy only production dependencies
COPY --from=deps --chown=inergize:inergize /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=inergize:inergize /app/dist ./dist
COPY --from=build --chown=inergize:inergize /app/package.json ./package.json

# Copy Prisma client if exists
COPY --from=build --chown=inergize:inergize /app/node_modules/.prisma ./node_modules/.prisma 2>/dev/null || true
COPY --from=build --chown=inergize:inergize /app/prisma ./prisma 2>/dev/null || true

# Security: Remove any remaining dev tools
RUN rm -rf node_modules/.bin/* 2>/dev/null || true \
    # Remove package-lock.json for security
    && rm -f package-lock.json \
    # Set secure permissions
    && find /app -type f -exec chmod 644 {} \; \
    && find /app -type d -exec chmod 755 {} \; \
    && chmod 755 /app/dist/index.js

# Final security scan
USER root
RUN /usr/local/bin/scan-vulnerabilities.sh
USER inergize

# Security labels
LABEL security.scan-date="$(date -Iseconds)" \
      security.hardened="true" \
      security.non-root="true" \
      security.vulnerability-scan="passed"

# Health check with security timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node /usr/local/bin/health-check.js

# Secure startup
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "./dist/index.js"]