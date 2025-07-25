# LinkedIn Integration Service

The LinkedIn Integration Service handles all LinkedIn API interactions, including OAuth authentication, profile data synchronization, content creation, and networking automation while maintaining strict compliance with LinkedIn's Terms of Service.

## 🎯 Features

### Core Functionality
- **OAuth 2.0 Authentication**: Secure LinkedIn account connection with state validation
- **Profile Management**: Comprehensive profile data synchronization and analysis
- **Profile Completeness Scoring**: 0-100 scale algorithm with weighted categories
- **Content Creation**: LinkedIn post creation with media support
- **Networking Automation**: Safe connection request sending with personalized messages
- **Analytics Integration**: Profile performance metrics and insights

### Compliance & Safety
- **Conservative Rate Limiting**: 50% of LinkedIn's published API limits
- **Account Health Monitoring**: Real-time compliance tracking
- **Automatic Safety Stops**: Immediate pause on policy violations
- **Human Behavior Simulation**: Natural delays and interaction patterns
- **Audit Logging**: Complete activity trails for transparency

## 🏗️ Architecture

### Service Structure
```
linkedin-service/
├── src/
│   ├── controllers/         # HTTP request handlers
│   │   └── linkedin.controller.ts
│   ├── services/           # Business logic services
│   │   ├── oauth.service.ts
│   │   ├── api.service.ts
│   │   ├── completeness.service.ts
│   │   └── rateLimit.service.ts
│   ├── middleware/         # Express middleware
│   │   └── auth.middleware.ts
│   ├── routes/            # Route definitions
│   │   └── linkedin.routes.ts
│   ├── types/             # TypeScript interfaces
│   │   └── linkedin.ts
│   └── index.ts           # Application entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Key Components

#### LinkedInOAuthService
- Secure OAuth 2.0 flow implementation
- State parameter validation with cleanup
- Token refresh and revocation
- Configuration management

#### LinkedInAPIService  
- Comprehensive LinkedIn API integration
- Rate limiting with request tracking
- Error handling and retry logic
- Profile data aggregation

#### ProfileCompletenessService
- 0-100 scale scoring algorithm
- Weighted category analysis (8 sections)
- Industry-specific benchmarks
- Improvement priority recommendations

#### LinkedInRateLimitService
- Conservative rate limiting (50% of LinkedIn limits)
- Redis-based usage tracking
- Burst protection and backoff
- Analytics and monitoring

## 🚀 Getting Started

### Prerequisites
- Node.js 22.0.0 or higher
- Redis 6.0 or higher (for rate limiting and caching)
- LinkedIn Developer Account with OAuth app configured
- Valid JWT secret for authentication

### Installation

1. **Install Dependencies**
   ```bash
   cd services/linkedin-service
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Configure your LinkedIn API credentials and other settings
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   npm start
   ```

### Environment Variables

See [.env.example](.env.example) for complete configuration options.

Key required variables:
```bash
# LinkedIn API Credentials
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback

# Authentication
JWT_SECRET=your-super-secret-jwt-key

# Redis Configuration  
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## 📡 API Endpoints

### Authentication Endpoints
```http
POST /api/linkedin/auth/initiate       # Initiate LinkedIn OAuth flow
POST /api/linkedin/auth/callback       # Handle OAuth callback
DELETE /api/linkedin/auth/disconnect   # Disconnect LinkedIn account
```

### Profile Management
```http
GET /api/linkedin/profile              # Get current profile data
POST /api/linkedin/profile/sync        # Sync profile from LinkedIn
GET /api/linkedin/profile/completeness # Get completeness analysis
```

### Content & Networking
```http
POST /api/linkedin/posts               # Create LinkedIn post
POST /api/linkedin/connections/request # Send connection request
```

### Analytics & Monitoring
```http
GET /api/linkedin/analytics            # Get profile analytics
GET /api/linkedin/rate-limits          # Check rate limit status
GET /health                           # Service health check
```

## 🔐 Authentication

All endpoints (except health check and OAuth callback) require JWT authentication:

```javascript
headers: {
  'Authorization': 'Bearer <your-jwt-token>'
}
```

Some endpoints also require a LinkedIn access token:
```javascript
headers: {
  'LinkedIn-Access-Token': '<linkedin-access-token>'
}
```

## 📊 Rate Limiting

The service implements conservative rate limiting to ensure LinkedIn API compliance:

