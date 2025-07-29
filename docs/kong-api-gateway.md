# Kong API Gateway Configuration for InErgize Platform

This document provides comprehensive documentation for the Kong API Gateway setup optimized for LinkedIn SaaS compliance and enterprise security.

## Overview

Kong serves as the centralized API Gateway for the InErgize platform, providing:

- **Service Registration & Routing**: All microservices are registered and routed through Kong
- **Authentication & Authorization**: JWT-based authentication with consumer management
- **Rate Limiting**: LinkedIn-compliant rate limiting with Redis backend
- **Security**: Enterprise-grade security headers, CORS, IP restrictions
- **Observability**: Comprehensive logging, metrics, and health monitoring
- **Performance**: Caching, load balancing, and circuit breaker patterns

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │────│   Kong Gateway   │────│  Microservices  │
│  (Port 3000)    │    │   (Port 8000)    │    │  (Ports 3001+)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                       ┌──────────────────┐
                       │   Kong Admin     │
                       │   (Port 8001)    │
                       └──────────────────┘
```

## Service Registration

### Registered Services

| Service | Upstream | Port | Route | Description |
|---------|----------|------|-------|-------------|
| auth-service | auth-service:3001 | 3001 | /api/v1/auth/* | Authentication & authorization |
| user-service | user-service:3002 | 3002 | /api/v1/users/* | User management |
| linkedin-service | linkedin-service:3003 | 3003 | /api/v1/linkedin/* | LinkedIn integration |
| analytics-service | analytics-service:3004 | 3004 | /api/v1/analytics/* | Analytics & metrics |

### Health Checks

All services have active and passive health checks:

- **Active**: HTTP GET to `/health` endpoint every 15-30 seconds
- **Passive**: Monitor responses for 429, 500, 502, 503, 504 status codes
- **Circuit Breaker**: Automatic traffic reduction for unhealthy upstreams

## Security Configuration

### Authentication

Kong uses JWT authentication with multiple verification layers:

```yaml
jwt:
  - uri_param_names: [jwt]
  - cookie_names: [jwt] 
  - header_names: [authorization]
  - claims_to_verify: [exp, iat]
```

### Consumers

Pre-configured consumers for different client types:

- **inergize-web-app**: Web application consumer
- **inergize-mobile-app**: Mobile application consumer  
- **admin-user**: Administrative access consumer

### Rate Limiting

LinkedIn-compliant rate limiting with Redis backend:

#### Auth Service
- 60 requests/minute
- 1,000 requests/hour
- 10,000 requests/day

#### LinkedIn Service (Critical Compliance)
- 10 requests/minute
- 200 requests/hour
- 2,000 requests/day

#### User Service
- 100 requests/minute
- 2,000 requests/hour
- 20,000 requests/day

#### Analytics Service
- 200 requests/minute
- 5,000 requests/hour
- 50,000 requests/day

### Security Headers

Standard security headers applied globally:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'
```

### CORS Configuration

Environment-specific CORS policies:

**Development**: Permissive (`*` origins)
**Production**: Strict (specific domains only)

## Environment Configurations

### Development (kong.dev.yml)

- Relaxed security for development
- Verbose logging enabled
- Self-signed SSL certificates
- Permissive rate limits
- Local service targets

### Production (kong.prod.yml)

- Maximum security policies
- SSL/TLS required
- Conservative rate limiting
- IP whitelisting
- Audit logging
- Circuit breakers
- Bot detection

### Default (kong.yml)

- Balanced configuration
- Container-based service discovery
- Moderate security policies
- Standard logging

## LinkedIn Compliance Features

### Rate Limiting Strategy

LinkedIn API compliance requires extremely conservative rate limiting:

```yaml
linkedin-service:
  rate-limiting:
    minute: 5      # Ultra-conservative
    hour: 100      # Well below LinkedIn limits
    day: 1000      # Safety buffer
```

### Request Monitoring

All LinkedIn API requests are:

- Logged with full context
- Rate limited per consumer
- Monitored for compliance violations
- Subject to circuit breaker protection

### Safety Features

- **Circuit Breaker**: Automatic traffic reduction on errors
- **Caching**: 5-minute cache for GET requests
- **Health Monitoring**: Continuous upstream health checks
- **Graceful Degradation**: Fallback behaviors for service failures

## Monitoring & Observability

### Health Check Endpoints

Kong provides comprehensive health monitoring:

