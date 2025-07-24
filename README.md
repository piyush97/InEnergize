# InErgize - LinkedIn Optimization SaaS Platform

<p align="center">
  <img src="https://img.shields.io/badge/Status-Phase%201B%20Complete-brightgreen" alt="Status">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/Node.js-22+-green" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.8+-blue" alt="TypeScript">
</p>

> **InErgize** is a comprehensive LinkedIn optimization SaaS platform that empowers job seekers, career changers, and professionals to enhance their LinkedIn presence through AI-powered tools, analytics, and compliant automation features.

## 🎯 Project Overview

InErgize helps users optimize their LinkedIn profiles and content strategy through:

- **AI-Powered Profile Optimization**: Intelligent suggestions for headlines, summaries, and skills
- **Content Generation Suite**: AI-driven post creation, banner generation, and carousel builders
- **Advanced Analytics**: Real-time profile performance tracking and industry benchmarking
- **Safe Automation**: LinkedIn-compliant networking and engagement automation
- **Comprehensive Dashboard**: Centralized hub for all LinkedIn optimization activities

### Key Differentiators

- **LinkedIn Compliance First**: Strict adherence to LinkedIn's Terms of Service with built-in safety mechanisms
- **AI-Driven Intelligence**: GPT-4 and DALL-E integration for premium content creation
- **Real-Time Analytics**: TimescaleDB-powered analytics with live performance tracking
- **Enterprise-Ready**: Scalable microservices architecture designed for 10,000+ concurrent users

## 🏗️ System Architecture

