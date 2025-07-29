#!/bin/bash

# LinkedIn OAuth Test Script
# Comprehensive testing of LinkedIn OAuth integration and compliance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

# Load environment variables
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo -e "${RED}[ERROR]${NC} .env file not found. Run setup-linkedin-oauth.sh first."
    exit 1
fi

# Service URLs
LINKEDIN_SERVICE_URL="http://localhost:3003"
KONG_GATEWAY_URL="http://localhost:8000"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  LinkedIn OAuth Integration Test Suite   ${NC}"
echo -e "${BLUE}============================================${NC}"
echo

# Function to print status messages
print_status() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Test counter
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -n "Testing $test_name... "
    
    if eval "$test_command" &>/dev/null; then
        print_status "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Environment Configuration
echo -e "${YELLOW}=== Environment Configuration Tests ===${NC}"

run_test "LinkedIn Client ID configured" "[ -n \"$LINKEDIN_CLIENT_ID\" ]"
run_test "LinkedIn Client Secret configured" "[ -n \"$LINKEDIN_CLIENT_SECRET\" ]"
run_test "LinkedIn Redirect URI configured" "[ -n \"$LINKEDIN_REDIRECT_URI\" ]"
run_test "Rate limiting configured" "[ -n \"$LINKEDIN_REQUESTS_PER_MINUTE\" ]"

