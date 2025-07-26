#!/bin/bash

# Kong Routes Testing Script for InErgize Platform
# Tests all service routes through Kong API Gateway

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Testing InErgize Kong API Gateway Routes${NC}"
echo "=============================================="
echo

# Function to test a route
test_route() {
    local route_name=$1
    local url=$2
    local expected_service=$3
    
    echo -n "Testing $route_name... "
    
    response=$(curl -s "$url" || echo "ERROR")
    
    if [[ "$response" == *"ERROR"* ]] || [[ "$response" == *"Connection refused"* ]]; then
        echo -e "${RED}✗ FAILED${NC} - Connection error"
        return 1
    elif [[ "$response" == *"An invalid response was received"* ]]; then
        echo -e "${YELLOW}⚠ UPSTREAM UNAVAILABLE${NC} - Service not running"
        return 1
    elif [[ "$response" == *"$expected_service"* ]] || [[ "$response" == *"healthy"* ]]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} - Unexpected response"
        echo "Response: $response"
        return 1
    fi
}

# Test Kong Admin API
echo -e "${BLUE}Kong Admin API:${NC}"
test_route "Kong Admin" "http://localhost:8001/" "Welcome to kong"
echo

# Test service routes through Kong
echo -e "${BLUE}Service Routes through Kong:${NC}"

test_route "Auth Service" "http://localhost:8000/api/v1/auth/health" "auth-service"
test_route "User Service" "http://localhost:8000/api/v1/users/health" "user-service"
test_route "LinkedIn Service" "http://localhost:8000/api/v1/linkedin/health" "linkedin-service"
test_route "Analytics Service" "http://localhost:8000/api/v1/analytics/health" "analytics-service"

echo

# Test CORS headers
echo -e "${BLUE}CORS Configuration:${NC}"
cors_response=$(curl -s -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Authorization" -X OPTIONS "http://localhost:8000/api/v1/auth/health" -i)

if [[ "$cors_response" == *"Access-Control-Allow-Origin"* ]]; then
    echo -e "${GREEN}✓ CORS Headers Present${NC}"
else
    echo -e "${YELLOW}⚠ CORS Headers Missing${NC}"
fi

# Test rate limiting headers
echo -e "${BLUE}Rate Limiting:${NC}"
rate_response=$(curl -s -i "http://localhost:8000/api/v1/auth/health")

if [[ "$rate_response" == *"X-RateLimit"* ]]; then
    echo -e "${GREEN}✓ Rate Limiting Active${NC}"
else
    echo -e "${YELLOW}⚠ Rate Limiting Headers Missing${NC}"
fi

echo
echo -e "${BLUE}📊 Kong Gateway Summary:${NC}"
echo "==============================="
echo "• Kong Admin API: http://localhost:8001"
echo "• Kong Proxy: http://localhost:8000" 
echo "• SSL Proxy: https://localhost:8443"
echo
echo "Service Endpoints:"
echo "• Auth: http://localhost:8000/api/v1/auth/*"
echo "• Users: http://localhost:8000/api/v1/users/*"
echo "• LinkedIn: http://localhost:8000/api/v1/linkedin/*"
echo "• Analytics: http://localhost:8000/api/v1/analytics/*"
echo

echo -e "${GREEN}Kong API Gateway testing complete!${NC}"