#!/bin/bash

# InErgize Environment Validation Script
# This script validates that all required dependencies and configurations are properly set up

set -e

echo "🔍 InErgize Environment Validation Starting..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error tracking
ERRORS=0
WARNINGS=0

# Function to print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node() {
    print_info "Checking Node.js..."
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_NODE="18.0.0"
        if [[ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]]; then
            print_success "Node.js $NODE_VERSION (required: $REQUIRED_NODE+)"
        else
            print_error "Node.js version $NODE_VERSION is below required $REQUIRED_NODE"
        fi
    else
        print_error "Node.js is not installed"
    fi
}

# Check npm version
check_npm() {
    print_info "Checking npm..."
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        REQUIRED_NPM="9.0.0"
        if [[ "$(printf '%s\n' "$REQUIRED_NPM" "$NPM_VERSION" | sort -V | head -n1)" = "$REQUIRED_NPM" ]]; then
            print_success "npm $NPM_VERSION (required: $REQUIRED_NPM+)"
        else
            print_warning "npm version $NPM_VERSION is below recommended $REQUIRED_NPM"
        fi
    else
        print_error "npm is not installed"
    fi
}

# Check Docker
check_docker() {
    print_info "Checking Docker..."
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        print_success "Docker $DOCKER_VERSION"
        
        # Check if Docker daemon is running
        if docker info >/dev/null 2>&1; then
            print_success "Docker daemon is running"
        else
            print_error "Docker daemon is not running"
        fi
    else
        print_error "Docker is not installed"
    fi
}

# Check Docker Compose
check_docker_compose() {
    print_info "Checking Docker Compose..."
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        if command_exists docker-compose; then
            COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
            print_success "Docker Compose $COMPOSE_VERSION"
        else
            COMPOSE_VERSION=$(docker compose version --short)
            print_success "Docker Compose $COMPOSE_VERSION (plugin)"
        fi
    else
        print_error "Docker Compose is not installed"
    fi
}

# Check Git
check_git() {
    print_info "Checking Git..."
    if command_exists git; then
        GIT_VERSION=$(git --version | cut -d' ' -f3)
        print_success "Git $GIT_VERSION"
    else
        print_error "Git is not installed"
    fi
}

# Check project structure
check_project_structure() {
    print_info "Checking project structure..."
    
    required_dirs=(
        "services/auth-service"
        "services/user-service"
        "web"
        "database"
        "infrastructure"
        "shared"
        "tests"
        "docs"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            print_success "Directory: $dir"
        else
            print_error "Missing directory: $dir"
        fi
    done
}

# Check required files
check_required_files() {
    print_info "Checking required files..."
    
    required_files=(
        "package.json"
        "tsconfig.json"
        "docker-compose.yml"
        "docker-compose.prod.yml"
        ".env.example"
        ".gitignore"
        "README.md"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "File: $file"
        else
            print_error "Missing file: $file"
        fi
    done
}

# Check environment variables
check_environment_variables() {
    print_info "Checking environment configuration..."
    
    if [[ -f ".env.development" ]]; then
        print_success "Development environment file exists"
    else
        print_warning "No .env.development file found (optional for development)"
    fi
    
    if [[ -f ".env.example" ]]; then
        print_success "Environment template file exists"
    else
        print_error "No .env.example template file found"
    fi
}

# Check package.json scripts
check_package_scripts() {
    print_info "Checking package.json scripts..."
    
    required_scripts=(
        "dev"
        "build"
        "test"
        "lint"
        "type-check"
        "setup"
    )
    
    for script in "${required_scripts[@]}"; do
        if npm run | grep -q "$script"; then
            print_success "Script: $script"
        else
            print_error "Missing script: $script"
        fi
    done
}

# Check Docker services
check_docker_services() {
    print_info "Checking Docker services status..."
    
    if docker-compose ps >/dev/null 2>&1; then
        RUNNING_SERVICES=$(docker-compose ps --services --filter "status=running" | wc -l)
        TOTAL_SERVICES=$(docker-compose config --services | wc -l)
        
        if [[ $RUNNING_SERVICES -gt 0 ]]; then
            print_success "$RUNNING_SERVICES/$TOTAL_SERVICES Docker services are running"
        else
            print_warning "No Docker services are currently running"
        fi
    else
        print_warning "Docker Compose services are not initialized"
    fi
}

# Check ports availability
check_ports() {
    print_info "Checking port availability..."
    
    required_ports=(3000 3001 3002 5432 6379 8000 8001 9200 5601)
    
    for port in "${required_ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "Port $port is in use"
        else
            print_success "Port $port is available"
        fi
    done
}

# Check disk space
check_disk_space() {
    print_info "Checking disk space..."
    
    AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
    REQUIRED_SPACE=5242880  # 5GB in KB
    
    if [[ $AVAILABLE_SPACE -gt $REQUIRED_SPACE ]]; then
        SPACE_GB=$((AVAILABLE_SPACE / 1024 / 1024))
        print_success "Sufficient disk space: ${SPACE_GB}GB available"
    else
        SPACE_GB=$((AVAILABLE_SPACE / 1024 / 1024))
        print_warning "Low disk space: ${SPACE_GB}GB available (recommended: 5GB+)"
    fi
}

# Main validation function
main() {
    echo
    print_info "Starting comprehensive environment validation..."
    echo
    
    check_node
    check_npm
    check_docker
    check_docker_compose
    check_git
    echo
    
    check_project_structure
    check_required_files
    check_environment_variables
    check_package_scripts
    echo
    
    check_docker_services
    check_ports
    check_disk_space
    
    echo
    echo "=================================================="
    echo "🏁 Environment Validation Complete"
    echo
    
    if [[ $ERRORS -eq 0 ]]; then
        if [[ $WARNINGS -eq 0 ]]; then
            print_success "✨ Perfect! Your environment is fully ready for development."
        else
            print_warning "⚠️  Your environment is ready with $WARNINGS warnings."
            echo -e "${YELLOW}   Consider addressing the warnings for optimal experience.${NC}"
        fi
        echo
        print_info "Next steps:"
        echo "  1. Run 'npm run setup' to install dependencies"
        echo "  2. Run 'npm run dev' to start development environment"
        echo "  3. Visit http://localhost:3000 to see the application"
        exit 0
    else
        print_error "❌ Found $ERRORS errors and $WARNINGS warnings."
        echo -e "${RED}   Please fix the errors before proceeding.${NC}"
        echo
        print_info "Common fixes:"
        echo "  • Install Node.js 18+ from https://nodejs.org"
        echo "  • Install Docker from https://docker.com"
        echo "  • Run the setup from project root directory"
        exit 1
    fi
}

# Run main function
main "$@"