### Endpoint Limits (50% of LinkedIn's published limits)
- **Profile endpoints**: 50 requests/hour, 500 requests/day
- **Content creation**: 25 requests/hour, 100 requests/day  
- **Search endpoints**: 15 requests/hour, 50 requests/day
- **Connections**: 20 requests/hour, 100 requests/day

### Global Limits
- **Per service**: 200 requests/hour, 1000 requests/day
- **Burst protection**: Configurable per endpoint
- **Automatic backoff**: Exponential retry with jitter

## 🧪 Testing

### Unit Tests
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Integration Testing
```bash
# Start Redis for testing  
docker run -d -p 6379:6379 redis:6-alpine

# Run integration tests
npm run test:integration
```

### Manual API Testing
```bash
# Check service health
curl http://localhost:3003/health

# Test OAuth initiation (requires JWT)
curl -X POST http://localhost:3003/api/linkedin/auth/initiate \
  -H "Authorization: Bearer <jwt-token>"

# Check rate limit status
curl http://localhost:3003/api/linkedin/rate-limits \
  -H "Authorization: Bearer <jwt-token>"
```

## 📈 Monitoring & Observability

### Health Checks
- **Service health**: `GET /health`
- **Dependency checks**: Redis connectivity
- **Rate limit monitoring**: Usage statistics
- **LinkedIn API status**: Connection validation

### Prometheus Metrics
- HTTP request duration and count
- Rate limit usage by endpoint
- LinkedIn API response times
- Error rates and types

### Logging
- Structured JSON logging with Winston
- Request/response logging
- Error tracking with stack traces
- Rate limit events and violations

## 🛡️ Security & Compliance

### LinkedIn Terms of Service Compliance
- **Conservative Rate Limiting**: 50% of published limits
- **Human Behavior Simulation**: Random delays (30-120 seconds)
- **Account Safety Monitoring**: Real-time health checks
- **Data Minimization**: Store only necessary profile data
- **User Consent**: Explicit permission for all automated actions

### Security Features
- **JWT Authentication**: Secure token validation
- **Request Validation**: Input sanitization and validation
- **Rate Limiting**: DDoS protection and API compliance
- **CORS Configuration**: Controlled cross-origin access
- **Security Headers**: Helmet.js security middleware

### Data Protection
- **Access Token Encryption**: Secure token storage
- **State Parameter Validation**: CSRF protection for OAuth
- **Audit Logging**: Complete activity trails
- **Data Retention**: Configurable retention policies

## 🔧 Development

### Code Quality
```bash
npm run lint            # ESLint checking
npm run lint:fix        # Fix linting issues
npm run type-check      # TypeScript validation
```

### Database Operations
The LinkedIn service primarily uses Redis for caching and rate limiting. Profile data is stored via the User Service.

### Service Communication
- **Auth Service**: Token validation
- **User Service**: Profile data storage
- **Web App**: OAuth callback handling

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t inergize/linkedin-service .

# Run container
docker run -d \
  --name linkedin-service \
  -p 3003:3003 \
  --env-file .env \
  inergize/linkedin-service
```

### Production Considerations
- **Redis Clustering**: For high availability
- **Load Balancing**: Multiple service instances
- **SSL/TLS**: HTTPS for all communications
- **Monitoring**: Prometheus + Grafana setup
- **Backup**: Rate limit data and analytics

## 📖 LinkedIn API Integration

### Supported LinkedIn APIs
- **Profile API**: Basic and detailed profile information
- **People Search API**: Limited search functionality (with conservative limits)
- **Posts API**: Content creation and sharing
- **Connections API**: Network management

### API Response Handling
- **Consistent Format**: Standardized success/error responses
- **Error Mapping**: LinkedIn errors to service error codes
- **Retry Logic**: Automatic retry with exponential backoff
- **Caching**: Intelligent caching of profile data

### Compliance Monitoring
- **Request Tracking**: All API calls logged with metadata
- **Violation Detection**: Automatic detection of unusual patterns
- **Safety Stops**: Immediate automation pause on violations
- **Recovery Procedures**: Guided recovery from rate limit violations

## 🤝 Contributing

1. Follow the established code style and conventions
2. Add tests for new functionality  
3. Update documentation for API changes
4. Ensure LinkedIn compliance for all new features
5. Test with multiple LinkedIn accounts and scenarios

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

For more information about the InErgize platform, see the [main README](../../README.md).