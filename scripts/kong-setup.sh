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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    # Check if required directories exist
    if [[ ! -d "$KONG_DIR" ]]; then
        log_error "Kong configuration directory not found: $KONG_DIR"
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$KONG_DIR/.env.example" ]]; then
            cp "$KONG_DIR/.env.example" "$ENV_FILE"
            log_info "Created .env file from template"
        else
            log_error "Environment template file not found: $KONG_DIR/.env.example"
            exit 1
        fi
    fi
    
    # Update environment-specific values
    case "$ENVIRONMENT" in
        development)
            sed -i.bak "s/NODE_ENV=.*/NODE_ENV=development/" "$ENV_FILE"
            sed -i.bak "s/KONG_ENV=.*/KONG_ENV=development/" "$ENV_FILE"
            sed -i.bak "s|KONG_DECLARATIVE_CONFIG=.*|KONG_DECLARATIVE_CONFIG=/kong/declarative/kong.dev.yml|" "$ENV_FILE"
            log_info "Configured for development environment"
            ;;
        production)
            sed -i.bak "s/NODE_ENV=.*/NODE_ENV=production/" "$ENV_FILE"
            sed -i.bak "s/KONG_ENV=.*/KONG_ENV=production/" "$ENV_FILE"
            sed -i.bak "s|KONG_DECLARATIVE_CONFIG=.*|KONG_DECLARATIVE_CONFIG=/kong/declarative/kong.prod.yml|" "$ENV_FILE"
            log_info "Configured for production environment"
            ;;
        *)
            sed -i.bak "s/NODE_ENV=.*/NODE_ENV=$ENVIRONMENT/" "$ENV_FILE"
            sed -i.bak "s/KONG_ENV=.*/KONG_ENV=$ENVIRONMENT/" "$ENV_FILE"
            sed -i.bak "s|KONG_DECLARATIVE_CONFIG=.*|KONG_DECLARATIVE_CONFIG=/kong/declarative/kong.yml|" "$ENV_FILE"
            log_info "Configured for $ENVIRONMENT environment"
            ;;
    esac
    
    # Clean up backup files
    rm -f "$ENV_FILE.bak"
    
    log_success "Environment configuration completed"
}

# Generate secure secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    # Generate JWT secret (32 characters minimum)
    if ! grep -q "your-super-secret-jwt-key" "$ENV_FILE"; then
        log_info "JWT secret already configured"
    else
        JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
        log_success "Generated JWT secret"
    fi
    
    # Generate API keys for different consumers
    if ! grep -q "dev-web-api-key" "$ENV_FILE"; then
        log_info "API keys already configured"
    else
        WEB_API_KEY=$(openssl rand -hex 32)
        MOBILE_API_KEY=$(openssl rand -hex 32)
        ADMIN_API_KEY=$(openssl rand -hex 32)
        
        sed -i.bak "s/WEB_APP_API_KEY=.*/WEB_APP_API_KEY=$WEB_API_KEY/" "$ENV_FILE"
        sed -i.bak "s/MOBILE_APP_API_KEY=.*/MOBILE_APP_API_KEY=$MOBILE_API_KEY/" "$ENV_FILE"
        sed -i.bak "s/ADMIN_API_KEY=.*/ADMIN_API_KEY=$ADMIN_API_KEY/" "$ENV_FILE"
        log_success "Generated API keys"
    fi
    
    # Generate JWT secrets for consumers
    WEB_JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    MOBILE_JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    ADMIN_JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    sed -i.bak "s/WEB_APP_JWT_SECRET=.*/WEB_APP_JWT_SECRET=$WEB_JWT_SECRET/" "$ENV_FILE"
    sed -i.bak "s/MOBILE_APP_JWT_SECRET=.*/MOBILE_APP_JWT_SECRET=$MOBILE_JWT_SECRET/" "$ENV_FILE"
    sed -i.bak "s/ADMIN_JWT_SECRET=.*/ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET/" "$ENV_FILE"
    
    # Clean up backup files
    rm -f "$ENV_FILE.bak"
    
    log_success "Secrets generation completed"
}

