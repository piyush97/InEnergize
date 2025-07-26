# API Endpoints Documentation

## Overview

This document provides comprehensive documentation for all InErgize platform API endpoints across all services in Phase 2A.

## Base URLs

- **Authentication Service**: `http://localhost:3001`
- **User Management Service**: `http://localhost:3002`
- **LinkedIn Integration Service**: `http://localhost:3003`
- **Analytics Service**: `http://localhost:3004`
- **Web Application**: `http://localhost:3000`
- **API Gateway**: `http://localhost:8000`

## Authentication

All API endpoints (except public endpoints) require JWT authentication via the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

## Authentication Service API (Port 3001)

### Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "subscriptionLevel": "free",
      "emailVerified": false
    },
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

#### POST /auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "subscriptionLevel": "free",
      "linkedinConnected": true
    },
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

#### POST /auth/logout
Logout user and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Multi-Factor Authentication

#### POST /auth/mfa/setup
Setup TOTP-based multi-factor authentication.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGg...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backupCodes": ["12345678", "87654321", ...]
  }
}
```

#### POST /auth/mfa/verify
Verify TOTP code to complete MFA setup.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "MFA enabled successfully"
}
```

### Password Management

#### POST /auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

#### POST /auth/reset-password
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset_token",
  "password": "NewSecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

## User Management Service API (Port 3002)

### User Profile Endpoints

#### GET /users/profile
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "subscriptionLevel": "premium",
    "profilePicture": "https://example.com/image.jpg",
    "preferences": {
      "timezone": "UTC",
      "notifications": true,
      "newsletter": false
    },
    "linkedinConnected": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT /users/profile
Update user profile information.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "preferences": {
    "timezone": "America/New_York",
    "notifications": true
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Smith",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### POST /users/upload-avatar
Upload user profile picture.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:**
```
FormData: {
  "avatar": File
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "profilePicture": "https://example.com/new-image.jpg"
  }
}
```

### Subscription Management

#### GET /users/subscription
Get current subscription details.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "level": "premium",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "usage": {
      "aiRequests": 45,
      "aiRequestsLimit": 100,
      "profileScans": 12,
      "profileScansLimit": 20
    }
  }
}
```

### Admin Endpoints

#### GET /users/admin/users
Search and list users (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20)
- `search`: Search term for email/name
- `subscriptionLevel`: Filter by subscription level

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "subscriptionLevel": "premium",
        "linkedinConnected": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

## LinkedIn Integration Service API (Port 3003)

### OAuth & Connection

#### GET /linkedin/oauth/authorize
Initiate LinkedIn OAuth flow.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://www.linkedin.com/oauth/v2/authorization?..."
  }
}
```

#### POST /linkedin/oauth/callback
Handle LinkedIn OAuth callback.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "code": "oauth_code",
  "state": "state_parameter"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "profile": {
      "linkedinId": "linkedin_user_id",
      "firstName": "John",
      "lastName": "Doe",
      "headline": "Software Engineer at Tech Corp",
      "profileUrl": "https://linkedin.com/in/johndoe"
    }
  }
}
```

#### POST /linkedin/disconnect
Disconnect LinkedIn account.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "message": "LinkedIn account disconnected successfully"
}
```

### Profile Management

#### GET /linkedin/profile
Get synchronized LinkedIn profile data.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "profile": {
      "linkedinId": "linkedin_user_id",
      "firstName": "John",
      "lastName": "Doe",
      "headline": "Software Engineer at Tech Corp",
      "summary": "Experienced software engineer...",
      "location": "San Francisco, CA",
      "industry": "Technology",
      "connections": 500,
      "profilePicture": "https://linkedin.com/photo.jpg",
      "experience": [...],
      "education": [...],
      "skills": [...]
    },
    "completenessScore": 85,
    "lastSyncAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### POST /linkedin/profile/sync
