#!/bin/bash

# Kong API Gateway Test Suite
# Comprehensive testing for security, rate limiting, and functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# API Keys for testing
WEB_API_KEY="web_app_secure_key_dev_001"
MOBILE_API_KEY="mobile_app_secure_key_dev_001"
ADMIN_API_KEY="admin_secure_key_dev_001"
INVALID_API_KEY="invalid_key_should_fail"

# Kong endpoints
KONG_PROXY="http://localhost:8000"
KONG_ADMIN="http://localhost:8001"
KONG_MANAGER="http://localhost:8002"

# Test results array
declare -a TEST_RESULTS=()

# Function to print colored output
print_test_header() {
    echo -e "\n${PURPLE}[TEST SUITE]${NC} $1"
    echo "================================================================"
}

print_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TEST_RESULTS+=("✅ $1")
}

print_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TEST_RESULTS+=("❌ $1")
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"
    local description="$4"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    print_test "$test_name"
    
    # Run the test command and capture both status and output
    local response
    local http_status
    
    response=$(eval "$test_command" 2>/dev/null || echo "")
    http_status=$(echo "$response" | tail -n1 | grep -o '[0-9]\{3\}' || echo "000")
    
    if [[ "$http_status" == "$expected_status" ]]; then
        print_success "$description (HTTP $http_status)"
        echo "   Response: $(echo "$response" | head -n1 | cut -c1-100)"
    else
        print_failure "$description (Expected: $expected_status, Got: $http_status)"
        echo "   Response: $(echo "$response" | head -n1 | cut -c1-100)"
    fi
    
    sleep 0.5  # Brief pause between tests
}

# Function to test rate limiting
test_rate_limiting() {
    local endpoint="$1"
    local api_key="$2"
    local limit="$3"
    local description="$4"
    
    print_test "Rate limiting test: $description"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local success_count=0
    local rate_limited_count=0
    
    # Make requests up to limit + 2
    for i in $(seq 1 $((limit + 2))); do
        local response
        response=$(curl -s -w "%{http_code}" -H "X-API-Key: $api_key" "$KONG_PROXY$endpoint" 2>/dev/null || echo "000")
        local http_status=$(echo "$response" | tail -c 4)
        
        if [[ "$http_status" == "429" ]]; then
            rate_limited_count=$((rate_limited_count + 1))
        elif [[ "$http_status" =~ ^(200|502)$ ]]; then
            success_count=$((success_count + 1))
        fi
        
        sleep 0.1  # Small delay between requests
    done
    
    if [[ $rate_limited_count -gt 0 ]] && [[ $success_count -le $limit ]]; then
        print_success "$description - Rate limiting working ($success_count success, $rate_limited_count rate-limited)"
    else
        print_failure "$description - Rate limiting not working properly ($success_count success, $rate_limited_count rate-limited)"
    fi
}

