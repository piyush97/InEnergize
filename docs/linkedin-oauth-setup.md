# LinkedIn OAuth Setup Guide for InErgize

## Required LinkedIn OAuth Scopes (Compliant Configuration)

### Current Scope Issues
Your current OAuth service has some deprecated scopes that need updating:

```typescript
// DEPRECATED - Current configuration in oauth.service.ts
scope: [
  'r_liteprofile',        // ❌ DEPRECATED
  'r_emailaddress',       // ❌ DEPRECATED  
  'r_basicprofile',       // ❌ DEPRECATED
  'rw_company_admin',     // ⚠️  REQUIRES COMPANY APPROVAL
  'w_member_social'       // ⚠️  REQUIRES LINKEDIN APPROVAL
]
```

### ✅ RECOMMENDED COMPLIANT SCOPES

```typescript
// Updated compliant configuration
scope: [
  'r_liteprofile',        // ✅ Basic profile info
  'r_emailaddress',       // ✅ Email address  
  'w_member_social'       // ⚠️  Post content (requires approval)
]
```

### 🔐 MINIMUM VIABLE SCOPES (Start Here)

```typescript
// Phase 1: Basic profile access only
scope: [
  'r_liteprofile',        // Basic profile info
  'r_emailaddress'        // Email address
]
```

## Environment Variables Configuration

### Development (.env.local)
```bash
# LinkedIn OAuth Configuration
LINKEDIN_CLIENT_ID="your_development_client_id"
LINKEDIN_CLIENT_SECRET="your_development_client_secret"
LINKEDIN_REDIRECT_URI="http://localhost:3000/auth/linkedin/callback"
LINKEDIN_SCOPE="r_liteprofile r_emailaddress"

# LinkedIn API Settings
LINKEDIN_API_VERSION="v2"
LINKEDIN_API_BASE_URL="https://api.linkedin.com/v2"

# Rate Limiting (Conservative for Compliance)
LINKEDIN_REQUESTS_PER_MINUTE=5
LINKEDIN_REQUESTS_PER_HOUR=100
LINKEDIN_REQUESTS_PER_DAY=1000
LINKEDIN_BURST_LIMIT=10

# Compliance & Safety
LINKEDIN_ENABLE_RATE_LIMITING=true
LINKEDIN_ENABLE_REQUEST_LOGGING=true
LINKEDIN_ENABLE_COMPLIANCE_MONITORING=true
LINKEDIN_SAFE_MODE=true
```

### Production (.env.production)
```bash
# LinkedIn OAuth Configuration
LINKEDIN_CLIENT_ID="your_production_client_id"
LINKEDIN_CLIENT_SECRET="your_production_client_secret" 
LINKEDIN_REDIRECT_URI="https://app.inergize.com/auth/linkedin/callback"
LINKEDIN_SCOPE="r_liteprofile r_emailaddress"

# Enhanced Security for Production
LINKEDIN_ENABLE_STATE_VALIDATION=true
LINKEDIN_STATE_TTL=600
LINKEDIN_ENABLE_PKCE=true

# Strict Rate Limiting for Production
LINKEDIN_REQUESTS_PER_MINUTE=3
LINKEDIN_REQUESTS_PER_HOUR=50
LINKEDIN_REQUESTS_PER_DAY=500
LINKEDIN_ENABLE_CIRCUIT_BREAKER=true
```

## LinkedIn API Compliance Requirements

### Rate Limiting Strategy
```yaml
Conservative Approach:
  - Stay at 50% of LinkedIn's published limits
  - Implement exponential backoff
  - Monitor 429 responses closely
  - Use circuit breaker pattern

Specific Limits:
  Basic API Calls:
    - 500 requests per member per day
    - Implementation: 250 requests per day (50% buffer)
  
  Profile API:
    - 100 requests per application per day  
    - Implementation: 50 requests per day
    
  Search API:
    - 100 requests per application per day
    - Implementation: 50 requests per day
```

### Request Patterns (Human-Like Behavior)
```yaml
Timing Requirements:
  - Minimum 2-3 seconds between requests
  - Random jitter: ±1-2 seconds
  - Burst prevention: Max 5 requests per minute
  - Session breaks: 15-30 minute gaps

Implementation Strategy:
  - Queue-based request management
  - Distributed rate limiting with Redis
  - Request timing randomization
  - Compliance monitoring dashboard
```

## Security Best Practices

### 1. Token Management
```typescript
// Secure token storage
interface TokenStorage {
  accessToken: string;        // Encrypted at rest
  refreshToken?: string;      // Encrypted at rest
  expiresAt: Date;           // Token expiration
  scope: string;             // Granted permissions
  encryptionKey: string;     // For token encryption
}
```

### 2. State Parameter Security
```typescript
// Enhanced state validation
interface StateData {
  userId: string;
  timestamp: number;
  nonce: string;           // Additional entropy
  redirectUrl?: string;    // Post-auth redirect
  csrfToken: string;      // CSRF protection
}
```

### 3. Request Validation
```typescript
// Every LinkedIn API request
const requestValidation = {
  validateToken: true,        // Check token validity
  checkRateLimit: true,      // Verify rate limits
  logRequest: true,          // Audit trail
  monitorCompliance: true,   // Track compliance metrics
  enableCircuitBreaker: true // Prevent cascading failures
};
```

