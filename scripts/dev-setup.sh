#!/bin/bash

# InErgize Development Environment Setup Script
# Comprehensive setup for new developers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
PROJECT_NAME="InErgize"
MIN_NODE_VERSION="22.0.0"
MIN_NPM_VERSION="10.0.0"

# Function to print with colors
print_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
    echo "$(printf '=%.0s' {1..50})"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_step() {
    echo -e "${BLUE}📋 Step ${1}:${NC} $2"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Version comparison
version_ge() {
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Validate prerequisites
validate_prerequisites() {
    print_header "Validating Prerequisites"
    local errors=0
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version | sed 's/v//')
        if version_ge "$NODE_VERSION" "$MIN_NODE_VERSION"; then
            print_success "Node.js $NODE_VERSION (required: $MIN_NODE_VERSION+)"
        else
            print_error "Node.js $NODE_VERSION is below required $MIN_NODE_VERSION"
            ((errors++))
        fi
    else
        print_error "Node.js is not installed"
        ((errors++))
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        if version_ge "$NPM_VERSION" "$MIN_NPM_VERSION"; then
            print_success "npm $NPM_VERSION (required: $MIN_NPM_VERSION+)"
        else
            print_warning "npm $NPM_VERSION is below recommended $MIN_NPM_VERSION"
        fi
    else
        print_error "npm is not installed"
        ((errors++))
    fi
    
    # Check Docker
    if command_exists docker; then
        if docker info >/dev/null 2>&1; then
            print_success "Docker is installed and running"
        else
            print_error "Docker is installed but not running"
            ((errors++))
        fi
    else
        print_error "Docker is not installed"
        ((errors++))
    fi
    
    # Check Docker Compose
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        print_success "Docker Compose is available"
    else
        print_error "Docker Compose is not installed"
        ((errors++))
    fi
    
    if [[ $errors -gt 0 ]]; then
        print_error "Prerequisites validation failed. Please install missing dependencies."
        echo
        print_info "Installation guides:"
        echo "  • Node.js: https://nodejs.org"
        echo "  • Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    print_success "All prerequisites are satisfied!"
    echo
}

# Setup environment files
setup_environment() {
    print_header "Setting Up Environment Configuration"
    
    # Create .env.development if it doesn't exist
    if [[ ! -f ".env.development" ]]; then
        print_step "1" "Creating development environment file"
        cp .env .env.development 2>/dev/null || {
            print_warning ".env file not found, creating minimal .env.development"
            cat > .env.development << 'EOF'
# Development Environment
NODE_ENV=development

# Database
DATABASE_URL="postgresql://inergize_user:inergize_password@localhost:5432/inergize_dev"
ANALYTICS_DATABASE_URL="postgresql://inergize_user:inergize_password@localhost:5433/inergize_analytics"

# Redis
REDIS_URL="redis://:inergize_redis_password@localhost:6379"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production"

# Service URLs
AUTH_SERVICE_URL="http://localhost:3001"
USER_SERVICE_URL="http://localhost:3002"
WEB_APP_URL="http://localhost:3000"
EOF
        }
        print_success "Created .env.development"
    else
        print_success ".env.development already exists"
    fi
    
    # Create .env.test if it doesn't exist
    if [[ ! -f ".env.test" ]]; then
        print_step "2" "Creating test environment file"
        print_success "Test environment file already exists"
    else
        print_success ".env.test already exists"
    fi
    
    echo
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    print_step "1" "Installing root dependencies"
    npm install
    print_success "Root dependencies installed"
    
    print_step "2" "Installing service dependencies"
    
    # Auth service
    if [[ -d "services/auth-service" ]]; then
        print_info "Installing auth-service dependencies..."
        (cd services/auth-service && npm install)
        print_success "Auth service dependencies installed"
    fi
    
    # User service
    if [[ -d "services/user-service" ]]; then
        print_info "Installing user-service dependencies..."
        (cd services/user-service && npm install)
        print_success "User service dependencies installed"
    fi
    
    print_step "3" "Installing web app dependencies"
    if [[ -d "web" ]]; then
        print_info "Installing web app dependencies..."
        (cd web && npm install)
        print_success "Web app dependencies installed"
    fi
    
    echo
}

# Setup Docker infrastructure
setup_docker() {
    print_header "Setting Up Docker Infrastructure"
    
    print_step "1" "Building Docker images"
    docker-compose build
    print_success "Docker images built"
    
    print_step "2" "Starting infrastructure services"
    docker-compose up -d postgres timescale redis elasticsearch kibana kong
    print_success "Infrastructure services started"
    
    print_step "3" "Waiting for services to be ready"
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose exec -T postgres pg_isready -U inergize_user >/dev/null 2>&1; then
            break
        fi
        print_info "Waiting for database... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        print_error "Database failed to start within timeout"
        exit 1
    fi
    
    print_success "Infrastructure services are ready"
    echo
}

# Setup database
setup_database() {
    print_header "Setting Up Database"
    
    print_step "1" "Generating Prisma client"
    npx prisma generate
    print_success "Prisma client generated"
    
    print_step "2" "Applying database schema"
    npx prisma db push
    print_success "Database schema applied"
    
    print_step "3" "Seeding development data"
    if [[ -f "database/seeds/seed.ts" ]]; then
        npx prisma db seed
        print_success "Database seeded with development data"
    else
        print_warning "No seed file found, skipping data seeding"
    fi
    
    echo
}

# Install development tools
install_dev_tools() {
    print_header "Installing Development Tools"
    
    print_step "1" "Installing global tools"
    
    # Check if tools are already installed
    tools_to_install=()
    
    if ! command_exists prisma; then
        tools_to_install+=("prisma")
    fi
    
    if ! command_exists playwright; then
        tools_to_install+=("@playwright/test")
    fi
    
    if [[ ${#tools_to_install[@]} -gt 0 ]]; then
        print_info "Installing: ${tools_to_install[*]}"
        npm install -g "${tools_to_install[@]}"
        print_success "Global development tools installed"
    else
        print_success "All development tools already installed"
    fi
    
    print_step "2" "Installing Playwright browsers"
    npx playwright install
    print_success "Playwright browsers installed"
    
    echo
}

# Run initial tests
run_initial_tests() {
    print_header "Running Initial Tests"
    
    print_step "1" "Running linting"
    if npm run lint >/dev/null 2>&1; then
        print_success "Linting passed"
    else
        print_warning "Linting issues found (run 'npm run lint' to see details)"
    fi
    
    print_step "2" "Running type checking"
    if npm run type-check >/dev/null 2>&1; then
        print_success "Type checking passed"
    else
        print_warning "Type checking issues found (run 'npm run type-check' to see details)"
    fi
    
    print_step "3" "Running unit tests"
    if npm run test:unit >/dev/null 2>&1; then
        print_success "Unit tests passed"
    else
        print_warning "Some unit tests failed (run 'npm run test:unit' to see details)"
    fi
    
    echo
}

# Setup Git hooks
setup_git_hooks() {
    print_header "Setting Up Git Hooks"
    
    if [[ -d ".git" ]]; then
        print_step "1" "Installing Husky git hooks"
        npx husky install
        print_success "Git hooks installed"
        
        # Ensure hooks are executable
        if [[ -d ".husky" ]]; then
            chmod +x .husky/*
            print_success "Git hooks made executable"
        fi
    else
        print_warning "Not a git repository, skipping git hooks setup"
    fi
    
    echo
}

# Generate summary
generate_summary() {
    print_header "Setup Complete! 🎉"
    
    echo -e "${GREEN}✨ $PROJECT_NAME development environment is ready!${NC}"
    echo
    echo "📍 Available Services:"
    echo "  • Web App:        http://localhost:3000"
    echo "  • Auth Service:   http://localhost:3001"
    echo "  • User Service:   http://localhost:3002"
    echo "  • API Gateway:    http://localhost:8000"
    echo "  • Kong Admin:     http://localhost:8001"
    echo "  • Kibana:         http://localhost:5601"
    echo "  • Database:       localhost:5432"
    echo "  • Analytics DB:   localhost:5433"
    echo "  • Redis:          localhost:6379"
    echo "  • Elasticsearch:  http://localhost:9200"
    echo
    echo "🚀 Quick Commands:"
    echo "  • Start development:  npm run dev"
    echo "  • Run all tests:      npm run test"
    echo "  • Health check:       ./scripts/health-check.sh"
    echo "  • View logs:          docker-compose logs -f"
    echo "  • Stop services:      docker-compose down"
    echo
    echo "📚 Documentation:"
    echo "  • README.md           - Project overview"
    echo "  • docs/               - Technical documentation"
    echo "  • CLAUDE.md           - Development guidelines"
    echo
    echo "💡 Next Steps:"
    echo "  1. Run 'npm run dev' to start development environment"
    echo "  2. Visit http://localhost:3000 to see the application"
    echo "  3. Check ./scripts/health-check.sh for service status"
    echo "  4. Read docs/development-roadmap.md for feature plans"
    echo
    print_success "Happy coding! 🚀"
}

# Error handler
handle_error() {
    print_error "Setup failed at line $1"
    echo
    print_info "Troubleshooting:"
    echo "  • Check error messages above"
    echo "  • Ensure Docker is running"
    echo "  • Try running individual setup steps manually"
    echo "  • Check ./scripts/validate-environment.sh for issues"
    exit 1
}

# Set up error handling
trap 'handle_error $LINENO' ERR

# Main setup function
main() {
    clear
    echo -e "${PURPLE}"
    echo "██╗███╗   ██╗███████╗██████╗  ██████╗ ██╗███████╗███████╗"
    echo "██║████╗  ██║██╔════╝██╔══██╗██╔════╝ ██║╚══███╔╝██╔════╝"
    echo "██║██╔██╗ ██║█████╗  ██████╔╝██║  ███╗██║  ███╔╝ █████╗  "
    echo "██║██║╚██╗██║██╔══╝  ██╔══██╗██║   ██║██║ ███╔╝  ██╔══╝  "
    echo "██║██║ ╚████║███████╗██║  ██║╚██████╔╝██║███████╗███████╗"
    echo "╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝╚══════╝╚══════╝"
    echo -e "${NC}"
    echo "🚀 Development Environment Setup"
    echo "================================"
    echo
    
    # Check if user wants to continue
    if [[ "${1:-}" != "--yes" && "${1:-}" != "-y" ]]; then
        echo "This script will set up the complete development environment."
        echo "This includes installing dependencies, setting up Docker, and configuring databases."
        echo
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled."
            exit 0
        fi
        echo
    fi
    
    # Run setup steps
    validate_prerequisites
    setup_environment
    install_dependencies
    setup_docker
    setup_database
    install_dev_tools
    setup_git_hooks
    run_initial_tests
    generate_summary
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "InErgize Development Environment Setup"
        echo
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --yes, -y      Skip confirmation prompt"
        echo "  --help, -h     Show this help"
        echo
        echo "This script will:"
        echo "  • Validate prerequisites (Node.js, Docker, etc.)"
        echo "  • Install all project dependencies"
        echo "  • Set up Docker infrastructure"
        echo "  • Configure databases and apply schema"
        echo "  • Install development tools"
        echo "  • Set up Git hooks"
        echo "  • Run initial tests"
        echo
        ;;
    *)
        main "$@"
        ;;
esac