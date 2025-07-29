#!/bin/bash

# Kong Manager Setup Script
# This script sets up Kong with Manager dashboard and migrates declarative config

set -e

echo "🚀 Setting up Kong with Manager Dashboard..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Stop existing Kong service
print_status "Stopping existing Kong service..."
docker-compose down kong 2>/dev/null || true

# Step 2: Start Kong with Manager
print_status "Starting Kong with database and Manager..."
docker-compose -f docker-compose.yml -f docker-compose.kong-manager.yml up -d kong-database
sleep 10

docker-compose -f docker-compose.yml -f docker-compose.kong-manager.yml up -d kong-migration
sleep 5

docker-compose -f docker-compose.yml -f docker-compose.kong-manager.yml up -d kong

# Step 3: Wait for Kong to be ready
print_status "Waiting for Kong to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8001/status > /dev/null 2>&1; then
        print_success "Kong is ready!"
        break
    fi
    echo -n "."
    sleep 2
done

# Step 4: Apply declarative configuration via Admin API
print_status "Applying configuration from kong.test.yml..."

# Convert YAML to JSON and apply via Admin API
if command -v yq > /dev/null 2>&1; then
    print_status "Using yq to convert YAML configuration..."
    
    # Apply services
    yq eval '.services[]' infrastructure/kong/kong.test.yml -o=json | while IFS= read -r service; do
        if [ "$service" != "null" ]; then
            echo "$service" | curl -s -X POST http://localhost:8001/services \
                -H "Content-Type: application/json" \
                -d @- > /dev/null
            print_status "Applied service: $(echo "$service" | jq -r '.name')"
        fi
    done
    
    # Apply routes
    yq eval '.routes[]' infrastructure/kong/kong.test.yml -o=json | while IFS= read -r route; do
        if [ "$route" != "null" ]; then
            echo "$route" | curl -s -X POST http://localhost:8001/routes \
                -H "Content-Type: application/json" \
                -d @- > /dev/null
            print_status "Applied route: $(echo "$route" | jq -r '.name')"
        fi
    done
    
    # Apply plugins
    yq eval '.plugins[]' infrastructure/kong/kong.test.yml -o=json | while IFS= read -r plugin; do
        if [ "$plugin" != "null" ]; then
            echo "$plugin" | curl -s -X POST http://localhost:8001/plugins \
                -H "Content-Type: application/json" \
                -d @- > /dev/null
            print_status "Applied plugin: $(echo "$plugin" | jq -r '.name')"
        fi
    done
    
else
    print_warning "yq not found. Please install yq to automatically apply configuration."
    print_status "You can manually configure Kong using the Manager UI at http://localhost:8002"
fi

# Step 5: Show access information
echo ""
print_success "Kong Manager Setup Complete!"
echo ""
print_status "Access Information:"
echo "  🌐 Kong Manager Dashboard: http://localhost:8002"
echo "  🔧 Kong Admin API:         http://localhost:8001"
echo "  🚀 Kong Proxy:             http://localhost:8000"
echo ""
print_status "Default Login (basic-auth):"
echo "  Username: admin"
echo "  Password: admin"
echo ""
print_status "Testing connectivity..."

# Test endpoints
if curl -s http://localhost:8001/status > /dev/null; then
    print_success "✅ Admin API is accessible"
else
    print_error "❌ Admin API is not accessible"
fi

if curl -s http://localhost:8002 > /dev/null; then
    print_success "✅ Manager Dashboard is accessible"
else
    print_error "❌ Manager Dashboard is not accessible"
fi

if curl -s http://localhost:8000 > /dev/null; then
    print_success "✅ Proxy is accessible"
else
    print_error "❌ Proxy is not accessible"
fi

echo ""
print_status "If you see connection errors, please wait a few moments for Kong to fully initialize."
print_status "You can check Kong logs with: docker-compose logs kong"
echo ""
print_success "Happy API Gateway management! 🎉"