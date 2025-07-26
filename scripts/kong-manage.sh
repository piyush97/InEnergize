#!/bin/bash

# Kong Management Script for InErgize Platform
# Health checks, monitoring, and operational commands

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KONG_ADMIN_URL="http://localhost:8001"
KONG_PROXY_URL="http://localhost:8000"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Kong is running
check_kong_status() {
    if curl -f -s "$KONG_ADMIN_URL/status" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Health check function
health_check() {
    log_info "Performing Kong health check..."
    
    # Check Kong admin API
    if ! check_kong_status; then
        log_error "Kong admin API is not accessible at $KONG_ADMIN_URL"
        return 1
    fi
    
    # Get Kong status
    local status_response
    status_response=$(curl -s "$KONG_ADMIN_URL/status")
    
    if echo "$status_response" | jq -e '.database.reachable' > /dev/null 2>&1; then
        if [[ $(echo "$status_response" | jq -r '.database.reachable') == "true" ]]; then
            log_success "Kong database is reachable"
        else
            log_warning "Kong database is not reachable (DB-less mode expected)"
        fi
    fi
    
    # Check proxy
    if curl -f -s -o /dev/null "$KONG_PROXY_URL"; then
        log_success "Kong proxy is responsive"
    else
        log_warning "Kong proxy is not responding (might be expected with no default route)"
    fi
    
    # Check services health
    check_services_health
    
    # Check upstreams health
    check_upstreams_health
    
    log_success "Health check completed"
}

# Check individual services health
check_services_health() {
    log_info "Checking services health..."
    
    local services
    services=$(curl -s "$KONG_ADMIN_URL/services" | jq -r '.data[].name' 2>/dev/null || echo "")
    
    if [[ -z "$services" ]]; then
        log_warning "No services found or unable to retrieve services"
        return
    fi
    
    while IFS= read -r service; do
        if [[ -n "$service" ]]; then
            local service_info
            service_info=$(curl -s "$KONG_ADMIN_URL/services/$service")
            local host port
            host=$(echo "$service_info" | jq -r '.host' 2>/dev/null || echo "unknown")
            port=$(echo "$service_info" | jq -r '.port' 2>/dev/null || echo "unknown")
            
            if [[ "$host" != "unknown" && "$port" != "unknown" ]]; then
                echo "  📊 Service: $service ($host:$port)"
            else
                echo "  ❓ Service: $service (configuration unknown)"
            fi
        fi
    done <<< "$services"
}

# Check upstreams health
check_upstreams_health() {
    log_info "Checking upstreams health..."
    
    local upstreams
    upstreams=$(curl -s "$KONG_ADMIN_URL/upstreams" | jq -r '.data[].name' 2>/dev/null || echo "")
    
    if [[ -z "$upstreams" ]]; then
        log_warning "No upstreams found or unable to retrieve upstreams"
        return
    fi
    
    while IFS= read -r upstream; do
        if [[ -n "$upstream" ]]; then
            local health_info
            health_info=$(curl -s "$KONG_ADMIN_URL/upstreams/$upstream/health")
            
            if [[ -n "$health_info" ]]; then
                local healthy_targets unhealthy_targets
                healthy_targets=$(echo "$health_info" | jq -r '.data[] | select(.health == "HEALTHY") | .target' 2>/dev/null | wc -l)
                unhealthy_targets=$(echo "$health_info" | jq -r '.data[] | select(.health == "UNHEALTHY") | .target' 2>/dev/null | wc -l)
                
                if [[ "$unhealthy_targets" -gt 0 ]]; then
                    echo "  ⚠️  Upstream: $upstream (Healthy: $healthy_targets, Unhealthy: $unhealthy_targets)"
                else
                    echo "  ✅ Upstream: $upstream (Healthy: $healthy_targets)"
                fi
            else
                echo "  ❓ Upstream: $upstream (health status unknown)"
            fi
        fi
    done <<< "$upstreams"
}

# Display Kong configuration
show_config() {
    log_info "Kong Configuration Summary:"
    
    if ! check_kong_status; then
        log_error "Kong is not running"
        return 1
    fi
    
    # Kong info
    local kong_info
    kong_info=$(curl -s "$KONG_ADMIN_URL/")
    echo
    echo "🔧 Kong Version: $(echo "$kong_info" | jq -r '.version' 2>/dev/null || echo "unknown")"
    echo "🏷️  Node ID: $(echo "$kong_info" | jq -r '.node_id' 2>/dev/null || echo "unknown")"
    echo
    
    # Services count
    local services_count
    services_count=$(curl -s "$KONG_ADMIN_URL/services" | jq -r '.data | length' 2>/dev/null || echo "0")
    echo "📊 Services: $services_count"
    
    # Routes count
    local routes_count
    routes_count=$(curl -s "$KONG_ADMIN_URL/routes" | jq -r '.data | length' 2>/dev/null || echo "0")
    echo "🛣️  Routes: $routes_count"
    
    # Consumers count
    local consumers_count
    consumers_count=$(curl -s "$KONG_ADMIN_URL/consumers" | jq -r '.data | length' 2>/dev/null || echo "0")
    echo "👥 Consumers: $consumers_count"
    
    # Plugins count
    local plugins_count
    plugins_count=$(curl -s "$KONG_ADMIN_URL/plugins" | jq -r '.data | length' 2>/dev/null || echo "0")
    echo "🔌 Plugins: $plugins_count"
    
    # Upstreams count
    local upstreams_count
    upstreams_count=$(curl -s "$KONG_ADMIN_URL/upstreams" | jq -r '.data | length' 2>/dev/null || echo "0")
    echo "⬆️  Upstreams: $upstreams_count"
}

# Show detailed status
detailed_status() {
    log_info "Detailed Kong Status:"
    
    if ! check_kong_status; then
        log_error "Kong is not running"
        return 1
    fi
    
    # Kong status
    echo
    echo "📊 Kong Status:"
    curl -s "$KONG_ADMIN_URL/status" | jq '.' 2>/dev/null || curl -s "$KONG_ADMIN_URL/status"
    
    # Services
    echo
    echo "🔧 Services:"
    curl -s "$KONG_ADMIN_URL/services" | jq -r '.data[] | "  • \(.name): \(.protocol)://\(.host):\(.port)"' 2>/dev/null || echo "  Unable to retrieve services"
    
    # Routes
    echo
    echo "🛣️  Routes:"
    curl -s "$KONG_ADMIN_URL/routes" | jq -r '.data[] | "  • \(.name): \(.methods // [\"ALL\"]) \(.paths // []))"' 2>/dev/null || echo "  Unable to retrieve routes"
    
    # Active plugins
    echo
    echo "🔌 Active Plugins:"
    curl -s "$KONG_ADMIN_URL/plugins" | jq -r '.data[] | "  • \(.name): \(.service.name // "global")"' 2>/dev/null || echo "  Unable to retrieve plugins"
}

# Reload Kong configuration
reload_config() {
    log_info "Reloading Kong configuration..."
    
    if ! check_kong_status; then
        log_error "Kong is not running"
        return 1
    fi
    
    # Send reload signal to Kong
    local reload_response
    reload_response=$(curl -s -X POST "$KONG_ADMIN_URL/config" -H "Content-Type: application/json" -d '{"config": "reload"}')
    
    if echo "$reload_response" | jq -e '.message' > /dev/null 2>&1; then
        log_success "Kong configuration reloaded successfully"
        log_info "$(echo "$reload_response" | jq -r '.message')"
    else
        log_warning "Configuration reload response unclear. Check Kong logs."
    fi
}

# Test Kong endpoints
test_endpoints() {
    log_info "Testing Kong endpoints..."
    
    if ! check_kong_status; then
        log_error "Kong is not running"
        return 1
    fi
    
    # Test admin API endpoints
    echo
    echo "🔧 Admin API Tests:"
    
    local endpoints=("/status" "/services" "/routes" "/consumers" "/plugins" "/upstreams")
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$KONG_ADMIN_URL$endpoint" > /dev/null; then
            echo "  ✅ $endpoint - OK"
        else
            echo "  ❌ $endpoint - FAILED"
        fi
    done
    
    # Test proxy with health endpoints if services are available
    echo
    echo "🌐 Proxy Tests:"
    
    local test_paths=("/api/v1/auth/health" "/api/v1/users/health" "/api/v1/linkedin/health" "/api/v1/analytics/health")
    
    for path in "${test_paths[@]}"; do
        local response_code
        response_code=$(curl -s -o /dev/null -w "%{http_code}" "$KONG_PROXY_URL$path" 2>/dev/null || echo "000")
        
        case "$response_code" in
            200)
                echo "  ✅ $path - OK (200)"
                ;;
            404)
                echo "  ⚠️  $path - Service not found (404)"
                ;;
            000)
                echo "  ❌ $path - Connection failed"
                ;;
            *)
                echo "  ❓ $path - Status: $response_code"
                ;;
        esac
    done
}

