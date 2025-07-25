#!/bin/bash

# Phase 2 Testing Script for InErgize Authentication & User Management Services
# This script provides comprehensive testing for all implemented features

set -e  # Exit on any error

echo "🧪 InErgize Phase 2 Testing Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test variables
AUTH_SERVICE_URL="http://localhost:3001"
USER_SERVICE_URL="http://localhost:3002"
TEST_EMAIL="test-user-$(date +%s)@example.com"
TEST_PASSWORD="SecurePass123"
ACCESS_TOKEN=""
REFRESH_TOKEN=""
USER_ID=""

echo ""
echo "🔍 Step 1: Service Health Checks"
echo "================================"

# Check Auth Service Health
print_status "Checking Auth Service health..."
AUTH_HEALTH=$(curl -s "${AUTH_SERVICE_URL}/health" || echo '{"status":"error"}')
AUTH_STATUS=$(echo $AUTH_HEALTH | jq -r '.status // "error"')

if [ "$AUTH_STATUS" = "healthy" ]; then
    print_success "Auth Service is healthy"
    echo "   - Database: $(echo $AUTH_HEALTH | jq -r '.checks.database')"
    echo "   - Redis: $(echo $AUTH_HEALTH | jq -r '.checks.redis')"
    echo "   - Rate Limiting: $(echo $AUTH_HEALTH | jq -r '.checks.rateLimiting')"
else
    print_error "Auth Service is not healthy"
    echo $AUTH_HEALTH
    exit 1
fi

# Check User Service Health
print_status "Checking User Service health..."
USER_HEALTH=$(curl -s "${USER_SERVICE_URL}/health" || echo '{"status":"error"}')
USER_STATUS=$(echo $USER_HEALTH | jq -r '.status // "error"')

if [ "$USER_STATUS" = "healthy" ]; then
    print_success "User Service is healthy"
    echo "   - Database: $(echo $USER_HEALTH | jq -r '.checks.database')"
    echo "   - Auth Service: $(echo $USER_HEALTH | jq -r '.checks.authService')"
    echo "   - Storage: $(echo $USER_HEALTH | jq -r '.checks.storage')"
else
    print_error "User Service is not healthy"
    echo $USER_HEALTH
    exit 1
fi

echo ""
echo "🔐 Step 2: Authentication Service Testing"
echo "======================================="

# Test 1: User Registration
print_status "Testing user registration..."
REGISTRATION_DATA="{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"firstName\":\"Test\",\"lastName\":\"User\"}"

