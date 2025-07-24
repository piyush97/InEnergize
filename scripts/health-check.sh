#!/bin/bash

# InErgize Health Check Script
# Comprehensive health monitoring for all services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TIMEOUT=10
RETRY_COUNT=3
RETRY_DELAY=2

# Service endpoints
declare -A SERVICES=(
    ["web-app"]="http://localhost:3000/api/health"
    ["auth-service"]="http://localhost:3001/health"
    ["user-service"]="http://localhost:3002/health"
    ["kong-admin"]="http://localhost:8001/"
    ["postgres"]="postgres://inergize_user:inergize_password@localhost:5432/inergize_dev"
    ["timescale"]="postgres://inergize_user:inergize_password@localhost:5433/inergize_analytics"
    ["redis"]="redis://localhost:6379"
    ["elasticsearch"]="http://localhost:9200/_cluster/health"
    ["kibana"]="http://localhost:5601/api/status"
)

# Function to print with colors
print_status() {
    local status=$1
    local service=$2
    local message=$3
    
    case $status in
        "healthy")
            echo -e "${GREEN}✓${NC} $service: $message"
            ;;
        "unhealthy")
            echo -e "${RED}✗${NC} $service: $message"
            ;;
        "warning")
            echo -e "${YELLOW}⚠${NC} $service: $message"
            ;;
        "info")
            echo -e "${BLUE}ℹ${NC} $service: $message"
            ;;
    esac
}

# Check HTTP endpoint
check_http_endpoint() {
    local url=$1
    local timeout=${2:-$TIMEOUT}
    
    if curl -s -f --max-time "$timeout" "$url" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check HTTP endpoint with JSON response
check_http_json() {
    local url=$1
    local timeout=${2:-$TIMEOUT}
    
    response=$(curl -s --max-time "$timeout" "$url" 2>/dev/null || echo "")
    if [[ -n "$response" ]] && echo "$response" | jq . >/dev/null 2>&1; then
        echo "$response"
        return 0
    else
        return 1
    fi
}

# Check PostgreSQL database
check_postgres() {
    local connection_string=$1
    local service_name=$2
    
    if command -v psql >/dev/null 2>&1; then
        if psql "$connection_string" -c "SELECT 1;" >/dev/null 2>&1; then
            print_status "healthy" "$service_name" "Database connection successful"
            return 0
        else
            print_status "unhealthy" "$service_name" "Database connection failed"
            return 1
        fi
    else
        # Try using docker exec if psql is not available
        if docker-compose exec -T postgres pg_isready -U inergize_user >/dev/null 2>&1; then
            print_status "healthy" "$service_name" "Database is ready (via Docker)"
            return 0
        else
            print_status "unhealthy" "$service_name" "Database is not ready"
            return 1
        fi
    fi
}

# Check Redis
check_redis() {
    local url=$1
    
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli ping >/dev/null 2>&1; then
            print_status "healthy" "redis" "Redis ping successful"
            return 0
        else
            print_status "unhealthy" "redis" "Redis ping failed"
            return 1
        fi
    else
        # Try using docker exec
        if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
            print_status "healthy" "redis" "Redis is ready (via Docker)"
            return 0
        else
            print_status "unhealthy" "redis" "Redis is not ready"
            return 1
        fi
    fi
}

# Check individual service
check_service() {
    local service=$1
    local endpoint=${SERVICES[$service]}
    local healthy=false
    
    case $service in
        "postgres")
            check_postgres "$endpoint" "$service" && healthy=true
            ;;
        "timescale")
            check_postgres "$endpoint" "$service" && healthy=true
            ;;
        "redis")
            check_redis "$endpoint" && healthy=true
            ;;
        "elasticsearch")
            if response=$(check_http_json "$endpoint"); then
                status=$(echo "$response" | jq -r '.status // "unknown"')
                if [[ "$status" == "green" || "$status" == "yellow" ]]; then
                    print_status "healthy" "$service" "Cluster status: $status"
                    healthy=true
                else
                    print_status "unhealthy" "$service" "Cluster status: $status"
                fi
            else
                print_status "unhealthy" "$service" "Connection failed"
            fi
            ;;
        "web-app"|"auth-service"|"user-service")
            if response=$(check_http_json "$endpoint"); then
                status=$(echo "$response" | jq -r '.status // "unknown"')
                if [[ "$status" == "healthy" || "$status" == "ok" ]]; then
                    uptime=$(echo "$response" | jq -r '.uptime // "unknown"')
                    print_status "healthy" "$service" "Status: $status, Uptime: ${uptime}s"
                    healthy=true
                else
                    print_status "unhealthy" "$service" "Status: $status"
                fi
            else
                print_status "unhealthy" "$service" "Health check failed"
            fi
            ;;
        *)
            if check_http_endpoint "$endpoint"; then
                print_status "healthy" "$service" "Service is responding"
                healthy=true
            else
                print_status "unhealthy" "$service" "Service is not responding"
            fi
            ;;
    esac
    
    return $([ "$healthy" = true ] && echo 0 || echo 1)
}