InErgize follows a microservices architecture pattern with the following core services:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │  Mobile App     │    │  Admin Panel    │
│   (Next.js)     │    │ (React Native)  │    │   (Next.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │     (Kong)      │
                    └─────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Auth     │    │    User     │    │  LinkedIn   │    │     AI      │
│   Service   │    │  Management │    │ Integration │    │   Content   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     │                           │                           │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Analytics  │    │  Scheduler  │    │ Automation  │    │Notification │
│   Service   │    │   Service   │    │   Service   │    │   Service   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Technology Stack

**Backend Services**

- **Runtime**: Node.js 22+ with TypeScript 5.8+
- **Frameworks**: Express.js, NestJS
- **Databases**: PostgreSQL 14+, TimescaleDB, Redis 6+
- **Message Queue**: Redis Bull/AWS SQS
- **API Gateway**: Kong with rate limiting

**Frontend Applications**

- **Web App**: Next.js 14+ with TypeScript
- **Mobile**: React Native with Expo
- **State Management**: Zustand/Redux Toolkit
- **UI Framework**: Tailwind CSS with Headless UI

**AI & External Services**

- **Content Generation**: OpenAI GPT-4, Anthropic Claude
- **Image Generation**: DALL-E 3, Stability AI
- **LinkedIn Integration**: Official LinkedIn REST API
- **Email**: SendGrid, **Payments**: Stripe
- **File Storage**: AWS S3 with CloudFront CDN

**Infrastructure & Monitoring**

- **Containerization**: Docker with Kubernetes
- **Cloud Provider**: AWS/Azure with multi-region deployment
- **Monitoring**: Grafana, Prometheus, Alertmanager
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **CI/CD**: GitHub Actions with automated testing
- **Testing**: Jest 30, Playwright, React Testing Library
- **Performance**: k6 load testing, comprehensive API testing

## 📁 Project Structure

```
InErgize/
├── docs/                          # Project documentation
│   ├── system-architecture.md     # System architecture design
│   ├── component-diagrams.md      # Detailed component diagrams
│   ├── database-design.md         # Database schema and design
│   ├── development-roadmap.md     # 12-month development plan
│   ├── technical-specifications.md # API specs and requirements
│   ├── api.yml                    # OpenAPI 3.0 specification
│   └── generated/                 # Generated documentation and SDKs
├── services/                      # Microservices
│   ├── auth-service/              # Authentication & authorization
│   ├── user-service/              # User management & preferences
│   ├── linkedin-service/          # LinkedIn API integration
│   ├── ai-service/                # AI content generation
│   ├── analytics-service/         # Analytics & reporting
│   ├── scheduler-service/         # Content scheduling
│   ├── automation-service/        # LinkedIn automation
│   └── notification-service/      # Email & push notifications
├── web/                           # Next.js web application
├── mobile/                        # React Native mobile app
├── admin/                         # Admin dashboard
├── infrastructure/                # Infrastructure as Code
│   ├── kubernetes/                # K8s manifests
│   ├── terraform/                 # Infrastructure provisioning
│   ├── docker/                    # Docker configurations
│   └── monitoring/                # Monitoring and alerting configs
├── shared/                        # Shared libraries & types
├── tests/                         # Comprehensive test suite
│   ├── setup/                     # Test configuration and helpers
│   ├── e2e/                       # End-to-end tests with Playwright
│   ├── integration/               # Integration tests
│   ├── performance/               # k6 performance tests
│   └── api/                       # API testing with Newman/Dredd
├── scripts/                       # Development & deployment scripts
├── .github/workflows/             # CI/CD pipelines
├── database/                      # Database schemas and migrations
├── CLAUDE.md                      # Claude Code development guide
└── README.md                      # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 22.0.0 or higher
- **npm** 10.0.0 or higher
- **Docker** 20.0.0 or higher
- **PostgreSQL** 14.0 or higher
- **Redis** 6.0 or higher
- **LinkedIn Developer Account** (for OAuth integration)
- **OpenAI API Key** (for AI features)

### Quick Start (Development)

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/InErgize.git
   cd InErgize
   ```

2. **Environment Setup**

   ```bash
   # Copy environment templates
   cp .env.example .env.local
   
   # Configure your environment variables
   # See Environment Configuration section below
   ```

3. **Install Dependencies**

   ```bash
   # Root dependencies (when available)
   npm install
   ```

4. **Start Development Environment**

   ```bash
   # Start complete development environment with Docker
   docker-compose up -d

   # Check service health
   docker-compose ps
   
   # View logs
   docker-compose logs -f
   
   # For development with hot reload (optional)
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

5. **Access Services**

   Once all containers are running, you can access:

   - **Web Application**: http://localhost:3000
   - **Auth Service**: http://localhost:3001/health
   - **User Service**: http://localhost:3002/health
   - **API Gateway (Kong)**: http://localhost:8000
   - **Kong Admin**: http://localhost:8001
   - **Kibana (Logs)**: http://localhost:5601
   - **Elasticsearch**: http://localhost:9200
   - **PostgreSQL**: localhost:5432 (user: inergize_user, db: inergize_dev)
   - **TimescaleDB**: localhost:5433 (user: inergize_user, db: inergize_analytics)
   - **Redis**: localhost:6379 (password: inergize_redis_password)

6. **Stop Development Environment**

   ```bash
   # Stop all services
   docker-compose down

   # Stop and remove volumes (WARNING: This deletes all data)
   docker-compose down -v
   ```

### Development Workflow

#### Docker-Based Development (Current - All Infrastructure Operational)

```bash
# Infrastructure Management
docker-compose up -d                    # Start all services (production mode)
docker-compose down                     # Stop all services
docker-compose restart [service]       # Restart specific service
docker-compose logs -f [service]       # View service logs
docker-compose ps                       # Check service status

# Development Mode (with hot reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Individual Service Management
docker-compose up -d postgres redis elasticsearch    # Start only infrastructure services
docker-compose up -d web-app auth-service user-service  # Start only application services
docker-compose exec postgres psql -U inergize_user -d inergize_dev  # Connect to database
docker-compose exec redis redis-cli -a inergize_redis_password      # Connect to Redis

# Development Tools
docker-compose build --no-cache [service]  # Rebuild specific service
docker-compose exec web-app npm run build     # Build web application
docker-compose exec auth-service npm test     # Run tests in auth service

# Health Checks & Monitoring
curl http://localhost:3001/health             # Auth service health
curl http://localhost:3002/health             # User service health
curl http://localhost:3000/api/health         # Web application health
curl http://localhost:9200/_cluster/health    # Elasticsearch cluster health
```

#### Available NPM Commands (Phase 1B Implementation)

```bash
# Development Commands
npm run dev                    # Start all services in development
npm run build                  # Build all services for production
npm run test                   # Run complete test suite (Jest)
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Generate test coverage report
npm run test:integration       # Run integration tests
npm run test:e2e               # Run end-to-end tests (Playwright)
npm run lint                   # Run ESLint across all services
npm run type-check             # TypeScript type checking
npm run format                 # Format code with Prettier

# Database Commands
npm run db:migrate             # Run Prisma database migrations
npm run db:generate            # Generate Prisma client
npm run db:seed                # Seed database with sample data
npm run db:reset               # Reset database (development only)
npm run db:studio              # Open Prisma Studio

# Documentation Commands
npm run docs:serve             # Start API documentation server
npm run docs:build             # Build API documentation
npm run docs:validate          # Validate OpenAPI specification
npm run docs:test              # Run API tests with Newman
npm run docs:generate-sdks     # Generate client SDKs

# Development Tools
npm run dev:setup              # Run development environment setup
npm run dev:health-check       # Check all services health
npm run dev:logs               # View all service logs
npm run dev:clean              # Clean development environment

# Performance Testing
npm run perf:test              # Run k6 performance tests
npm run perf:load              # Run load testing scenarios
```

## ⚙️ Environment Configuration

### Core Environment Variables

```bash
# Application Configuration
NODE_ENV=development
PORT=3000
APP_NAME=InErgize
APP_VERSION=1.0.0

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/inergize_dev
REDIS_URL=redis://localhost:6379
TIMESCALE_URL=postgresql://user:password@localhost:5432/inergize_analytics

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# LinkedIn Integration
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback

# AI Services
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
AI_MODEL_PRIMARY=gpt-4-turbo
AI_MODEL_FALLBACK=gpt-3.5-turbo

# External Services
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
SENDGRID_API_KEY=your-sendgrid-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-s3-bucket-name

# Monitoring & Logging
DATADOG_API_KEY=your-datadog-api-key
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_AUTOMATION=true
ENABLE_ANALYTICS=true
ENABLE_PREMIUM_FEATURES=true
```

### Service-Specific Configuration

Each service has its own configuration file in `services/{service-name}/.env`. Refer to the individual service README files for detailed configuration options.

## 📊 Development Status

### ✅ Phase 1B Complete: Development Infrastructure & Testing

**Infrastructure & DevOps (Complete)**
- [x] System architecture design complete
- [x] Database schema design complete (Prisma with 11 models)
- [x] Component architecture design complete
- [x] Technical specifications complete
- [x] Development roadmap established
- [x] Complete infrastructure setup with Docker orchestration
- [x] Production-ready containerization for all services
- [x] Development environment configuration and automation
- [x] Comprehensive CI/CD pipeline with GitHub Actions
- [x] Database setup with PostgreSQL, TimescaleDB, and Redis
- [x] API Gateway configuration with Kong
- [x] Elasticsearch and Kibana logging infrastructure
- [x] Environment configuration templates and validation
- [x] Security configurations and health check endpoints
- [x] Service discovery and inter-service communication
- [x] Production deployment configurations

**Development Environment & Testing (Complete)**
- [x] Comprehensive testing infrastructure (Jest 30, Playwright, RTL)
- [x] End-to-end testing with Playwright (multi-browser)
- [x] Integration testing with database helpers
- [x] Performance testing with k6 load testing
- [x] API testing with Newman and Dredd
- [x] Development environment automation scripts
- [x] Monitoring and alerting infrastructure (Prometheus, Grafana)
- [x] CI/CD pipeline with security scanning
- [x] API documentation with OpenAPI 3.0 specification
- [x] Client SDK generation (TypeScript, Python, cURL)
- [x] Database migrations and schema validation

**Current Status: Phase 1B Complete ✅**
- 🟢 All 9 core infrastructure services running and healthy
- 🟢 Production-ready Docker Compose configuration  
- 🟢 Complete development environment automation
- 🟢 Comprehensive testing infrastructure operational
- 🟢 Monitoring, logging, and alerting systems active
- 🟢 API documentation and testing tools configured
- 🟢 Security scanning and compliance checks automated

**Next: Core Services Implementation (Phase 2)**
- [ ] Authentication service implementation (JWT, OAuth, MFA)
- [ ] User management service implementation
- [ ] Basic LinkedIn API integration
- [ ] Web application foundation (dashboard, auth flows)
- [ ] API endpoint implementations

### Development Roadmap & Milestones

**Phase 1B Complete ✅ (Current)**
- ✅ Complete infrastructure and testing setup
- ✅ Development environment automation
- ✅ CI/CD pipelines with security scanning
- ✅ API documentation and testing tools
- ✅ Database schemas and migrations
- ✅ Monitoring and alerting infrastructure

**Phase 2 Targets (Next 2 Months)**
- 🎯 Core authentication system implementation
- 🎯 Basic LinkedIn API integration
- 🎯 MVP dashboard development
- 🎯 User management service
- 🎯 Profile analysis foundation

**Phase 3 Goals (Months 3-4)**
- 🛣️ Advanced analytics pipeline
- 🛣️ AI content generation system
- 🛣️ Real-time dashboard features
- 🛣️ Enhanced user experience
- 🛣️ Mobile application development

See [docs/development-roadmap.md](docs/development-roadmap.md) for complete timeline and milestones.

## 📖 Documentation

### Architecture Documentation

- [System Architecture](docs/system-architecture.md) - High-level system design and infrastructure
- [Component Diagrams](docs/component-diagrams.md) - Detailed service components and interactions
- [Database Design](docs/database-design.md) - Database schema, relationships, and optimization
- [Technical Specifications](docs/technical-specifications.md) - API specifications and requirements

### Development Guides

- [CLAUDE.md](CLAUDE.md) - Claude Code development guidance and conventions
- [Development Roadmap](docs/development-roadmap.md) - 12-month development plan and phases
- [API Documentation](docs/api/) - Detailed API endpoint documentation
- [Deployment Guide](docs/deployment/) - Production deployment instructions

### Service Documentation

Each microservice has detailed documentation in its respective directory:

- [Auth Service](services/auth-service/README.md)
- [User Management](services/user-service/README.md)
- [LinkedIn Integration](services/linkedin-service/README.md)
- [AI Content Service](services/ai-service/README.md)
- [Analytics Service](services/analytics-service/README.md)

## 🧪 Testing

### Comprehensive Testing Infrastructure ✅ Operational

```bash
# Unit & Integration Testing (Jest 30)
npm run test                    # Run all unit tests
npm run test:watch              # Watch mode for development
npm run test:coverage           # Generate coverage reports (90%+ target)
npm run test:integration        # Database integration tests
npm run test:auth               # Authentication service tests
npm run test:user               # User service tests

# End-to-End Testing (Playwright)
npm run test:e2e                # Full E2E test suite
npm run test:e2e:auth           # Authentication flow tests
npm run test:e2e:dashboard      # Dashboard workflow tests
npm run test:e2e:mobile         # Mobile browser tests
npm run test:e2e:debug          # Debug mode with browser UI

# Performance Testing (k6)
npm run test:load               # Load testing with k6
npm run test:stress             # Stress testing scenarios
npm run test:spike              # Spike testing for traffic bursts
npm run test:volume             # Volume testing with large datasets

# API Testing
npm run test:api                # API endpoint testing with Newman
npm run test:contracts          # Contract testing with Dredd
npm run test:postman            # Run Postman collection tests

# Security Testing (Automated in CI/CD)
# - CodeQL static analysis
# - Dependency vulnerability scanning
# - Container image scanning
# - Infrastructure security scanning
# - Secrets detection

# Manual Testing Commands
docker-compose exec web-app npm test           # Run web app tests
docker-compose exec auth-service npm test      # Run auth service tests
docker-compose logs auth-service               # Check service logs
curl http://localhost:3000/api/health          # Test web app health
curl http://localhost:3001/health              # Test auth service health
```

### Testing Coverage & Quality Metrics

```bash
# Test Coverage Requirements
# ✅ Unit Tests: 90%+ coverage target
# ✅ Integration Tests: Database and API endpoints
# ✅ E2E Tests: Critical user workflows
# ✅ Performance Tests: Load, stress, and spike testing
# ✅ Security Tests: Vulnerability and compliance scanning

# Quality Gates
# ✅ All tests must pass before deployment
# ✅ Coverage thresholds enforced in CI/CD
# ✅ Performance budgets validated
# ✅ Security scans with zero critical issues
# ✅ Code quality checks with ESLint and Prettier

# Test Execution Matrix
# ✅ Multi-browser testing (Chrome, Firefox, Safari, Edge)
# ✅ Mobile device emulation
# ✅ Multiple Node.js versions (20, 22)
# ✅ Database compatibility testing
# ✅ API contract validation

# Continuous Testing
# ✅ Automated testing on every push
# ✅ Scheduled security scans
# ✅ Performance regression detection
# ✅ Dependency vulnerability monitoring
```

## 🚀 Deployment

### Comprehensive CI/CD Infrastructure ✅ Operational

#### GitHub Actions Pipelines (Implemented)

The project includes production-ready CI/CD pipelines:

**Main CI/CD Pipeline (.github/workflows/ci.yml)**
- **Multi-Service Builds**: Docker images for all 3 services (auth, user, web)
- **Comprehensive Testing**: Unit, integration, E2E, and performance tests
- **Quality Gates**: ESLint, TypeScript checking, test coverage validation
- **Security Scanning**: CodeQL, dependency scanning, container scanning
- **Performance Testing**: k6 load testing with configurable scenarios
- **Multi-Environment Deployment**: Automated deployment to dev/staging/prod
- **Kubernetes Integration**: Automated K8s manifest deployment

**Security Pipeline (.github/workflows/security.yml)**  
- **Dependency Scanning**: npm audit with SARIF reporting
- **Static Code Analysis**: CodeQL security analysis
- **Container Security**: Trivy and Grype vulnerability scanning
- **Infrastructure Scanning**: Checkov for IaC security
- **Secrets Detection**: TruffleHog and GitLeaks scanning
- **License Compliance**: Automated license checking
- **SBOM Generation**: Software Bill of Materials

**Release Pipeline (.github/workflows/release.yml)**
- **Automated Versioning**: Semantic versioning with changelog
- **Multi-Platform Builds**: Docker images for AMD64 and ARM64
- **Security Validation**: Pre-release security scans
- **Deployment Automation**: Blue-green deployment strategy

#### Manual Deployment Options

```bash
# Local Development Deployment
docker-compose up -d                    # Start all services
docker-compose build --no-cache         # Rebuild all images
docker-compose -f docker-compose.prod.yml up -d  # Production mode

# Build and Push Images
docker-compose build                     # Build all images
docker-compose push                      # Push to registry

# Individual Service Deployment
docker-compose up -d postgres redis     # Infrastructure only
docker-compose up -d auth-service       # Single service
docker-compose restart web-app          # Restart specific service

# Environment-Specific Deployment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d    # Development
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d # Staging
docker-compose -f docker-compose.prod.yml up -d                          # Production
```

### Production Deployment Architecture

#### Infrastructure Requirements

- **Kubernetes Cluster**: v1.25+ with ingress controller
- **Domain & SSL**: Wildcard certificate for *.inergize.com
- **Databases**: Managed PostgreSQL 14+ and Redis 6+ clusters
- **External Services**: LinkedIn Developer, OpenAI, Stripe accounts
- **Monitoring**: Prometheus, Grafana, Alertmanager cluster
- **Storage**: S3-compatible object storage for file uploads

#### Automated Deployment Commands

```bash
# CI/CD Triggered Deployments (Automated)
# - Push to main branch triggers production deployment
# - Pull requests trigger staging deployment
# - Release tags trigger versioned deployment

# Manual Production Deployment
npm run deploy:production            # Deploy to production K8s
npm run deploy:staging               # Deploy to staging environment
npm run deploy:rollback              # Rollback to previous version

# Deployment Verification
npm run health-check:production      # Comprehensive health checks
npm run smoke-test:production        # Production smoke tests
npm run perf-test:production         # Production performance validation

# Monitoring and Observability
npm run logs:production              # View production logs
npm run metrics:production           # View production metrics
npm run alerts:production            # Check active alerts
```

### Infrastructure as Code ✅ Ready for Deployment

```bash
# Terraform Infrastructure Provisioning
cd infrastructure/terraform
terraform init                       # Initialize Terraform
terraform plan                       # Plan infrastructure changes
terraform apply                      # Apply infrastructure changes
terraform destroy                    # Destroy infrastructure (cleanup)

# Kubernetes Deployment
kubectl apply -f infrastructure/kubernetes/         # Deploy all manifests
kubectl apply -f infrastructure/kubernetes/secrets/ # Deploy secrets
kubectl apply -f infrastructure/kubernetes/configs/ # Deploy config maps

# Monitoring Infrastructure
kubectl apply -f infrastructure/monitoring/         # Deploy monitoring stack
helm install prometheus prometheus-community/kube-prometheus-stack
helm install grafana grafana/grafana

# Automated Infrastructure Management
./scripts/provision-infrastructure.sh              # Full infrastructure setup
./scripts/deploy-monitoring.sh                     # Deploy monitoring stack
./scripts/configure-alerts.sh                      # Configure alerting rules
```

### Monitoring & Health Checks

#### Current Health Checks ✅ All Services Operational

```bash
# Application Services (All Healthy)
curl http://localhost:3000/api/health          # Web application ✅
curl http://localhost:3001/health              # Auth service ✅
curl http://localhost:3002/health              # User service ✅

# Infrastructure Services (All Healthy)
curl http://localhost:8001/                    # Kong admin API ✅
curl http://localhost:9200/_cluster/health     # Elasticsearch ✅
docker exec inergize-postgres pg_isready -U inergize_user -d inergize_dev  # PostgreSQL ✅
docker exec inergize-redis redis-cli -a inergize_redis_password ping       # Redis ✅
docker exec inergize-timescale pg_isready -U inergize_user                # TimescaleDB ✅

# Comprehensive Health Check
bash scripts/health-check.sh                   # Run full health check script
```

#### Service Status Monitoring

```bash
# Check all services status (Should show all as Up/Healthy)
docker-compose ps

# Check specific service logs
docker-compose logs -f web-app
docker-compose logs -f auth-service
docker-compose logs -f postgres
docker-compose logs -f elasticsearch

# Monitor resource usage
docker stats

# Check service dependencies
docker-compose config --services              # List all services
docker network ls | grep inergize            # Check network configuration
```

### Troubleshooting

#### Common Issues

**Services not starting:**
```bash
# Check service dependencies
docker-compose up -d postgres redis
docker-compose logs postgres redis

# Rebuild services if needed
docker-compose build --no-cache
docker-compose up -d
```

**Kong API Gateway issues:**
```bash
# Check Kong configuration syntax
docker-compose logs kong

# If Kong reports "consumer_groups unknown field" error:
# This indicates the Kong version doesn't support consumer_groups
# The configuration has been fixed to be compatible with Kong 3.9

# If Kong reports duplicate plugins error:
# Multiple response-transformer plugins were combined into one
# Configuration is now properly structured
```

**Port conflicts:**
```bash
# Check what's using the ports
lsof -i :3000  # Web app
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Stop conflicting services or change ports in docker-compose.yml
```

**Database connection issues:**
```bash
# Connect to database manually
docker-compose exec postgres psql -U inergize_user -d inergize_dev

# Check database logs
docker-compose logs postgres
```

**Health check failures:**
```bash
# Check if services are responding
curl -v http://localhost:3000/api/health
docker-compose exec web-app wget --spider http://localhost:3000/

# Check service logs for errors
docker-compose logs -f web-app
```

## 🔒 Security & Compliance

### Security Features

- **Authentication**: JWT with refresh tokens, MFA support
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: AES-256 encryption at rest, TLS 1.3 in transit
- **API Security**: Rate limiting, CORS, CSRF protection
- **Input Validation**: Comprehensive request validation and sanitization

### Compliance Standards

- **GDPR Compliance**: Data minimization, consent management, right to erasure
- **CCPA Compliance**: Data transparency, opt-out mechanisms
- **SOC 2 Type II**: Security, availability, processing integrity
- **LinkedIn TOS**: Strict compliance with LinkedIn Developer Agreement

### LinkedIn Compliance Features

- **Conservative Rate Limiting**: 50% of LinkedIn's published limits
- **Human Behavior Simulation**: Natural delays, varied interaction patterns
- **Account Health Monitoring**: Real-time compliance tracking
- **Automatic Safety Stops**: Immediate automation pause on violations
- **User Education**: Clear guidance on LinkedIn policy compliance

## 🤝 Contributing

### Development Guidelines

1. **Fork and Clone**

   ```bash
   git clone https://github.com/yourusername/InErgize.git
   cd InErgize
   git checkout -b feature/your-feature-name
   ```

2. **Development Environment Setup**

   ```bash
   # Automated setup (recommended)
   ./scripts/dev-setup.sh
   
   # Manual setup
   npm ci                          # Install dependencies
   docker-compose up -d            # Start infrastructure
   npm run db:migrate              # Run database migrations
   npm run dev                     # Start development servers
   ```

3. **Development Workflow**

   ```bash
   # Make your changes and validate
   npm run test                    # Run all tests
   npm run test:watch              # Watch mode during development
   npm run lint                    # Code linting
   npm run type-check              # TypeScript validation
   npm run format                  # Code formatting
   
   # Advanced testing
   npm run test:e2e                # End-to-end tests
   npm run test:integration        # Integration tests
   npm run test:api                # API contract tests
   ```

3. **Commit Standards**

   ```bash
   # Use conventional commits
   git commit -m "feat(auth): add multi-factor authentication"
   git commit -m "fix(linkedin): resolve rate limiting issue"
   git commit -m "docs(api): update authentication endpoints"
   ```

4. **Testing Requirements**

   - Unit tests for all new functionality (90%+ coverage)
   - Integration tests for API endpoints
   - E2E tests for critical user flows
   - Security tests for sensitive operations

5. **Code Review Process**
   - All changes require pull request review
   - Automated CI/CD checks must pass
   - Security review for authentication/authorization changes
   - Performance review for database schema changes

### Code Style Guidelines

- **TypeScript**: Strict mode enabled, no `any` types
- **Formatting**: Prettier with 2-space indentation
- **Linting**: ESLint with Airbnb configuration
- **Documentation**: JSDoc for all public APIs
- **Testing**: Jest with comprehensive test coverage

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support & Contact

### Getting Help

- **Documentation**: Check the [docs/](docs/) directory for detailed guides
- **Issues**: Report bugs and feature requests via [GitHub Issues](https://github.com/yourusername/InErgize/issues)
- **Discussions**: Join community discussions in [GitHub Discussions](https://github.com/yourusername/InErgize/discussions)

### Development Support

- **Claude Code Integration**: See [CLAUDE.md](CLAUDE.md) for development guidance
- **Architecture Questions**: Refer to [docs/system-architecture.md](docs/system-architecture.md)
- **API Documentation**: Interactive docs at http://localhost:8080/api-docs
- **OpenAPI Specification**: [docs/api.yml](docs/api.yml) with full endpoint coverage
- **Testing Guide**: [tests/README.md](tests/README.md) for testing strategies
- **Performance Testing**: [tests/performance/](tests/performance/) for load testing
- **Monitoring Dashboards**: Grafana at http://localhost:3001 (when running)
- **Database Management**: Prisma Studio via `npm run db:studio`

### Contact Information

- **Project Maintainer**: [Your Name](mailto:your.email@example.com)
- **LinkedIn**: [LinkedIn Profile](https://linkedin.com/in/yourprofile)
- **Website**: [InErgize Platform](https://www.inergize.com)

---

<p align="center">
  <strong>Built with ❤️ for the LinkedIn professional community</strong>
</p>

<p align="center">
  <a href="#inergize---linkedin-optimization-saas-platform">↑ Back to Top</a>
</p>