# Validate Kong configuration
validate_configuration() {
    log_info "Validating Kong configuration..."
    
    local config_file
    case "$ENVIRONMENT" in
        development)
            config_file="$KONG_DIR/kong.dev.yml"
            ;;
        production)
            config_file="$KONG_DIR/kong.prod.yml"
            ;;
        *)
            config_file="$KONG_DIR/kong.yml"
            ;;
    esac
    
    if [[ ! -f "$config_file" ]]; then
        log_error "Kong configuration file not found: $config_file"
        exit 1
    fi
    
    # Check if YAML is valid
    if command -v python3 &> /dev/null; then
        python3 -c "import yaml; yaml.safe_load(open('$config_file'))" 2>/dev/null || {
            log_error "Invalid YAML in Kong configuration file: $config_file"
            exit 1
        }
    elif command -v ruby &> /dev/null; then
        ruby -e "require 'yaml'; YAML.load_file('$config_file')" 2>/dev/null || {
            log_error "Invalid YAML in Kong configuration file: $config_file"
            exit 1
        }
    else
        log_warning "Cannot validate YAML syntax. Please ensure your configuration is valid."
    fi
    
    log_success "Kong configuration validation completed"
}

# Setup SSL certificates for development
setup_ssl_dev() {
    log_info "Setting up SSL certificates for development..."
    
    local ssl_dir="$KONG_DIR/ssl"
    mkdir -p "$ssl_dir"
    
    if [[ ! -f "$ssl_dir/kong.crt" ]] || [[ "$FORCE_RECREATE" == "true" ]]; then
        # Generate self-signed certificate for development
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$ssl_dir/kong.key" \
            -out "$ssl_dir/kong.crt" \
            -subj "/C=US/ST=CA/L=San Francisco/O=InErgize/OU=Development/CN=localhost" \
            -extensions v3_req \
            -config <(cat <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C=US
ST=CA
L=San Francisco
O=InErgize
OU=Development
CN=localhost

[v3_req]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = api.localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
        ) 2>/dev/null
        
        chmod 600 "$ssl_dir/kong.key"
        chmod 644 "$ssl_dir/kong.crt"
        
        log_success "Generated self-signed SSL certificate"
    else
        log_info "SSL certificate already exists"
    fi
}

# Create Kong network
create_network() {
    log_info "Creating Kong network..."
    
    if ! docker network ls | grep -q "inergize-network"; then
        docker network create inergize-network --driver bridge
        log_success "Created inergize-network"
    else
        log_info "Network inergize-network already exists"
    fi
}

# Start Kong and dependencies
start_kong() {
    log_info "Starting Kong API Gateway..."
    
    cd "$PROJECT_ROOT"
    
    # Check if we're using docker-compose or docker compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    # Start dependencies first
    $COMPOSE_CMD up -d redis postgres timescale elasticsearch
    
    # Wait for dependencies to be healthy
    log_info "Waiting for dependencies to be ready..."
    sleep 10
    
    # Start Kong
    if [[ "$FORCE_RECREATE" == "true" ]]; then
        $COMPOSE_CMD up -d --force-recreate kong
    else
        $COMPOSE_CMD up -d kong
    fi
    
    # Wait for Kong to be ready
    log_info "Waiting for Kong to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s http://localhost:8001/status > /dev/null 2>&1; then
            log_success "Kong is ready!"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            log_error "Kong failed to start within expected time"
            exit 1
        fi
        
        sleep 2
    done
}