# Check service with retries
check_service_with_retry() {
    local service=$1
    local attempt=1
    
    while [[ $attempt -le $RETRY_COUNT ]]; do
        if check_service "$service"; then
            return 0
        fi
        
        if [[ $attempt -lt $RETRY_COUNT ]]; then
            print_status "warning" "$service" "Attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
        
        ((attempt++))
    done
    
    return 1
}

# Check Docker containers
check_docker_containers() {
    print_status "info" "docker" "Checking container status..."
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_status "warning" "docker" "docker-compose not found, skipping container check"
        return
    fi
    
    if ! docker-compose ps >/dev/null 2>&1; then
        print_status "warning" "docker" "No docker-compose setup found"
        return
    fi
    
    # Get container status
    containers=$(docker-compose ps --format "table {{.Name}}\t{{.State}}" | tail -n +2)
    
    if [[ -z "$containers" ]]; then
        print_status "warning" "docker" "No containers found"
        return
    fi
    
    echo "$containers" | while IFS=$'\t' read -r name state; do
        if [[ "$state" == "running" ]]; then
            print_status "healthy" "container/$name" "Running"
        else
            print_status "unhealthy" "container/$name" "State: $state"
        fi
    done
}

# Generate health report
generate_report() {
    local healthy_count=0
    local total_count=${#SERVICES[@]}
    local failed_services=()
    
    echo
    echo "🏥 Health Check Report"
    echo "===================="
    
    for service in "${!SERVICES[@]}"; do
        if check_service_with_retry "$service"; then
            ((healthy_count++))
        else
            failed_services+=("$service")
        fi
    done
    
    echo
    check_docker_containers
    
    echo
    echo "📊 Summary"
    echo "==========="
    echo "Healthy services: $healthy_count/$total_count"
    
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        print_status "healthy" "overall" "All services are healthy! 🎉"
        echo
        echo "🚀 System is ready for development!"
        echo "   • Web App: http://localhost:3000"
        echo "   • API Gateway: http://localhost:8000"
        echo "   • Kong Admin: http://localhost:8001"
        echo "   • Kibana: http://localhost:5601"
        return 0
    else
        print_status "unhealthy" "overall" "Some services are unhealthy"
        echo
        echo "Failed services:"
        for service in "${failed_services[@]}"; do
            echo "  • $service"
        done
        echo
        echo "💡 Troubleshooting:"
        echo "   • Run 'docker-compose up -d' to start services"
        echo "   • Check logs with 'docker-compose logs [service]'"
        echo "   • Ensure ports are not in use by other applications"
        return 1
    fi
}

# Watch mode
watch_mode() {
    echo "👀 Starting health check monitoring (press Ctrl+C to stop)..."
    echo
    
    while true; do
        clear
        echo "InErgize Health Monitor - $(date)"
        echo "================================"
        generate_report
        echo
        echo "Refreshing in 30 seconds..."
        sleep 30
    done
}

# Main function
main() {
    case "${1:-}" in
        "watch"|"-w"|"--watch")
            watch_mode
            ;;
        "quiet"|"-q"|"--quiet")
            # Quiet mode - just return exit code
            local healthy_count=0
            local total_count=${#SERVICES[@]}
            
            for service in "${!SERVICES[@]}"; do
                if check_service "$service" >/dev/null 2>&1; then
                    ((healthy_count++))
                fi
            done
            
            [[ $healthy_count -eq $total_count ]]
            ;;
        "help"|"-h"|"--help")
            echo "InErgize Health Check Script"
            echo
            echo "Usage: $0 [OPTIONS]"
            echo
            echo "Options:"
            echo "  (none)           Run health check once"
            echo "  watch, -w        Run continuous monitoring"
            echo "  quiet, -q        Quiet mode (exit code only)"
            echo "  help, -h         Show this help"
            echo
            ;;
        *)
            generate_report
            ;;
    esac
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n👋 Health check stopped."; exit 0' INT

# Run main function
main "$@"