REGISTER_RESPONSE=$(curl -s -X POST "${AUTH_SERVICE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "$REGISTRATION_DATA" || echo '{"success":false,"message":"Request failed"}')

REGISTER_SUCCESS=$(echo $REGISTER_RESPONSE | jq -r '.success // false')

if [ "$REGISTER_SUCCESS" = "true" ]; then
    print_success "User registration successful"
    USER_ID=$(echo $REGISTER_RESPONSE | jq -r '.user.id // ""')
    echo "   - User ID: $USER_ID"
    echo "   - Email: $(echo $REGISTER_RESPONSE | jq -r '.user.email')"
else
    print_error "User registration failed"
    echo "   - Error: $(echo $REGISTER_RESPONSE | jq -r '.message')"
    echo "   - Full response: $REGISTER_RESPONSE"
    
    # Continue with login test in case user already exists
    print_warning "Attempting login with existing user..."
fi

# Test 2: User Login
print_status "Testing user login..."
LOGIN_DATA="{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}"

LOGIN_RESPONSE=$(curl -s -X POST "${AUTH_SERVICE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_DATA" || echo '{"success":false,"message":"Request failed"}')

LOGIN_SUCCESS=$(echo $LOGIN_RESPONSE | jq -r '.success // false')

if [ "$LOGIN_SUCCESS" = "true" ]; then
    print_success "User login successful"
    ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // ""')
    REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.refreshToken // ""')
    USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.user.id // ""')
    echo "   - Access token received: ${ACCESS_TOKEN:0:20}..."
    echo "   - Refresh token received: ${REFRESH_TOKEN:0:20}..."
    echo "   - User ID: $USER_ID"
else
    print_error "User login failed - this will affect subsequent tests"
    echo "   - Error: $(echo $LOGIN_RESPONSE | jq -r '.message')"
    echo "   - Full response: $LOGIN_RESPONSE"
fi

# Test 3: Token Verification (Get Current User)
if [ ! -z "$ACCESS_TOKEN" ]; then
    print_status "Testing token verification..."
    
    ME_RESPONSE=$(curl -s -X GET "${AUTH_SERVICE_URL}/auth/me" \
      -H "Authorization: Bearer $ACCESS_TOKEN" || echo '{"success":false}')
    
    ME_SUCCESS=$(echo $ME_RESPONSE | jq -r '.success // false')
    
    if [ "$ME_SUCCESS" = "true" ]; then
        print_success "Token verification successful"
        echo "   - User: $(echo $ME_RESPONSE | jq -r '.user.email')"
        echo "   - Role: $(echo $ME_RESPONSE | jq -r '.user.role')"
    else
        print_error "Token verification failed"
        echo "   - Error: $(echo $ME_RESPONSE | jq -r '.message')"
    fi
fi

# Test 4: Token Refresh
if [ ! -z "$REFRESH_TOKEN" ]; then
    print_status "Testing token refresh..."
    
    REFRESH_RESPONSE=$(curl -s -X POST "${AUTH_SERVICE_URL}/auth/refresh" \
      -H "Content-Type: application/json" \
      -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" || echo '{"success":false}')
    
    REFRESH_SUCCESS=$(echo $REFRESH_RESPONSE | jq -r '.success // false')
    
    if [ "$REFRESH_SUCCESS" = "true" ]; then
        print_success "Token refresh successful"
        NEW_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | jq -r '.accessToken // ""')
        echo "   - New access token: ${NEW_ACCESS_TOKEN:0:20}..."
        ACCESS_TOKEN=$NEW_ACCESS_TOKEN  # Update for subsequent tests
    else
        print_error "Token refresh failed"
        echo "   - Error: $(echo $REFRESH_RESPONSE | jq -r '.message')"
    fi
fi

echo ""
echo "👤 Step 3: User Management Service Testing"
echo "========================================"

# Test 5: Get User Profile
if [ ! -z "$ACCESS_TOKEN" ]; then
    print_status "Testing get user profile..."
    
    PROFILE_RESPONSE=$(curl -s -X GET "${USER_SERVICE_URL}/users/profile" \
      -H "Authorization: Bearer $ACCESS_TOKEN" || echo '{"success":false}')
    
    PROFILE_SUCCESS=$(echo $PROFILE_RESPONSE | jq -r '.success // false')
    
    if [ "$PROFILE_SUCCESS" = "true" ]; then
        print_success "Get user profile successful"
        echo "   - Email: $(echo $PROFILE_RESPONSE | jq -r '.user.email')"
        echo "   - Subscription: $(echo $PROFILE_RESPONSE | jq -r '.user.subscriptionLevel')"
    else
        print_error "Get user profile failed"
        echo "   - Error: $(echo $PROFILE_RESPONSE | jq -r '.message')"
    fi
fi

# Test 6: Update User Profile
if [ ! -z "$ACCESS_TOKEN" ]; then
    print_status "Testing update user profile..."
    
    UPDATE_DATA='{"firstName":"Updated Test","lastName":"Updated User","bio":"This is a test bio"}'
    
    UPDATE_RESPONSE=$(curl -s -X PUT "${USER_SERVICE_URL}/users/profile" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_DATA" || echo '{"success":false}')
    
    UPDATE_SUCCESS=$(echo $UPDATE_RESPONSE | jq -r '.success // false')
    
    if [ "$UPDATE_SUCCESS" = "true" ]; then
        print_success "Update user profile successful"
        echo "   - Updated name: $(echo $UPDATE_RESPONSE | jq -r '.user.firstName') $(echo $UPDATE_RESPONSE | jq -r '.user.lastName')"
    else
        print_error "Update user profile failed"
        echo "   - Error: $(echo $UPDATE_RESPONSE | jq -r '.message')"
    fi
fi

# Test 7: Get User Preferences
if [ ! -z "$ACCESS_TOKEN" ]; then
    print_status "Testing get user preferences..."
    
    PREFERENCES_RESPONSE=$(curl -s -X GET "${USER_SERVICE_URL}/users/preferences" \
      -H "Authorization: Bearer $ACCESS_TOKEN" || echo '{"success":false}')
    
    PREFERENCES_SUCCESS=$(echo $PREFERENCES_RESPONSE | jq -r '.success // false')
    
    if [ "$PREFERENCES_SUCCESS" = "true" ]; then
        print_success "Get user preferences successful"
        echo "   - Theme: $(echo $PREFERENCES_RESPONSE | jq -r '.preferences.theme')"
        echo "   - Language: $(echo $PREFERENCES_RESPONSE | jq -r '.preferences.language')"
    else
        print_error "Get user preferences failed"
        echo "   - Error: $(echo $PREFERENCES_RESPONSE | jq -r '.message')"
    fi
fi

echo ""
echo "🔒 Step 4: Security & Rate Limiting Testing"
echo "========================================="

# Test 8: Rate Limiting (Multiple rapid requests)
print_status "Testing rate limiting with rapid requests..."

RATE_LIMIT_FAILURES=0
for i in {1..6}; do
    LOGIN_ATTEMPT=$(curl -s -X POST "${AUTH_SERVICE_URL}/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"nonexistent@example.com","password":"wrongpassword"}' || echo '{"success":false}')
    
    if echo $LOGIN_ATTEMPT | grep -q "rate.limit\|too.many\|attempts"; then
        print_success "Rate limiting is working (attempt $i)"
        break
    elif [ $i -eq 6 ]; then
        print_warning "Rate limiting may not be properly configured"
    fi
done

echo ""
echo "📊 Step 5: Testing Summary"
echo "========================"

echo "✅ Services Status:"
echo "   - Auth Service: $AUTH_STATUS"
echo "   - User Service: $USER_STATUS"

echo ""
echo "🔧 Manual Testing Commands"
echo "========================="
echo "You can use these commands for additional manual testing:"
echo ""
echo "# Health Checks"
echo "curl http://localhost:3001/health | jq '.'"
echo "curl http://localhost:3002/health | jq '.'"
echo ""
echo "# Authentication Testing"
echo "curl -X POST http://localhost:3001/auth/register \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"your@email.com\",\"password\":\"YourPassword123\",\"firstName\":\"Your\",\"lastName\":\"Name\"}' | jq '.'"
echo ""
echo "curl -X POST http://localhost:3001/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"your@email.com\",\"password\":\"YourPassword123\"}' | jq '.'"
echo ""
echo "# With your actual token:"
echo "curl -X GET http://localhost:3001/auth/me \\"
echo "  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' | jq '.'"
echo ""
echo "curl -X GET http://localhost:3002/users/profile \\"
echo "  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' | jq '.'"

echo ""
print_success "Testing completed! Check the results above for any failures."