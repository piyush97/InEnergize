#!/bin/bash

# LinkedIn Service Testing Script
echo "🔍 Testing LinkedIn Service Endpoints"
echo "======================================"

# Service URL
SERVICE_URL="http://localhost:3003"

# Test health endpoint
echo "1. Testing health endpoint..."
response=$(curl -s "$SERVICE_URL/health")
echo "Response: $response"
echo ""

# Test metrics endpoint (expected to fail without proper setup)
echo "2. Testing metrics endpoint..."
response=$(curl -s "$SERVICE_URL/metrics")
echo "Response: $response"
echo ""

# Test OAuth initiation (should require authentication)
echo "3. Testing OAuth initiation endpoint (should require auth)..."
response=$(curl -s -X POST "$SERVICE_URL/api/linkedin/auth/initiate" -H "Content-Type: application/json")
echo "Response: $response"
echo ""

# Test profile endpoint (should require authentication)
echo "4. Testing profile endpoint (should require auth)..."
response=$(curl -s "$SERVICE_URL/api/linkedin/profile" -H "Accept: application/json")
echo "Response: $response"
echo ""

# Test completeness scoring endpoint (should require authentication)
echo "5. Testing completeness scoring endpoint (should require auth)..."
response=$(curl -s "$SERVICE_URL/api/linkedin/profile/completeness" -H "Accept: application/json")
echo "Response: $response"
echo ""

# Test rate limits endpoint (should require authentication)
echo "6. Testing rate limits endpoint (should require auth)..."
response=$(curl -s "$SERVICE_URL/api/linkedin/rate-limits" -H "Accept: application/json")
echo "Response: $response"
echo ""

# Test invalid endpoint
echo "7. Testing invalid endpoint..."
response=$(curl -s "$SERVICE_URL/invalid-endpoint" -H "Accept: application/json")
echo "Response: $response"
echo ""

echo "✅ LinkedIn Service basic endpoint testing completed!"
echo ""
echo "Expected results:"
echo "- Health endpoint should return healthy status"
echo "- All other endpoints should require authentication (401 or authentication error)"
echo "- Invalid endpoints should return 404 or appropriate error"