Force synchronization of LinkedIn profile data.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "profile": {...},
    "completenessScore": 87,
    "syncedAt": "2024-01-01T12:30:00.000Z"
  }
}
```

#### GET /linkedin/profile/completeness
Get profile completeness analysis.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "maxScore": 100,
    "breakdown": {
      "basicInfo": { "score": 20, "maxScore": 20, "complete": true },
      "headline": { "score": 15, "maxScore": 15, "complete": true },
      "summary": { "score": 12, "maxScore": 15, "complete": false },
      "experience": { "score": 18, "maxScore": 20, "complete": false },
      "education": { "score": 10, "maxScore": 10, "complete": true },
      "skills": { "score": 8, "maxScore": 10, "complete": false },
      "recommendations": { "score": 2, "maxScore": 10, "complete": false }
    },
    "suggestions": [
      "Add a professional summary to increase your score by 3 points",
      "Add more work experience details for additional 2 points",
      "Request recommendations from colleagues"
    ]
  }
}
```

### Analytics & Insights

#### GET /linkedin/analytics/overview
Get LinkedIn profile analytics overview.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `period`: Time period (7d, 30d, 90d, 1y)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "profileViews": 245,
    "profileViewsChange": 12.5,
    "searchAppearances": 89,
    "searchAppearancesChange": -3.2,
    "postViews": 1250,
    "postViewsChange": 45.8,
    "postLikes": 89,
    "postComments": 23,
    "postShares": 12,
    "connections": 502,
    "connectionsChange": 15
  }
}
```

## Analytics Service API (Port 3004)

### Metrics Endpoints

#### GET /analytics/dashboard
Get dashboard metrics for current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `period`: Time period (1d, 7d, 30d, 90d)
- `metrics`: Comma-separated metric names

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "metrics": {
      "profileViews": {
        "current": 245,
        "previous": 218,
        "change": 12.4,
        "trend": "up"
      },
      "connections": {
        "current": 502,
        "previous": 487,
        "change": 3.1,
        "trend": "up"
      },
      "postEngagement": {
        "current": 124,
        "previous": 98,
        "change": 26.5,
        "trend": "up"
      }
    }
  }
}
```

#### POST /analytics/metrics/record
Record a new metric data point.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "metricType": "profile_view",
  "value": 1,
  "metadata": {
    "source": "linkedin_api",
    "profileSection": "headline"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Metric recorded successfully"
}
```

#### GET /analytics/metrics/history
Get historical metric data.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `metric`: Metric type (profile_views, connections, etc.)
- `period`: Time period (7d, 30d, 90d)
- `granularity`: Data granularity (hour, day, week)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "metric": "profile_views",
    "period": "30d",
    "granularity": "day",
    "data": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "value": 12
      },
      {
        "timestamp": "2024-01-02T00:00:00.000Z",
        "value": 15
      }
    ]
  }
}
```

### Real-time WebSocket API

#### WebSocket Connection
Connect to real-time analytics updates.

**Endpoint:** `ws://localhost:3004/ws`

**Authentication:** Send JWT token in first message:
```json
{
  "type": "auth",
  "token": "jwt_access_token"
}
```

**Message Types:**

**Metric Update:**
```json
{
  "type": "metric_update",
  "userId": "user_id",
  "data": {
    "metricType": "profile_view",
    "value": 1,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Activity Update:**
```json
{
  "type": "activity_update",
  "userId": "user_id",
  "data": {
    "type": "linkedin_sync",
    "message": "LinkedIn profile synchronized",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Error Responses

All API endpoints return consistent error responses:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please provide a valid access token"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "Admin access required"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Resource not found",
  "message": "User profile not found"
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again in 60 seconds.",
  "retryAfter": 60
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting

All API endpoints are subject to rate limiting:

- **Authentication endpoints**: 10 requests per minute per IP
- **Profile operations**: 30 requests per minute per user
- **LinkedIn API calls**: Conservative limits (50% of LinkedIn's published limits)
- **Analytics endpoints**: 100 requests per minute per user
- **Admin endpoints**: 200 requests per minute per admin user

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1641024000
```

## Health Check Endpoints

All services provide health check endpoints:

#### GET /health
Check service health status.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "external_apis": "healthy"
  }
}
```

## Testing

Use the provided Postman collection or Newman tests to validate API functionality:

```bash
# Run API tests
npm run test:api

# Run specific service tests
npm run test:auth
npm run test:linkedin
npm run test:analytics
```

All endpoints are thoroughly tested with unit, integration, and end-to-end tests achieving 95%+ coverage across all services.