# Validate specific configuration values
if [ -n "$LINKEDIN_CLIENT_ID" ]; then
    if [ ${#LINKEDIN_CLIENT_ID} -ge 10 ]; then
        print_status "Client ID length appears valid"
    else
        print_warning "Client ID seems too short (${#LINKEDIN_CLIENT_ID} chars)"
    fi
fi

if [ -n "$LINKEDIN_REDIRECT_URI" ]; then
    if [[ "$LINKEDIN_REDIRECT_URI" =~ ^https?:// ]]; then
        print_status "Redirect URI format is valid"
    else
        print_error "Redirect URI must start with http:// or https://"
    fi
fi

echo

# Test 2: Service Dependencies  
echo -e "${YELLOW}=== Service Dependencies Tests ===${NC}"

run_test "Redis service available" "docker-compose ps | grep -q 'redis.*Up'"
run_test "PostgreSQL service available" "docker-compose ps | grep -q 'postgres.*Up'"

# Test Redis connection
if command -v redis-cli &> /dev/null; then
    run_test "Redis connection working" "redis-cli ping | grep -q PONG"
else
    print_warning "redis-cli not available - cannot test Redis connection"
fi

# Test PostgreSQL connection
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
    run_test "PostgreSQL connection working" "psql \"$DATABASE_URL\" -c 'SELECT 1;'"
else
    print_warning "psql not available or DATABASE_URL not set - cannot test PostgreSQL"
fi

echo

# Test 3: LinkedIn Service Health
echo -e "${YELLOW}=== LinkedIn Service Tests ===${NC}"

# Check if LinkedIn service is running
if curl -sf "$LINKEDIN_SERVICE_URL/health" &>/dev/null; then
    print_status "LinkedIn service is running"
    
    # Test health endpoint details
    HEALTH_RESPONSE=$(curl -s "$LINKEDIN_SERVICE_URL/health")
    if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
        print_status "LinkedIn service health check passes"
    else
        print_warning "LinkedIn service health check concerns: $HEALTH_RESPONSE"
    fi
else
    print_error "LinkedIn service is not running on $LINKEDIN_SERVICE_URL"
    echo "Start with: npm run dev:linkedin or docker-compose up linkedin-service"
fi

echo

# Test 4: OAuth URL Generation
echo -e "${YELLOW}=== OAuth URL Generation Tests ===${NC}"

if curl -sf "$LINKEDIN_SERVICE_URL/health" &>/dev/null; then
    # Test OAuth URL generation
    TEST_USER_ID="test-user-$(date +%s)"
    OAUTH_URL_RESPONSE=$(curl -s "$LINKEDIN_SERVICE_URL/auth/linkedin/url?userId=$TEST_USER_ID")
    
    if echo "$OAUTH_URL_RESPONSE" | grep -q "linkedin.com/oauth/v2/authorization"; then
        print_status "OAuth URL generation working"
        
        # Validate OAuth URL parameters
        if echo "$OAUTH_URL_RESPONSE" | grep -q "client_id=$LINKEDIN_CLIENT_ID"; then
            print_status "Client ID in OAuth URL is correct"
        else
            print_error "Client ID in OAuth URL is incorrect"
        fi
        
        if echo "$OAUTH_URL_RESPONSE" | grep -q "redirect_uri="; then
            print_status "Redirect URI included in OAuth URL"
        else
            print_error "Redirect URI missing from OAuth URL"
        fi
        
        if echo "$OAUTH_URL_RESPONSE" | grep -q "scope="; then
            print_status "Scope included in OAuth URL"
        else
            print_error "Scope missing from OAuth URL"
        fi
        
        if echo "$OAUTH_URL_RESPONSE" | grep -q "state="; then
            print_status "State parameter included in OAuth URL"
        else
            print_error "State parameter missing from OAuth URL"
        fi
        
    else
        print_error "OAuth URL generation failed"
        echo "Response: $OAUTH_URL_RESPONSE"
    fi
else
    print_warning "LinkedIn service not available - skipping OAuth URL tests"
fi

echo

# Test 5: Rate Limiting Tests
echo -e "${YELLOW}=== Rate Limiting Tests ===${NC}"

if curl -sf "$LINKEDIN_SERVICE_URL/health" &>/dev/null; then
    print_info "Testing rate limiting (this may take a moment)..."
    
    # Test rapid requests to trigger rate limiting
    RATE_LIMIT_TRIGGERED=false
    
    for i in {1..10}; do
        RESPONSE=$(curl -s -w "%{http_code}" "$LINKEDIN_SERVICE_URL/auth/linkedin/url?userId=rate-test-$i")
        HTTP_CODE="${RESPONSE: -3}"
        
        if [ "$HTTP_CODE" = "429" ]; then
            RATE_LIMIT_TRIGGERED=true
            break
        fi
        
        sleep 0.1
    done
    
    if [ "$RATE_LIMIT_TRIGGERED" = true ]; then
        print_status "Rate limiting is working (HTTP 429 received)"
    else
        print_warning "Rate limiting may not be configured properly"
    fi
else
    print_warning "LinkedIn service not available - skipping rate limiting tests"
fi

echo

# Test 6: Kong Gateway Integration (if available)
echo -e "${YELLOW}=== Kong Gateway Integration Tests ===${NC}"

if curl -sf "$KONG_GATEWAY_URL" &>/dev/null; then
    print_status "Kong Gateway is accessible"
    
    # Test LinkedIn service through Kong
    KONG_LINKEDIN_URL="$KONG_GATEWAY_URL/api/v1/linkedin"
    
    if curl -sf "$KONG_LINKEDIN_URL/health" &>/dev/null; then
        print_status "LinkedIn service accessible through Kong"
        
        # Test Kong rate limiting
        KONG_HEADERS=$(curl -s -I "$KONG_LINKEDIN_URL/health")
        if echo "$KONG_HEADERS" | grep -qi "x-ratelimit"; then
            print_status "Kong rate limiting headers present"
        else
            print_warning "Kong rate limiting headers not found"
        fi
        
    else
        print_warning "LinkedIn service not accessible through Kong"
    fi
else
    print_warning "Kong Gateway not available - skipping Kong integration tests"
fi

echo

# Test 7: Compliance Configuration
echo -e "${YELLOW}=== Compliance Configuration Tests ===${NC}"

# Check compliance environment variables
run_test "Rate limiting enabled" "[ \"$LINKEDIN_ENABLE_RATE_LIMITING\" = \"true\" ]"
run_test "Request logging enabled" "[ \"$LINKEDIN_ENABLE_REQUEST_LOGGING\" = \"true\" ]"
run_test "Compliance monitoring enabled" "[ \"$LINKEDIN_ENABLE_COMPLIANCE_MONITORING\" = \"true\" ]"
run_test "Safe mode enabled" "[ \"$LINKEDIN_SAFE_MODE\" = \"true\" ]"

# Validate rate limiting values
if [ -n "$LINKEDIN_REQUESTS_PER_MINUTE" ]; then
    if [ "$LINKEDIN_REQUESTS_PER_MINUTE" -le 10 ]; then
        print_status "Per-minute rate limit is conservative ($LINKEDIN_REQUESTS_PER_MINUTE)"
    else
        print_warning "Per-minute rate limit may be too high for compliance ($LINKEDIN_REQUESTS_PER_MINUTE)"
    fi
fi

if [ -n "$LINKEDIN_REQUESTS_PER_DAY" ]; then
    if [ "$LINKEDIN_REQUESTS_PER_DAY" -le 1000 ]; then
        print_status "Daily rate limit is conservative ($LINKEDIN_REQUESTS_PER_DAY)"
    else
        print_warning "Daily rate limit may be too high for compliance ($LINKEDIN_REQUESTS_PER_DAY)"
    fi
fi

echo

# Test 8: Security Configuration
echo -e "${YELLOW}=== Security Configuration Tests ===${NC}"

run_test "State validation enabled" "[ \"$LINKEDIN_ENABLE_STATE_VALIDATION\" = \"true\" ]"
run_test "State TTL configured" "[ -n \"$LINKEDIN_STATE_TTL\" ]"
run_test "Minimum request delay configured" "[ -n \"$LINKEDIN_MIN_REQUEST_DELAY\" ]"

# Check for secure redirect URI in production
if [[ "$LINKEDIN_REDIRECT_URI" =~ ^https:// ]]; then
    print_status "Using secure HTTPS redirect URI"
elif [[ "$LINKEDIN_REDIRECT_URI" =~ ^http://localhost ]]; then
    print_warning "Using localhost HTTP redirect URI (development only)"
else
    print_error "Insecure redirect URI detected - use HTTPS in production"
fi

echo

# Test 9: API Endpoint Testing
echo -e "${YELLOW}=== API Endpoint Tests ===${NC}"

if curl -sf "$LINKEDIN_SERVICE_URL/health" &>/dev/null; then
    
    # Test various endpoints
    run_test "Health endpoint responds" "curl -sf '$LINKEDIN_SERVICE_URL/health'"
    run_test "OAuth URL endpoint responds" "curl -sf '$LINKEDIN_SERVICE_URL/auth/linkedin/url?userId=test'"
    
    # Test compliance endpoints (may require authentication)
    if curl -sf "$LINKEDIN_SERVICE_URL/compliance/status" &>/dev/null; then
        print_status "Compliance status endpoint available"
    else
        print_info "Compliance status endpoint requires authentication (expected)"
    fi
    
else
    print_warning "LinkedIn service not available - skipping API endpoint tests"
fi

echo

# Test 10: Configuration Validation
echo -e "${YELLOW}=== Configuration Validation ===${NC}"

# Validate OAuth scope
if [ "$LINKEDIN_SCOPE" = "r_liteprofile r_emailaddress" ]; then
    print_status "Using minimal compliant OAuth scopes"
elif echo "$LINKEDIN_SCOPE" | grep -q "w_member_social"; then
    print_warning "Using w_member_social scope - ensure LinkedIn approval"
else
    print_warning "Using custom OAuth scopes: $LINKEDIN_SCOPE"
fi

# Validate environment
if [ "$NODE_ENV" = "production" ]; then
    if [[ "$LINKEDIN_REDIRECT_URI" =~ ^https:// ]]; then
        print_status "Production environment with HTTPS redirect URI"
    else
        print_error "Production environment should use HTTPS redirect URI"
    fi
else
    print_info "Development environment configuration"
fi

echo

# Test Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests: $TESTS_TOTAL"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed! LinkedIn OAuth integration is ready.${NC}"
    
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Test OAuth flow manually:"
    echo "   curl '$LINKEDIN_SERVICE_URL/auth/linkedin/url?userId=YOUR_USER_ID'"
    echo "2. Complete OAuth flow in browser"
    echo "3. Monitor compliance metrics"
    echo "4. Review LinkedIn API usage in dashboard"
    
else
    echo -e "\n${RED}❌ Some tests failed. Please review the configuration.${NC}"
    
    echo -e "\n${YELLOW}Common solutions:${NC}"
    echo "1. Ensure all environment variables are set in .env"
    echo "2. Start required services: docker-compose up -d redis postgres"
    echo "3. Start LinkedIn service: npm run dev:linkedin"
    echo "4. Check LinkedIn app configuration in developer portal"
    echo "5. Verify redirect URIs match exactly"
fi

# Additional Information
echo -e "\n${YELLOW}=== Additional Information ===${NC}"
echo "LinkedIn Developer Portal: https://developer.linkedin.com/"
echo "OAuth Scopes Documentation: https://docs.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow"
echo "Rate Limiting Guidelines: https://docs.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits"
echo
echo "Environment file: $ENV_FILE"
echo "Test logs: Check service logs for detailed error information"

# Generate quick start command
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}Quick start command:${NC}"
    echo "./scripts/linkedin-quick-start.sh"
fi

echo -e "\n${BLUE}============================================${NC}"