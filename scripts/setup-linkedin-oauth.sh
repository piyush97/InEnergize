#!/bin/bash

# LinkedIn OAuth Setup Script for InErgize Platform
# This script helps configure LinkedIn OAuth integration with compliance focus

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
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  LinkedIn OAuth Setup for InErgize       ${NC}"
echo -e "${BLUE}============================================${NC}"
echo

# Function to print status messages
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to prompt for user input
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    local is_secret="$4"
    
    if [ "$is_secret" = "true" ]; then
        echo -n "$prompt: "
        read -s value
        echo
    else
        if [ -n "$default_value" ]; then
            echo -n "$prompt [$default_value]: "
        else
            echo -n "$prompt: "
        fi
        read value
        
        if [ -z "$value" ] && [ -n "$default_value" ]; then
            value="$default_value"
        fi
    fi
    
    eval "$var_name='$value'"
}

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    print_status "Creating .env file from template..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    print_status ".env file created successfully"
else
    print_warning ".env file already exists. Backing up to .env.backup..."
    cp "$ENV_FILE" "$ENV_FILE.backup"
fi

echo -e "${YELLOW}=== LinkedIn Developer Setup Instructions ===${NC}"
echo
echo "Before configuring OAuth, you need to:"
echo "1. Visit: https://developer.linkedin.com/"
echo "2. Create a new app or use existing app"
echo "3. Configure OAuth redirect URLs"
echo "4. Note down Client ID and Client Secret"
echo
echo "Required OAuth Redirect URLs:"
echo "  Development: http://localhost:3000/auth/linkedin/callback"
echo "  Development: http://localhost:8000/api/v1/auth/linkedin/callback"
echo "  Production:  https://app.inergize.com/auth/linkedin/callback"
echo
echo "Required OAuth Scopes (Start with minimal):"
echo "  - r_liteprofile (Basic profile information)"
echo "  - r_emailaddress (Email address)"
echo
echo "Press Enter when you have completed the LinkedIn app setup..."
read

echo -e "${YELLOW}=== LinkedIn OAuth Configuration ===${NC}"
echo

# Get LinkedIn OAuth credentials
prompt_input "Enter LinkedIn Client ID" LINKEDIN_CLIENT_ID "" false
if [ -z "$LINKEDIN_CLIENT_ID" ]; then
    print_error "LinkedIn Client ID is required"
    exit 1
fi

prompt_input "Enter LinkedIn Client Secret" LINKEDIN_CLIENT_SECRET "" true
if [ -z "$LINKEDIN_CLIENT_SECRET" ]; then
    print_error "LinkedIn Client Secret is required"
    exit 1
fi

# Environment selection
echo
echo "Select environment:"
echo "1) Development (localhost:3000)"
echo "2) Staging"
echo "3) Production"
echo -n "Choose [1-3]: "
read env_choice

case $env_choice in
    1)
        ENVIRONMENT="development"
        REDIRECT_URI="http://localhost:3000/auth/linkedin/callback"
        ;;
    2)
        ENVIRONMENT="staging"
        prompt_input "Enter staging domain (e.g., staging.inergize.com)" STAGING_DOMAIN "" false
        REDIRECT_URI="https://$STAGING_DOMAIN/auth/linkedin/callback"
        ;;
    3)
        ENVIRONMENT="production"
        prompt_input "Enter production domain (e.g., app.inergize.com)" PROD_DOMAIN "" false
        REDIRECT_URI="https://$PROD_DOMAIN/auth/linkedin/callback"
        ;;
    *)
        print_error "Invalid environment selection"
        exit 1
        ;;
esac

print_status "Selected environment: $ENVIRONMENT"
print_status "Redirect URI: $REDIRECT_URI"

# Configure rate limiting based on environment
echo
echo -e "${YELLOW}=== Rate Limiting Configuration ===${NC}"
echo "LinkedIn compliance requires conservative rate limiting."
echo

