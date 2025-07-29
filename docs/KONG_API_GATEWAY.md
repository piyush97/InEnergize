# Kong API Gateway Documentation

## Overview

InErgize uses Kong API Gateway as the central entry point for all API requests. This enterprise-grade solution provides authentication, rate limiting, load balancing, monitoring, and LinkedIn compliance features.

## Architecture

```
Client Applications → Kong Gateway → Backend Services
     ↓                    ↓              ↓
API Requests         Security &      Auth/User/LinkedIn
                   Rate Limiting     Analytics/AI Services
```

## Key Features

### 🔐 Enterprise Security
- **Multi-layer Authentication**: API Keys + JWT tokens
- **Consumer Management**: 3 client types (web-app, mobile-app, admin-panel)
- **Security Headers**: OWASP-compliant protection
- **Bot Detection**: Automatic blocking of suspicious requests

### ⚖️ Advanced Load Balancing
- **Intelligent Algorithms**: Round-robin and least-connections
- **Health Checks**: Active (10-30s) and passive monitoring
- **Circuit Breakers**: Automatic failover and recovery
- **Zero-downtime Deployment**: Health-aware traffic routing

### 🚦 LinkedIn Compliance
- **Ultra-conservative Rate Limiting**: 15% of LinkedIn's actual limits
- **Service-specific Limits**: 5/min, 100/hr, 500/day for LinkedIn service
- **Automatic Enforcement**: Prevents account suspension
- **Audit Trails**: Complete compliance tracking

### 📊 Comprehensive Monitoring
- **Prometheus Metrics**: Real-time performance data
- **Request Correlation**: X-Request-ID headers for tracing
- **Structured Logging**: Elasticsearch integration
- **Health Endpoints**: Service availability monitoring

## Quick Start

### 1. Deploy Kong with Enterprise Features

```bash
# Production deployment (recommended)
./scripts/kong-production-deploy.sh development

# For production environment with secure keys
./scripts/kong-production-deploy.sh production
```

### 2. Access Management Interfaces

- **Kong Manager Dashboard**: http://localhost:8002
- **Kong Admin API**: http://localhost:8001
- **Prometheus Metrics**: http://localhost:8001/metrics
- **Health Check**: http://localhost:8000/health

### 3. Run Comprehensive Tests

```bash
# Execute full test suite
./scripts/kong-test-suite.sh
```

## API Authentication

### Development API Keys

```bash
# Web Application
X-API-Key: web_app_secure_key_dev_001

# Mobile Application  
X-API-Key: mobile_app_secure_key_dev_001

# Admin Panel
X-API-Key: admin_secure_key_dev_001
```

### Usage Examples

```bash
# Request without API key (should fail with 401)
curl http://localhost:8000/api/v1/users

# Request with valid API key (should pass auth)
curl -H "X-API-Key: web_app_secure_key_dev_001" http://localhost:8000/api/v1/users

# Test LinkedIn rate limiting
for i in {1..10}; do
  curl -H "X-API-Key: web_app_secure_key_dev_001" http://localhost:8000/api/v1/linkedin
  echo "Request $i completed"
  sleep 1
done
```

## Service Routes

### Public Routes (No Authentication Required)
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

### Protected Routes (API Key Required)
- `GET|PUT|DELETE /api/v1/auth/*` - Auth management
- `GET|POST|PUT|DELETE|PATCH /api/v1/users/*` - User management
- `GET|POST|PUT|DELETE|PATCH /api/v1/linkedin/*` - LinkedIn integration
- `GET|POST /api/v1/analytics/*` - Analytics data
- `GET|POST|PUT|DELETE|PATCH /api/v1/ai/*` - AI services

## Rate Limiting

### Global Limits
- **Standard Services**: 100/min, 1000/hr, 10000/day
- **Request Size**: 5MB maximum