# Monitor Kong metrics
monitor_metrics() {
    log_info "Kong Metrics (last 60 seconds)..."
    
    if ! check_kong_status; then
        log_error "Kong is not running"
        return 1
    fi
    
    # Note: This is a simplified metrics display
    # In production, you would integrate with Prometheus/Grafana
    
    echo
    echo "📊 Basic Kong Information:"
    curl -s "$KONG_ADMIN_URL/status" | jq '{
        server: .server,
        connections: .connections_active,
        total_requests: .connections_handled
    }' 2>/dev/null || echo "Unable to retrieve metrics"
    
    echo
    log_info "For detailed metrics, configure Prometheus plugin and use Grafana dashboards"
}

# View Kong logs
view_logs() {
    local lines=${1:-50}
    log_info "Kong logs (last $lines lines):"
    
    if docker ps | grep -q "inergize-kong"; then
        docker logs --tail "$lines" inergize-kong
    else
        log_error "Kong container (inergize-kong) is not running"
        return 1
    fi
}

# Restart Kong
restart_kong() {
    log_info "Restarting Kong..."
    
    cd "$PROJECT_ROOT"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose restart kong
    else
        docker compose restart kong
    fi
    
    # Wait for Kong to be ready
    log_info "Waiting for Kong to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if check_kong_status; then
            log_success "Kong restarted successfully!"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            log_error "Kong failed to restart within expected time"
            return 1
        fi
        
        sleep 2
    done
}