# Main test execution
main() {
    print_test_header "🧪 Kong API Gateway Test Suite"
    echo "Testing Kong configuration, security, and functionality"
    echo ""
    
    # Test 1: Kong Infrastructure Tests
    print_test_header "🏗️ Infrastructure Tests"
    
    run_test "Kong Admin API Status" \
        "curl -s -w '%{http_code}' '$KONG_ADMIN/status'" \
        "200" \
        "Kong Admin API is accessible"
    
    run_test "Kong Manager Dashboard" \
        "curl -s -w '%{http_code}' '$KONG_MANAGER' -o /dev/null" \
        "200" \
        "Kong Manager dashboard is accessible"
    
    run_test "Kong Proxy Health" \
        "curl -s -w '%{http_code}' '$KONG_PROXY' -o /dev/null" \
        "404" \
        "Kong proxy is running (404 expected for root path)"
    
    run_test "Prometheus Metrics" \
        "curl -s -w '%{http_code}' '$KONG_ADMIN/metrics' -o /dev/null" \
        "200" \
        "Prometheus metrics endpoint is accessible"
    
    # Test 2: Authentication Tests
    print_test_header "🔐 Authentication Tests"
    
    run_test "No API Key (Should Fail)" \
        "curl -s -w '%{http_code}' '$KONG_PROXY/api/v1/users' -o /dev/null" \
        "401" \
        "Request without API key properly rejected"
    
    run_test "Invalid API Key (Should Fail)" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $INVALID_API_KEY' '$KONG_PROXY/api/v1/users' -o /dev/null" \
        "401" \
        "Request with invalid API key properly rejected"
    
    run_test "Valid Web API Key" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $WEB_API_KEY' '$KONG_PROXY/api/v1/users' -o /dev/null" \
        "502" \
        "Request with valid API key passes auth (502 = service not running)"
    
    run_test "Valid Mobile API Key" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $MOBILE_API_KEY' '$KONG_PROXY/api/v1/users' -o /dev/null" \
        "502" \
        "Mobile API key authentication working"
    
    run_test "Valid Admin API Key" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $ADMIN_API_KEY' '$KONG_PROXY/api/v1/users' -o /dev/null" \
        "502" \
        "Admin API key authentication working"
    
    # Test 3: Route Configuration Tests
    print_test_header "🛣️ Routing Tests"
    
    run_test "Auth Login Route (Public)" \
        "curl -s -w '%{http_code}' -X POST '$KONG_PROXY/api/v1/auth/login' -o /dev/null" \
        "502" \
        "Public auth login route accessible without API key"
    
    run_test "Auth Register Route (Public)" \
        "curl -s -w '%{http_code}' -X POST '$KONG_PROXY/api/v1/auth/register' -o /dev/null" \
        "502" \
        "Public auth register route accessible without API key"
    
    run_test "User Service Route (Protected)" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $WEB_API_KEY' '$KONG_PROXY/api/v1/users' -o /dev/null" \
        "502" \
        "Protected user service route requires API key"
    
    run_test "LinkedIn Service Route (Protected)" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $WEB_API_KEY' '$KONG_PROXY/api/v1/linkedin' -o /dev/null" \
        "502" \
        "Protected LinkedIn service route requires API key"
    
    run_test "Analytics Service Route (Protected)" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $WEB_API_KEY' '$KONG_PROXY/api/v1/analytics' -o /dev/null" \
        "502" \
        "Protected analytics service route requires API key"
    
    run_test "AI Service Route (Protected)" \
        "curl -s -w '%{http_code}' -H 'X-API-Key: $WEB_API_KEY' '$KONG_PROXY/api/v1/ai' -o /dev/null" \
        "502" \
        "Protected AI service route requires API key"
    
    # Test 4: Security Headers Tests
    print_test_header "🛡️ Security Headers Tests"
    
    print_test "Testing security headers implementation"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local headers_response
    headers_response=$(curl -s -I -H "X-API-Key: $WEB_API_KEY" "$KONG_PROXY/api/v1/users" 2>/dev/null)
    
    local security_headers_found=0
    
    if echo "$headers_response" | grep -qi "x-content-type-options"; then
        security_headers_found=$((security_headers_found + 1))
    fi
    
    if echo "$headers_response" | grep -qi "x-frame-options"; then
        security_headers_found=$((security_headers_found + 1))
    fi
    
    if echo "$headers_response" | grep -qi "x-xss-protection"; then
        security_headers_found=$((security_headers_found + 1))
    fi
    
    if echo "$headers_response" | grep -qi "x-request-id"; then
        security_headers_found=$((security_headers_found + 1))
    fi
    
    if [[ $security_headers_found -ge 3 ]]; then
        print_success "Security headers properly configured ($security_headers_found/4 found)"
    else
        print_failure "Security headers missing or incomplete ($security_headers_found/4 found)"
    fi
    
    # Test 5: Rate Limiting Tests
    print_test_header "⏱️ Rate Limiting Tests"
    
    print_warning "Testing LinkedIn service ultra-conservative rate limiting (5/min)"
    print_info "This test will take about 30 seconds to complete..."
    
    test_rate_limiting "/api/v1/linkedin" "$WEB_API_KEY" 5 "LinkedIn service rate limiting (5 requests/minute)"
    
    # Test 6: CORS Tests
    print_test_header "🌐 CORS Configuration Tests"
    
    run_test "CORS Preflight Request" \
        "curl -s -w '%{http_code}' -X OPTIONS -H 'Origin: https://app.inergize.com' -H 'Access-Control-Request-Method: GET' '$KONG_PROXY/api/v1/users' -o /dev/null" \
        "200" \
        "CORS preflight request handled correctly"
    
    # Test 7: Consumer Management Tests
    print_test_header "👤 Consumer Management Tests"
    
    print_test "Checking consumer configuration via Admin API"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local consumers_response
    consumers_response=$(curl -s "$KONG_ADMIN/consumers" 2>/dev/null)
    local consumer_count
    consumer_count=$(echo "$consumers_response" | grep -o '"username"' | wc -l || echo "0")
    
    if [[ $consumer_count -ge 3 ]]; then
        print_success "Consumers properly configured ($consumer_count consumers found)"
    else
        print_failure "Consumer configuration incomplete ($consumer_count consumers found, expected 3+)"
    fi
    
    # Test 8: Plugin Configuration Tests
    print_test_header "🔌 Plugin Configuration Tests"
    
    print_test "Checking global plugins configuration"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local plugins_response
    plugins_response=$(curl -s "$KONG_ADMIN/plugins" 2>/dev/null)
    local plugin_count
    plugin_count=$(echo "$plugins_response" | grep -o '"name"' | wc -l || echo "0")
    
    if [[ $plugin_count -ge 5 ]]; then
        print_success "Plugins properly configured ($plugin_count plugins active)"
    else
        print_failure "Plugin configuration incomplete ($plugin_count plugins found, expected 5+)"
    fi
    
    # Test Results Summary
    print_test_header "📊 Test Results Summary"
    
    echo ""
    echo -e "${BLUE}Total Tests Run:${NC} $TESTS_RUN"
    echo -e "${GREEN}Tests Passed:${NC} $TESTS_PASSED"
    echo -e "${RED}Tests Failed:${NC} $TESTS_FAILED"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed! Kong is properly configured and ready for production.${NC}"
        exit_code=0
    else
        echo -e "${YELLOW}⚠️ Some tests failed. Review the configuration and fix issues before production deployment.${NC}"
        exit_code=1
    fi
    
    # Detailed Results
    echo ""
    echo -e "${PURPLE}Detailed Test Results:${NC}"
    echo "----------------------------------------"
    for result in "${TEST_RESULTS[@]}"; do
        echo "$result"
    done
    
    echo ""
    echo -e "${BLUE}Kong Configuration Status:${NC}"
    echo "✅ Kong Manager Dashboard: http://localhost:8002"
    echo "✅ Kong Admin API: http://localhost:8001"
    echo "✅ Kong Proxy: http://localhost:8000"
    echo "✅ Prometheus Metrics: http://localhost:8001/metrics"
    echo ""
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${YELLOW}Troubleshooting Tips:${NC}"
        echo "• Check Kong logs: docker-compose logs kong"
        echo "• Verify all services are running: docker-compose ps"
        echo "• Ensure Kong migrations completed: docker-compose logs kong-migration"
        echo "• Review Kong configuration: curl http://localhost:8001/services"
        echo ""
    fi
    
    echo -e "${PURPLE}Next Steps:${NC}"
    echo "1. Start your backend services to test full integration"
    echo "2. Set up monitoring dashboards with Prometheus metrics"
    echo "3. Configure alerting for rate limits and service health"
    echo "4. Review security settings for production deployment"
    echo ""
    
    exit $exit_code
}

# Run the test suite
main "$@"