case $environment in
    "development")
        REQUESTS_PER_MINUTE=10
        REQUESTS_PER_HOUR=100
        REQUESTS_PER_DAY=1000
        ;;
    "staging")
        REQUESTS_PER_MINUTE=5
        REQUESTS_PER_HOUR=75
        REQUESTS_PER_DAY=750
        ;;
    "production")
        REQUESTS_PER_MINUTE=3
        REQUESTS_PER_HOUR=50
        REQUESTS_PER_DAY=500
        ;;
esac

echo "Recommended rate limits for $ENVIRONMENT:"
echo "  - Per minute: $REQUESTS_PER_MINUTE"
echo "  - Per hour: $REQUESTS_PER_HOUR"
echo "  - Per day: $REQUESTS_PER_DAY"
echo

prompt_input "Requests per minute" CUSTOM_RPM "$REQUESTS_PER_MINUTE" false
prompt_input "Requests per hour" CUSTOM_RPH "$REQUESTS_PER_HOUR" false
prompt_input "Requests per day" CUSTOM_RPD "$REQUESTS_PER_DAY" false

# Update .env file
echo
print_status "Updating .env file with LinkedIn OAuth configuration..."

# Create temporary file with updated values
temp_file=$(mktemp)

# Update LinkedIn OAuth settings
sed -e "s|LINKEDIN_CLIENT_ID=\".*\"|LINKEDIN_CLIENT_ID=\"$LINKEDIN_CLIENT_ID\"|" \
    -e "s|LINKEDIN_CLIENT_SECRET=\".*\"|LINKEDIN_CLIENT_SECRET=\"$LINKEDIN_CLIENT_SECRET\"|" \
    -e "s|LINKEDIN_REDIRECT_URI=\".*\"|LINKEDIN_REDIRECT_URI=\"$REDIRECT_URI\"|" \
    -e "s|LINKEDIN_REQUESTS_PER_MINUTE=.*|LINKEDIN_REQUESTS_PER_MINUTE=$CUSTOM_RPM|" \
    -e "s|LINKEDIN_REQUESTS_PER_HOUR=.*|LINKEDIN_REQUESTS_PER_HOUR=$CUSTOM_RPH|" \
    -e "s|LINKEDIN_REQUESTS_PER_DAY=.*|LINKEDIN_REQUESTS_PER_DAY=$CUSTOM_RPD|" \
    "$ENV_FILE" > "$temp_file"

mv "$temp_file" "$ENV_FILE"

print_status "Environment file updated successfully"

# Generate compliance configuration
echo
echo -e "${YELLOW}=== Compliance Configuration ===${NC}"
echo

# Ask about compliance features
echo "Enable compliance features? (recommended for production)"
echo "1) Yes - Enable all compliance monitoring"
echo "2) No - Minimal compliance (development only)"
echo -n "Choose [1-2]: "
read compliance_choice

if [ "$compliance_choice" = "1" ]; then
    print_status "Enabling full compliance monitoring..."
    
    # Update compliance settings in .env
    sed -i.bak \
        -e "s|LINKEDIN_ENABLE_RATE_LIMITING=.*|LINKEDIN_ENABLE_RATE_LIMITING=true|" \
        -e "s|LINKEDIN_ENABLE_REQUEST_LOGGING=.*|LINKEDIN_ENABLE_REQUEST_LOGGING=true|" \
        -e "s|LINKEDIN_ENABLE_COMPLIANCE_MONITORING=.*|LINKEDIN_ENABLE_COMPLIANCE_MONITORING=true|" \
        -e "s|LINKEDIN_SAFE_MODE=.*|LINKEDIN_SAFE_MODE=true|" \
        -e "s|LINKEDIN_ENABLE_CIRCUIT_BREAKER=.*|LINKEDIN_ENABLE_CIRCUIT_BREAKER=true|" \
        "$ENV_FILE"
        
    rm -f "$ENV_FILE.bak"
    
    print_status "Compliance monitoring enabled"
else
    print_warning "Minimal compliance mode selected (not recommended for production)"