```bash
# Kong health
curl http://localhost:8001/status

# Service health
curl http://localhost:8001/upstreams/{service}/health

# Configuration
curl http://localhost:8001/config
```

### Metrics

Kong exports metrics for:

- Request/response latency
- Status code distributions
- Upstream health status
- Rate limiting events
- Security violations

### Logging

Multi-level logging system:

- **Access Logs**: All requests/responses
- **Error Logs**: System errors and exceptions
- **Audit Logs**: Security events and violations
- **Compliance Logs**: LinkedIn API interactions

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for management scripts)
- jq (for JSON processing)
- openssl (for certificate generation)

### Quick Start

1. **Clone and Navigate**:
   ```bash
   cd /path/to/InErgize
   ```

2. **Run Setup Script**:
   ```bash
   ./scripts/kong-setup.sh development
   ```

3. **Verify Installation**:
   ```bash
   ./scripts/kong-manage.sh health
   ```

### Manual Setup

1. **Environment Configuration**:
   ```bash
   cp infrastructure/kong/.env.example infrastructure/kong/.env
   # Edit .env with your values
   ```

2. **Start Services**:
   ```bash
   docker-compose up -d redis postgres timescale
   docker-compose up -d kong
   ```

3. **Verify Setup**:
   ```bash
   curl http://localhost:8001/status
   ```

## Management Commands

### Kong Management Script

The `kong-manage.sh` script provides operational commands:

```bash
# Health check
./scripts/kong-manage.sh health

# Status overview
./scripts/kong-manage.sh status

# Detailed information
./scripts/kong-manage.sh detailed

# Test endpoints
./scripts/kong-manage.sh test

# View logs
./scripts/kong-manage.sh logs 100

# LinkedIn compliance check
./scripts/kong-manage.sh linkedin

# Restart Kong
./scripts/kong-manage.sh restart
```

### Manual Kong Commands

```bash
# Check Kong status
curl http://localhost:8001/status

# List services
curl http://localhost:8001/services

# List routes
curl http://localhost:8001/routes

# List consumers
curl http://localhost:8001/consumers

# Check upstream health
curl http://localhost:8001/upstreams/auth-service/health
```

## Troubleshooting

### Common Issues

#### Kong Won't Start

1. **Check Dependencies**:
   ```bash
   docker-compose up -d redis postgres timescale
   ```

2. **Validate Configuration**:
   ```bash
   python3 -c "import yaml; yaml.safe_load(open('infrastructure/kong/kong.yml'))"
   ```

3. **Check Logs**:
   ```bash
   docker logs inergize-kong
   ```

#### Service Health Issues

1. **Check Service Status**:
   ```bash
   curl http://localhost:8001/upstreams/{service}/health
   ```

2. **Test Service Directly**:
   ```bash
   curl http://localhost:{port}/health
   ```

3. **Check Service Logs**:
   ```bash
   docker logs inergize-{service}
   ```

#### Rate Limiting Issues

1. **Check Rate Limit Status**:
   ```bash
   curl -H "X-Consumer-ID: test" http://localhost:8000/api/v1/linkedin/profile
   ```

2. **Monitor Redis**:
   ```bash
   docker exec -it inergize-redis redis-cli monitor
   ```

#### LinkedIn Compliance Violations

1. **Check Compliance Status**:
   ```bash
   ./scripts/kong-manage.sh linkedin
   ```

2. **Review Rate Limits**:
   ```bash
   curl http://localhost:8001/services/linkedin-service/plugins
   ```

3. **Monitor Request Patterns**:
   ```bash
   tail -f /tmp/kong-access.log | grep linkedin
   ```

### Performance Tuning

#### Memory Usage

Kong's memory usage can be optimized:

```yaml
# In docker-compose.yml
kong:
  environment:
    KONG_MEM_CACHE_SIZE: 128m
    KONG_NGINX_WORKER_PROCESSES: 2
```

#### Connection Pooling

Optimize upstream connections:

```yaml
upstreams:
  - name: service-name
    algorithm: consistent-hashing
    healthchecks:
      threshold: 50  # 50% unhealthy threshold
```

## Security Best Practices

### Production Deployment

1. **Use Strong Secrets**:
   - Generate 32+ character JWT secrets
   - Rotate API keys regularly
   - Use environment variables for secrets

2. **Network Security**:
   - Deploy Kong behind a load balancer
   - Use internal networks for service communication
   - Implement IP whitelisting

3. **SSL/TLS Configuration**:
   - Use valid SSL certificates
   - Enable HSTS headers
   - Disable weak cipher suites