# LinkedIn compliance check
linkedin_compliance_check() {
    log_info "LinkedIn Compliance Check..."
    
    if ! check_kong_status; then
        log_error "Kong is not running"
        return 1
    fi
    
    echo
    echo "🔍 LinkedIn Service Rate Limiting:"
    
    # Check LinkedIn service rate limiting configuration
    local linkedin_plugins
    linkedin_plugins=$(curl -s "$KONG_ADMIN_URL/services/linkedin-service/plugins" 2>/dev/null)
    
    if echo "$linkedin_plugins" | jq -e '.data[] | select(.name == "rate-limiting")' > /dev/null 2>&1; then
        local rate_config
        rate_config=$(echo "$linkedin_plugins" | jq -r '.data[] | select(.name == "rate-limiting") | .config')
        
        echo "  ✅ Rate limiting enabled"
        echo "  📊 Configuration:"
        echo "$rate_config" | jq '{
            minute: .minute,
            hour: .hour,
            day: .day,
            policy: .policy
        }' 2>/dev/null || echo "  Unable to parse rate limiting config"
    else
        echo "  ⚠️  Rate limiting not found for LinkedIn service"
    fi
    
    echo
    echo "🛡️  LinkedIn Service Health:"
    check_upstreams_health | grep -i linkedin || echo "  No LinkedIn upstream health information available"
    
    echo
    echo "📋 LinkedIn Compliance Recommendations:"
    echo "  • Rate limiting should be conservative (≤10/min, ≤200/hour, ≤2000/day)"
    echo "  • Monitor for 429 responses from LinkedIn API"
    echo "  • Implement circuit breakers for API protection"
    echo "  • Log all LinkedIn API interactions for compliance"
}

# Show help
show_help() {
    echo "Kong Management Script for InErgize Platform"
    echo
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  health              Perform comprehensive health check"
    echo "  status              Show Kong status and configuration summary"
    echo "  detailed            Show detailed Kong status"
    echo "  test                Test all Kong endpoints"
    echo "  metrics             Show Kong metrics"
    echo "  logs [LINES]        View Kong logs (default: 50 lines)"
    echo "  reload              Reload Kong configuration"
    echo "  restart             Restart Kong container"
    echo "  linkedin            LinkedIn compliance check"
    echo "  help, --help, -h    Show this help message"
    echo
    echo "Examples:"
    echo "  $0 health           # Full health check"
    echo "  $0 status           # Quick status overview"
    echo "  $0 logs 100         # View last 100 log lines"
    echo "  $0 test             # Test all endpoints"
    echo "  $0 linkedin         # LinkedIn compliance check"
}

# Main function
main() {
    local command=${1:-help}
    
    case "$command" in
        health)
            health_check
            ;;
        status)
            show_config
            ;;
        detailed)
            detailed_status
            ;;
        test)
            test_endpoints
            ;;
        metrics)
            monitor_metrics
            ;;
        logs)
            view_logs "${2:-50}"
            ;;
        reload)
            reload_config
            ;;
        restart)
            restart_kong
            ;;
        linkedin)
            linkedin_compliance_check
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"