fi

# Test configuration
echo
echo -e "${YELLOW}=== Configuration Test ===${NC}"
echo

print_status "Testing LinkedIn OAuth configuration..."

# Test if required services are running
if command -v docker-compose &> /dev/null; then
    if docker-compose ps | grep -q "redis.*Up"; then
        print_status "Redis service is running"
    else
        print_warning "Redis service not running - rate limiting may not work"
        echo "Start Redis with: docker-compose up -d redis"
    fi
    
    if docker-compose ps | grep -q "postgres.*Up"; then
        print_status "PostgreSQL service is running"
    else
        print_warning "PostgreSQL service not running"
        echo "Start PostgreSQL with: docker-compose up -d postgres"
    fi
else
    print_warning "Docker Compose not found - cannot verify service status"
fi

# Test LinkedIn OAuth URL generation
print_status "Testing OAuth URL generation..."

if command -v node &> /dev/null; then
    cat > /tmp/test_linkedin_oauth.js << 'EOF'
require('dotenv').config();

const clientId = process.env.LINKEDIN_CLIENT_ID;
const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
const scope = 'r_liteprofile r_emailaddress';

if (!clientId || !redirectUri) {
    console.log('❌ Missing LinkedIn OAuth configuration');
    process.exit(1);
}

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=test123`;

console.log('✅ LinkedIn OAuth URL generated successfully');
console.log('Test URL:', authUrl.substring(0, 80) + '...');
EOF

    if node /tmp/test_linkedin_oauth.js; then
        print_status "OAuth URL generation test passed"
    else
        print_error "OAuth URL generation test failed"
    fi
    
    rm -f /tmp/test_linkedin_oauth.js
else
    print_warning "Node.js not found - cannot test OAuth URL generation"
fi

# Generate summary
echo
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo
echo "LinkedIn OAuth configuration summary:"
echo "  Client ID: ${LINKEDIN_CLIENT_ID:0:8}..."
echo "  Environment: $ENVIRONMENT"
echo "  Redirect URI: $REDIRECT_URI"
echo "  Rate Limits: $CUSTOM_RPM/min, $CUSTOM_RPH/hour, $CUSTOM_RPD/day"
echo
echo "Next steps:"
echo "1. Start required services: docker-compose up -d redis postgres"
echo "2. Start LinkedIn service: npm run dev:linkedin"
echo "3. Test OAuth flow: curl http://localhost:3003/auth/linkedin/url?userId=test"
echo "4. Monitor compliance: tail -f logs/linkedin-compliance.log"
echo
echo "Important compliance reminders:"
echo "- Stay well below LinkedIn's rate limits"
echo "- Monitor all LinkedIn API interactions"
echo "- Implement human-like request patterns"
echo "- Review LinkedIn's Terms of Service regularly"
echo
echo "Configuration saved to: $ENV_FILE"
echo "Backup available at: $ENV_FILE.backup"

# Create quick start script
cat > "$PROJECT_ROOT/scripts/linkedin-quick-start.sh" << 'EOF'
#!/bin/bash

# LinkedIn OAuth Quick Start Script

set -e

echo "Starting LinkedIn OAuth services..."

# Start dependencies
echo "Starting Redis and PostgreSQL..."
docker-compose up -d redis postgres

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Start LinkedIn service
echo "Starting LinkedIn service..."
npm run dev:linkedin &

# Wait for LinkedIn service to start
sleep 3

# Test OAuth URL generation
echo "Testing OAuth URL generation..."
curl -s "http://localhost:3003/auth/linkedin/url?userId=test123" | head -1

echo
echo "LinkedIn OAuth setup complete!"
echo "Visit: http://localhost:3003/health to check service status"
EOF

chmod +x "$PROJECT_ROOT/scripts/linkedin-quick-start.sh"

print_status "Quick start script created: scripts/linkedin-quick-start.sh"

echo
print_status "LinkedIn OAuth setup completed successfully!"
echo -e "${BLUE}============================================${NC}"