4. **Regular Updates**:
   - Keep Kong updated
   - Monitor security advisories
   - Update Docker images regularly

### LinkedIn Compliance

1. **Rate Limiting**:
   - Stay well below LinkedIn's API limits
   - Implement exponential backoff
   - Monitor 429 responses

2. **Request Patterns**:
   - Avoid bot-like request patterns
   - Implement random delays
   - Use human-like intervals

3. **Data Handling**:
   - Minimize data storage
   - Implement data retention policies
   - Respect user privacy

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Request Metrics**:
   - Request rate and latency
   - Error rates by service
   - Status code distributions

2. **Upstream Health**:
   - Service availability
   - Response times
   - Health check failures

3. **Security Metrics**:
   - Rate limiting violations
   - Authentication failures
   - Suspicious request patterns

4. **LinkedIn Compliance**:
   - API request counts
   - 429 response rates
   - Service health status

### Alerting Rules

Set up alerts for:

- Kong service down
- Upstream services unhealthy
- High error rates (>5%)
- Rate limit violations
- LinkedIn API 429 responses
- Security violations

## Backup & Recovery

### Configuration Backup

1. **Export Kong Configuration**:
   ```bash
   curl http://localhost:8001/config > kong-backup.json
   ```

2. **Backup Environment Files**:
   ```bash
   cp infrastructure/kong/.env infrastructure/kong/.env.backup
   ```

### Disaster Recovery

1. **Restore Configuration**:
   ```bash
   # Update declarative config and restart
   docker-compose restart kong
   ```

2. **Service Recovery**:
   ```bash
   # Start dependencies
   docker-compose up -d redis postgres timescale
   
   # Start Kong
   docker-compose up -d kong
   
   # Verify health
   ./scripts/kong-manage.sh health
   ```

## Development Workflow

### Local Development

1. **Start Development Environment**:
   ```bash
   ./scripts/kong-setup.sh development
   ```

2. **Make Configuration Changes**:
   - Edit `infrastructure/kong/kong.dev.yml`
   - Test changes locally

3. **Reload Configuration**:
   ```bash
   ./scripts/kong-manage.sh reload
   ```

### Testing

1. **Run Health Checks**:
   ```bash
   ./scripts/kong-manage.sh test
   ```

2. **Test Specific Endpoints**:
   ```bash
   curl -H "Authorization: Bearer $JWT_TOKEN" \
        http://localhost:8000/api/v1/users/profile
   ```

### Deployment

1. **Staging Deployment**:
   ```bash
   ./scripts/kong-setup.sh staging
   ```

2. **Production Deployment**:
   ```bash
   ./scripts/kong-setup.sh production
   ```

3. **Post-Deployment Verification**:
   ```bash
   ./scripts/kong-manage.sh health
   ./scripts/kong-manage.sh linkedin
   ```

## API Documentation

### Authentication

All protected endpoints require JWT authentication:

```http
Authorization: Bearer <jwt_token>
```

### Rate Limiting Headers

Kong returns rate limiting information:

```http
X-RateLimit-Limit-Hour: 1000
X-RateLimit-Remaining-Hour: 999
X-RateLimit-Reset: 1234567890
```

### Error Responses

Standard error format:

```json
{
  "message": "Rate limit exceeded",
  "error": "too_many_requests",
  "status": 429
}
```

## Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review Kong logs
   - Check service health
   - Monitor rate limiting metrics

2. **Monthly**:
   - Update Kong and plugins
   - Rotate API keys
   - Review security policies

3. **Quarterly**:
   - Security audit
   - Performance review
   - Configuration optimization

### Getting Help

1. **Internal Documentation**: This document and inline comments
2. **Kong Documentation**: https://docs.konghq.com/
3. **Community**: Kong GitHub issues and discussions
4. **Professional Support**: Kong Enterprise support (if applicable)

## Conclusion

This Kong API Gateway setup provides enterprise-grade API management with specific optimizations for LinkedIn SaaS compliance. The configuration emphasizes security, observability, and operational excellence while maintaining the flexibility needed for rapid development and deployment.

Key benefits:

- **LinkedIn Compliance**: Conservative rate limiting and monitoring
- **Security**: Multi-layer authentication and authorization
- **Observability**: Comprehensive logging and metrics
- **Performance**: Caching, load balancing, and health checks
- **Operational Excellence**: Automated setup and management scripts

For questions or issues, refer to the troubleshooting section or contact the development team.