## LinkedIn App Approval Process

### Content Management Approval
```yaml
Requirements:
  - Detailed use case description
  - Content examples and screenshots
  - Privacy policy compliance
  - Terms of service agreement
  - Data retention policies

Timeline:
  - Initial Review: 7-14 days
  - Follow-up Questions: 3-7 days
  - Final Approval: 1-3 days
  
Success Tips:
  - Clear, professional use case
  - Compliance-first approach
  - Detailed privacy documentation
  - Professional app presentation
```

### Marketing Developer Platform
```yaml
Requirements:
  - Business verification
  - Company LinkedIn page
  - Detailed marketing use case
  - Compliance documentation
  
Timeline:
  - 2-4 weeks for approval
  - May require additional documentation
  
Success Tips:
  - B2B marketing focus
  - Professional networking use case
  - Clear value proposition
  - Compliance emphasis
```

## Implementation Updates Required

### 1. Update OAuth Service Scopes
```typescript
// File: services/linkedin-service/src/services/oauth.service.ts
// Lines 22-28: Update scope configuration

// BEFORE (has deprecated scopes)
scope: [
  'r_liteprofile',
  'r_emailaddress', 
  'r_basicprofile',        // Remove - deprecated
  'rw_company_admin',      // Remove - requires approval
  'w_member_social'        // Remove until approved
]

// AFTER (compliant minimal scopes)
scope: [
  'r_liteprofile',
  'r_emailaddress'
]
```

### 2. Add Compliance Monitoring
```typescript
// New file: services/linkedin-service/src/services/compliance.service.ts
export class LinkedInComplianceService {
  private requestLog: Map<string, RequestMetrics>;
  private dailyLimits: ComplianceLimits;
  
  async validateRequest(userId: string, endpoint: string): Promise<boolean> {
    // Check daily limits
    // Validate timing patterns  
    // Monitor error rates
    // Log compliance metrics
  }
  
  async logRequest(request: LinkedInRequest): Promise<void> {
    // Track all LinkedIn API calls
    // Monitor rate limit compliance
    // Alert on suspicious patterns
  }
}
```

### 3. Enhanced Rate Limiting
```typescript
// Update: services/linkedin-service/src/middleware/rateLimiter.ts
const linkedinRateLimiter = rateLimit({
  windowMs: 60 * 1000,                    // 1 minute
  max: 5,                                 // 5 requests per minute
  message: 'LinkedIn API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;        // Per-user limiting
  },
  skip: (req) => {
    return req.path.includes('/health');   // Skip health checks
  }
});
```

## Monitoring & Alerting Setup

### Key Metrics to Track
```yaml
Compliance Metrics:
  - Daily API request count
  - Rate limit violations
  - 429 response rate
  - Token refresh frequency
  - Error rate by endpoint

Performance Metrics:
  - Request latency
  - Success rate
  - Token validation time
  - Circuit breaker activations

Security Metrics:
  - Failed authentication attempts
  - Invalid token usage
  - Suspicious request patterns
  - State parameter violations
```

### Alert Thresholds
```yaml
Critical Alerts:
  - 429 responses > 1% of requests
  - Daily limit usage > 80%
  - Error rate > 5%
  - Token refresh failures > 2%

Warning Alerts:
  - Daily limit usage > 60%
  - Request rate increase > 50%
  - New error patterns detected
  - Circuit breaker activations
```

## Testing Strategy

### 1. OAuth Flow Testing
```bash
# Test basic OAuth flow
curl -X GET "http://localhost:8000/api/v1/linkedin/auth/url?userId=test123"

# Test callback handling
curl -X POST "http://localhost:8000/api/v1/linkedin/auth/callback" \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","state":"test_state"}'
```

### 2. Rate Limiting Testing
```bash
# Test rate limiting
for i in {1..10}; do
  curl -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8000/api/v1/linkedin/profile"
  sleep 1
done
```

### 3. Compliance Testing
```bash
# Test compliance monitoring
./scripts/test-linkedin-compliance.sh
```

## Deployment Checklist

### Pre-Deployment
- [ ] LinkedIn app created and configured
- [ ] OAuth scopes minimized for compliance
- [ ] Rate limiting configured conservatively
- [ ] Compliance monitoring enabled
- [ ] Security headers configured
- [ ] Error handling implemented
- [ ] Monitoring and alerting setup

### Post-Deployment  
- [ ] OAuth flow tested end-to-end
- [ ] Rate limiting verified
- [ ] Compliance metrics baseline established
- [ ] Alert thresholds configured
- [ ] Documentation updated
- [ ] Team trained on compliance requirements

## Compliance Documentation

### Privacy Policy Requirements
```markdown
LinkedIn Data Usage:
- We access basic profile information with user consent
- Data is used solely for profile optimization services
- No data sharing with third parties
- User can revoke access at any time
- Data retention limited to service provision
- Full compliance with LinkedIn API Terms
```

### Terms of Service Updates
```markdown
LinkedIn Integration:
- Service uses LinkedIn official API only
- User responsible for LinkedIn terms compliance
- No automation violating LinkedIn policies
- Conservative usage patterns implemented
- Service may be limited by LinkedIn rate limits
- User can disconnect LinkedIn at any time
```

This configuration ensures LinkedIn API compliance while providing the core functionality needed for your LinkedIn optimization platform.