# Hardened Base Image for InErgize Services
FROM node:22-alpine AS hardened-base

# Security metadata
LABEL security.hardened="true" \
      security.scan-date="" \
      security.base-image="node:22-alpine" \
      security.vulnerability-scan="required"

# Install security tools and hardening packages
RUN apk add --no-cache \
    dumb-init \
    su-exec \
    ca-certificates \
    curl \
    && apk upgrade --no-cache \
    # Remove unnecessary packages
    && apk del --no-cache \
        wget \
        linux-pam \
    # Create security-focused directory structure
    && mkdir -p /app /home/inergize/.cache \
    # Create non-root user with minimal privileges
    && addgroup -g 1001 -S inergize \
    && adduser -S inergize -u 1001 -G inergize -h /home/inergize -s /sbin/nologin \
    # Set secure permissions
    && chown -R inergize:inergize /home/inergize \
    && chmod 750 /home/inergize

# Set security environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1024" \
    NPM_CONFIG_CACHE=/home/inergize/.cache \
    USER=inergize \
    UID=1001 \
    GID=1001

# Security hardening: disable core dumps, set limits
RUN echo "* hard core 0" >> /etc/security/limits.conf \
    && echo "* soft core 0" >> /etc/security/limits.conf \
    && echo "* hard nofile 65536" >> /etc/security/limits.conf \
    && echo "* soft nofile 65536" >> /etc/security/limits.conf

# Remove shell access for security
RUN rm -rf /bin/sh /bin/bash /usr/bin/wget || true

WORKDIR /app

# Health check helper
COPY --chown=inergize:inergize infrastructure/docker/health-check.js /usr/local/bin/health-check.js
RUN chmod +x /usr/local/bin/health-check.js

# Security scanner placeholder
COPY --chown=inergize:inergize infrastructure/docker/scan-vulnerabilities.sh /usr/local/bin/scan-vulnerabilities.sh
RUN chmod +x /usr/local/bin/scan-vulnerabilities.sh

USER inergize

# Default security headers for health checks
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node /usr/local/bin/health-check.js

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]