# Verify Kong setup
verify_setup() {
    log_info "Verifying Kong setup..."
    
    # Check Kong admin API
    if ! curl -f -s http://localhost:8001/status > /dev/null; then
        log_error "Kong admin API is not accessible"
        exit 1
    fi
    
    # Check Kong proxy
    if ! curl -f -s http://localhost:8000 > /dev/null; then
        log_warning "Kong proxy is not responding (this might be expected with no default route)"
    fi
    
    # Display Kong information
    log_info "Kong Status:"
    curl -s http://localhost:8001/status | jq '.' || curl -s http://localhost:8001/status
    
    log_success "Kong setup verification completed"
}

# Display important information
display_info() {
    log_info "Kong API Gateway Setup Complete!"
    echo
    echo "🚀 Kong API Gateway Endpoints:"
    echo "   • Kong Admin API: http://localhost:8001"
    echo "   • Kong Proxy:     http://localhost:8000"
    echo "   • Kong SSL Proxy: https://localhost:8443"
    echo
    echo "📊 Service Endpoints (through Kong):"
    echo "   • Auth Service:      http://localhost:8000/api/v1/auth"
    echo "   • User Service:      http://localhost:8000/api/v1/users"
    echo "   • LinkedIn Service:  http://localhost:8000/api/v1/linkedin"
    echo "   • Analytics Service: http://localhost:8000/api/v1/analytics"
    echo
    echo "🔧 Useful Commands:"
    echo "   • Check Kong status:    curl http://localhost:8001/status"
    echo "   • View Kong config:     curl http://localhost:8001/config"
    echo "   • Kong logs:            docker logs inergize-kong"
    echo "   • Restart Kong:         docker restart inergize-kong"
    echo
    echo "📝 Environment: $ENVIRONMENT"
    echo "🔐 API Keys and secrets have been generated in: $ENV_FILE"
    echo
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "⚠️  Development Mode Notes:"
        echo "   • Self-signed SSL certificate created"
        echo "   • Relaxed CORS and security settings"
        echo "   • Verbose logging enabled"
        echo "   • Rate limits are permissive"
    fi
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "🔒 Production Mode Notes:"
        echo "   • Strict security policies enabled"
        echo "   • LinkedIn compliance rate limiting active"
        echo "   • SSL/TLS certificates required"
        echo "   • Audit logging enabled"
    fi
}

# Cleanup function
cleanup() {
    if [[ $? -ne 0 ]]; then
        log_error "Setup failed. Check the logs above for details."
        echo
        echo "🔧 Debugging commands:"
        echo "   • View Kong logs:     docker logs inergize-kong"
        echo "   • Check containers:   docker ps -a"
        echo "   • Validate config:    kong config -c /path/to/kong.conf parse"
    fi
}

# Main execution
main() {
    trap cleanup EXIT
    
    log_info "Starting Kong API Gateway setup for InErgize Platform"
    log_info "Environment: $ENVIRONMENT"
    
    check_root
    check_prerequisites
    setup_environment
    generate_secrets
    validate_configuration
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        setup_ssl_dev
    fi
    
    create_network
    start_kong
    verify_setup
    display_info
    
    log_success "Kong API Gateway setup completed successfully!"
}

# Help function
show_help() {
    echo "Kong API Gateway Setup Script for InErgize Platform"
    echo
    echo "Usage: $0 [ENVIRONMENT] [FORCE_RECREATE]"
    echo
    echo "Parameters:"
    echo "  ENVIRONMENT      Target environment (development|production|staging)"
    echo "                   Default: development"
    echo "  FORCE_RECREATE   Force recreation of containers (true|false)"
    echo "                   Default: false"
    echo
    echo "Examples:"
    echo "  $0                          # Setup for development"
    echo "  $0 development              # Setup for development"
    echo "  $0 production               # Setup for production"
    echo "  $0 development true         # Force recreate in development"
    echo
    echo "Environment Files:"
    echo "  development  -> kong.dev.yml"
    echo "  production   -> kong.prod.yml"
    echo "  other        -> kong.yml"
}

# Handle command line arguments
if [[ "$#" -gt 0 ]] && [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"