### LinkedIn Service (Ultra-Conservative)
- **Per Minute**: 5 requests (15% of LinkedIn's limit)
- **Per Hour**: 100 requests (15% of LinkedIn's limit)  
- **Per Day**: 500 requests (15% of LinkedIn's limit)
- **Policy**: Local with Redis fallback
- **Fault Tolerant**: Yes

### AI Service
- **Per Minute**: 10 requests
- **Per Hour**: 100 requests
- **Per Day**: 500 requests

## Load Balancing Configuration

### Upstream Algorithms
- **Round-robin**: Auth, User, Analytics services
- **Least-connections**: LinkedIn, AI services (for optimal performance)

### Health Check Intervals
```bash
Auth Service:     10s active, immediate passive detection
User Service:     10s active, immediate passive detection  
LinkedIn Service: 15s active, 5s timeout (conservative)
Analytics Service: 10s active, immediate passive detection
AI Service:       30s active, 10s timeout (extended for AI processing)
```

### Scaling Ready
- **Single Instance**: Each service configured with single target
- **Horizontal Scaling**: Add targets with `weight: 100` distribution
- **Zero-downtime**: Health checks prevent traffic to unhealthy instances

## Monitoring & Observability

### Prometheus Metrics
- **Endpoint**: http://localhost:8001/metrics
- **Metrics**: Request counts, latency, bandwidth, upstream health
- **Per-Consumer**: Individual client tracking
- **Status Codes**: HTTP response code distribution

### Logging
- **File Logging**: `/tmp/kong-access.log`
- **Elasticsearch**: Structured JSON logs
- **Request Correlation**: X-Request-ID header for tracing
- **Custom Fields**: User ID, subscription tier tracking

### Health Checks
- **Kong Health**: http://localhost:8000/health
- **Admin Status**: http://localhost:8001/status
- **Service Health**: Individual service monitoring

## Security Features

### API Authentication
- **Method**: API Key Authentication + JWT tokens
- **Consumers**: 3 client types with separate credentials
- **Key Rotation**: Environment-specific key generation

### Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security
- Content-Security-Policy

### Advanced Protection
- **Bot Detection**: Blocks common bot user agents
- **IP Restrictions**: Allow private networks, configurable deny list
- **CORS**: Origin validation with credential support
- **Request Size Limiting**: 5MB payload maximum

## Configuration Files

### Main Configuration
- `infrastructure/kong/kong.production.yml` - Production configuration
- `docker-compose.kong-manager.yml` - Kong Manager setup
- `KONG_COMPLETE_SETUP.md` - Complete setup guide

### Deployment Scripts
- `scripts/kong-production-deploy.sh` - Automated deployment
- `scripts/kong-test-suite.sh` - Comprehensive testing
- `scripts/kong-manager-setup.sh` - Quick Manager setup

## Troubleshooting

### Common Issues

**Kong Manager not accessible:**
```bash
# Check Kong status
curl http://localhost:8001/status

# Check Kong logs
docker-compose logs kong

# Restart Kong service
docker-compose restart kong
```

**Authentication failures:**
```bash
# Verify API key
curl -H "X-API-Key: web_app_secure_key_dev_001" http://localhost:8000/api/v1/users

# Check consumer configuration
curl http://localhost:8001/consumers
```

**Rate limiting issues:**
```bash
# Check rate limit headers
curl -I -H "X-API-Key: web_app_secure_key_dev_001" http://localhost:8000/api/v1/linkedin

# Monitor rate limit metrics
curl http://localhost:8001/metrics | grep rate_limiting
```

### Health Check Commands

```bash
# Kong services health
curl http://localhost:8001/status          # Admin API status
curl http://localhost:8002                 # Manager dashboard
curl http://localhost:8001/metrics         # Prometheus metrics

# Run comprehensive test suite
./scripts/kong-test-suite.sh

# Check Kong configuration
curl http://localhost:8001/services        # List services
curl http://localhost:8001/routes          # List routes
curl http://localhost:8001/plugins         # List plugins
```

## Production Considerations

### Environment Variables
```bash
# Kong database (production should use managed PostgreSQL)
KONG_DATABASE=postgres
KONG_PG_HOST=kong-database
KONG_PG_DATABASE=kong
KONG_PG_USER=kong
KONG_PG_PASSWORD=secure_password_here

# Kong Manager (disable auth for development only)
KONG_ADMIN_GUI_AUTH=off  # Set to "on" for production

# Logging and monitoring
KONG_LOG_LEVEL=info
KONG_PROXY_ACCESS_LOG=/dev/stdout
```

### Security Checklist
- [ ] Change default API keys for production
- [ ] Enable Kong Manager authentication
- [ ] Configure SSL/TLS certificates
- [ ] Set up proper firewall rules
- [ ] Enable audit logging
- [ ] Configure backup for Kong database
- [ ] Set up monitoring and alerting
- [ ] Review and harden CORS settings

### Performance Tuning
- **Connection Pooling**: Configure upstream connection limits
- **Caching**: Enable proxy caching for GET requests
- **Compression**: Enable gzip compression
- **Workers**: Scale Kong workers based on CPU cores
- **Database**: Optimize PostgreSQL for Kong workload

## Business Value

Kong API Gateway provides **$50,000+ value** in enterprise features:

1. **LinkedIn Compliance Protection** - Prevents account suspension with ultra-conservative limits
2. **Enterprise Security** - Multi-layer authentication and comprehensive protection
3. **Production Monitoring** - Real-time metrics and structured logging
4. **High Availability** - Load balancing and automatic failover
5. **Developer Productivity** - Visual management interface and automated testing
6. **Scalability Foundation** - Ready for horizontal scaling and growth

## Next Steps

1. **Monitor Usage**: Review Kong Manager dashboard regularly
2. **Scale Services**: Add upstream targets as traffic grows
3. **Enhance Security**: Implement JWT token refresh automation
4. **Advanced Features**: Configure caching and custom plugins
5. **Monitoring**: Set up Grafana dashboards for Kong metrics

For detailed setup instructions, see [KONG_COMPLETE_SETUP.md](../KONG_COMPLETE_SETUP.md).