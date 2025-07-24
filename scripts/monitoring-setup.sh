#!/bin/bash

# InErgize Monitoring & Logging Setup Script
# Comprehensive monitoring and alerting infrastructure setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
MONITORING_STACK="prometheus grafana alertmanager"
LOGGING_STACK="elasticsearch kibana filebeat"

# Function to print with colors
print_header() {
    echo -e "${PURPLE}🔧 $1${NC}"
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

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    local errors=0
    
    # Check Docker
    if command_exists docker; then
        if docker info >/dev/null 2>&1; then
            print_success "Docker is running"
        else
            print_error "Docker is not running"
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
        print_error "Docker Compose is not available"
        ((errors++))
    fi
    
    if [[ $errors -gt 0 ]]; then
        print_error "Prerequisites check failed"
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
    echo
}

# Setup Prometheus configuration
setup_prometheus() {
    print_header "Setting Up Prometheus Configuration"
    
    print_step "1" "Creating Prometheus data directory"
    mkdir -p data/prometheus
    chmod 777 data/prometheus
    print_success "Prometheus data directory created"
    
    print_step "2" "Validating Prometheus configuration"
    if docker run --rm -v "$(pwd)/infrastructure/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml" prom/prometheus:latest promtool check config /etc/prometheus/prometheus.yml >/dev/null 2>&1; then
        print_success "Prometheus configuration is valid"
    else
        print_error "Prometheus configuration validation failed"
        exit 1
    fi
    
    print_step "3" "Setting up Prometheus rules"
    mkdir -p infrastructure/monitoring/rules
    if [[ -f "infrastructure/monitoring/rules/application-alerts.yml" ]]; then
        print_success "Application alert rules already exist"
    else
        print_warning "Application alert rules not found"
    fi
    
    echo
}

# Setup Grafana configuration
setup_grafana() {
    print_header "Setting Up Grafana Configuration"
    
    print_step "1" "Creating Grafana data directory"
    mkdir -p data/grafana
    chmod 777 data/grafana
    print_success "Grafana data directory created"
    
    print_step "2" "Setting up Grafana provisioning"
    mkdir -p infrastructure/monitoring/grafana/provisioning/{datasources,dashboards}
    
    # Create datasource configuration
    cat > infrastructure/monitoring/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    database: "inergize-*"
    interval: Daily
    timeField: "@timestamp"
    version: 70
    editable: true
EOF
    
    # Create dashboard provisioning
    cat > infrastructure/monitoring/grafana/provisioning/dashboards/default.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF
    
    print_success "Grafana provisioning configured"
    echo
}

# Setup Elasticsearch configuration
setup_elasticsearch() {
    print_header "Setting Up Elasticsearch Configuration"
    
    print_step "1" "Creating Elasticsearch data directory"
    mkdir -p data/elasticsearch
    chmod 777 data/elasticsearch
    print_success "Elasticsearch data directory created"
    
    print_step "2" "Setting up index templates"
    mkdir -p infrastructure/logging/templates
    
    # Create index template for application logs
    cat > infrastructure/logging/templates/inergize-logs.json << 'EOF'
{
  "index_patterns": ["inergize-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.codec": "best_compression",
      "index.refresh_interval": "30s"
    },
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        },
        "level": {
          "type": "keyword"
        },
        "message": {
          "type": "text",
          "analyzer": "standard"
        },
        "service": {
          "type": "keyword"
        },
        "environment": {
          "type": "keyword"
        },
        "trace_id": {
          "type": "keyword"
        },
        "span_id": {
          "type": "keyword"
        },
        "user_id": {
          "type": "keyword"
        },
        "ip_address": {
          "type": "ip"
        },
        "response_time": {
          "type": "float"
        },
        "status_code": {
          "type": "integer"
        },
        "error": {
          "properties": {
            "type": {
              "type": "keyword"
            },
            "message": {
              "type": "text"
            },
            "stack": {
              "type": "text",
              "index": false
            }
          }
        }
      }
    }
  },
  "priority": 200,
  "version": 1
}
EOF
    
    print_success "Elasticsearch templates configured"
    echo
}

# Setup Alertmanager configuration
setup_alertmanager() {
    print_header "Setting Up Alertmanager Configuration"
    
    print_step "1" "Creating Alertmanager configuration"
    mkdir -p infrastructure/monitoring/alertmanager
    
    cat > infrastructure/monitoring/alertmanager/alertmanager.yml << 'EOF'
# Alertmanager configuration for InErgize Platform
global:
  smtp_smarthost: '${SMTP_HOST:localhost:587}'
  smtp_from: 'alerts@inergize.com'
  smtp_auth_username: '${SMTP_USERNAME}'
  smtp_auth_password: '${SMTP_PASSWORD}'

# Notification templates
templates:
  - '/etc/alertmanager/templates/*.tmpl'

# Route configuration
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 5s
      repeat_interval: 30m
    
    - match:
        category: security
      receiver: 'security-alerts'
      group_wait: 5s
      repeat_interval: 15m
    
    - match:
        category: business
      receiver: 'business-alerts'
      repeat_interval: 2h

# Notification receivers
receivers:
  - name: 'default'
    email_configs:
      - to: '${ALERT_EMAIL_DEFAULT:ops@inergize.com}'
        subject: 'InErgize Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Instance: {{ .Labels.instance }}
          Severity: {{ .Labels.severity }}
          {{ end }}

  - name: 'critical-alerts'
    email_configs:
      - to: '${ALERT_EMAIL_CRITICAL:critical@inergize.com}'
        subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        body: |
          CRITICAL ALERT DETECTED
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Instance: {{ .Labels.instance }}
          Runbook: {{ .Annotations.runbook_url }}
          {{ end }}
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: '🚨 Critical Alert: {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          {{ .Annotations.summary }}
          Instance: {{ .Labels.instance }}
          {{ end }}

  - name: 'security-alerts'
    email_configs:
      - to: '${ALERT_EMAIL_SECURITY:security@inergize.com}'
        subject: '🔒 Security Alert: {{ .GroupLabels.alertname }}'
        body: |
          SECURITY ALERT DETECTED
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Instance: {{ .Labels.instance }}
          {{ end }}

  - name: 'business-alerts'
    email_configs:
      - to: '${ALERT_EMAIL_BUSINESS:business@inergize.com}'
        subject: '📊 Business Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

# Inhibition rules
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
EOF
    
    print_step "2" "Creating alert notification templates"
    mkdir -p infrastructure/monitoring/alertmanager/templates
    
    cat > infrastructure/monitoring/alertmanager/templates/email.tmpl << 'EOF'
{{ define "email.inergize.subject" }}
[InErgize {{ .Status | toUpper }}] {{ .GroupLabels.alertname }}
{{ end }}

{{ define "email.inergize.html" }}
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .critical { background-color: #f8d7da; border: 1px solid #f5c6cb; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; }
        .info { background-color: #d1ecf1; border: 1px solid #bee5eb; }
    </style>
</head>
<body>
    <h2>InErgize Platform Alert</h2>
    
    {{ range .Alerts }}
    <div class="alert {{ .Labels.severity }}">
        <h3>{{ .Annotations.summary }}</h3>
        <p><strong>Description:</strong> {{ .Annotations.description }}</p>
        <p><strong>Instance:</strong> {{ .Labels.instance }}</p>
        <p><strong>Service:</strong> {{ .Labels.job }}</p>
        <p><strong>Severity:</strong> {{ .Labels.severity }}</p>
        <p><strong>Category:</strong> {{ .Labels.category }}</p>
        {{ if .Annotations.runbook_url }}
        <p><strong>Runbook:</strong> <a href="{{ .Annotations.runbook_url }}">{{ .Annotations.runbook_url }}</a></p>
        {{ end }}
        <p><strong>Started:</strong> {{ .StartsAt.Format "2006-01-02 15:04:05 UTC" }}</p>
    </div>
    {{ end }}
</body>
</html>
{{ end }}
EOF
    
    print_success "Alertmanager configuration created"
    echo
}

# Setup monitoring scripts
setup_monitoring_scripts() {
    print_header "Setting Up Monitoring Scripts"
    
    print_step "1" "Creating monitoring utility scripts"
    
    # Create metrics collection script
    cat > scripts/collect-metrics.sh << 'EOF'
#!/bin/bash

# InErgize Metrics Collection Script
# Collects custom business metrics and exports to Prometheus

METRICS_FILE="/tmp/inergize_metrics.prom"
DATABASE_URL="${DATABASE_URL:-postgresql://inergize_user:inergize_password@localhost:5432/inergize_dev}"

# Function to execute SQL and format as Prometheus metric
collect_metric() {
    local metric_name=$1
    local query=$2
    local help_text=$3
    
    result=$(psql "$DATABASE_URL" -t -c "$query" 2>/dev/null | tr -d ' ')
    
    if [[ -n "$result" && "$result" =~ ^[0-9]+$ ]]; then
        echo "# HELP $metric_name $help_text" >> "$METRICS_FILE"
        echo "# TYPE $metric_name gauge" >> "$METRICS_FILE"
        echo "$metric_name $result" >> "$METRICS_FILE"
    fi
}

# Initialize metrics file
echo "# InErgize Business Metrics" > "$METRICS_FILE"
echo "# Generated at $(date)" >> "$METRICS_FILE"

# Collect business metrics
collect_metric "inergize_total_users" \
    "SELECT COUNT(*) FROM \"User\";" \
    "Total number of registered users"

collect_metric "inergize_active_users_today" \
    "SELECT COUNT(DISTINCT \"userId\") FROM \"Session\" WHERE \"expires\" > NOW() AND \"createdAt\" > NOW() - INTERVAL '1 day';" \
    "Active users in the last 24 hours"

collect_metric "inergize_linkedin_profiles_connected" \
    "SELECT COUNT(*) FROM \"LinkedinProfile\" WHERE \"isActive\" = true;" \
    "Number of connected LinkedIn profiles"

collect_metric "inergize_content_items_created_today" \
    "SELECT COUNT(*) FROM \"ContentItem\" WHERE \"createdAt\" > NOW() - INTERVAL '1 day';" \
    "Content items created today"

collect_metric "inergize_automation_rules_active" \
    "SELECT COUNT(*) FROM \"AutomationRule\" WHERE \"isActive\" = true;" \
    "Active automation rules"

collect_metric "inergize_failed_automations_today" \
    "SELECT COUNT(*) FROM \"EngagementActivity\" WHERE \"status\" = 'FAILED' AND \"createdAt\" > NOW() - INTERVAL '1 day';" \
    "Failed automation activities today"

echo "Metrics collected to $METRICS_FILE"
EOF
    
    chmod +x scripts/collect-metrics.sh
    
    # Create log analysis script
    cat > scripts/analyze-logs.sh << 'EOF'
#!/bin/bash

# InErgize Log Analysis Script
# Analyzes application logs and generates insights

ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
DATE_FROM="${1:-now-1h}"
DATE_TO="${2:-now}"

# Function to query Elasticsearch
query_es() {
    local query=$1
    curl -s -X GET "$ELASTICSEARCH_URL/inergize-*/_search" \
        -H 'Content-Type: application/json' \
        -d "$query" | jq -r '.hits.total.value // 0'
}

echo "InErgize Log Analysis Report"
echo "============================"
echo "Period: $DATE_FROM to $DATE_TO"
echo

# Error rate analysis
error_count=$(query_es '{
    "query": {
        "bool": {
            "must": [
                {"range": {"@timestamp": {"gte": "'$DATE_FROM'", "lte": "'$DATE_TO'"}}},
                {"term": {"level": "error"}}
            ]
        }
    }
}')

total_logs=$(query_es '{
    "query": {
        "range": {"@timestamp": {"gte": "'$DATE_FROM'", "lte": "'$DATE_TO'"}}
    }
}')

echo "📊 Error Analysis:"
echo "  Total logs: $total_logs"
echo "  Error logs: $error_count"
if [[ $total_logs -gt 0 ]]; then
    error_rate=$(echo "scale=2; $error_count * 100 / $total_logs" | bc)
    echo "  Error rate: $error_rate%"
fi
echo

# Service health
echo "🏥 Service Health:"
for service in auth-service user-service web-app; do
    service_errors=$(query_es '{
        "query": {
            "bool": {
                "must": [
                    {"range": {"@timestamp": {"gte": "'$DATE_FROM'", "lte": "'$DATE_TO'"}}},
                    {"term": {"service": "'$service'"}},
                    {"term": {"level": "error"}}
                ]
            }
        }
    }')
    echo "  $service: $service_errors errors"
done
echo

echo "Report generated at $(date)"
EOF
    
    chmod +x scripts/analyze-logs.sh
    
    print_success "Monitoring utility scripts created"
    echo
}

# Start monitoring stack
start_monitoring_stack() {
    print_header "Starting Monitoring Stack"
    
    print_step "1" "Starting infrastructure services"
    docker-compose up -d postgres redis elasticsearch
    
    print_step "2" "Waiting for Elasticsearch to be ready"
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s http://localhost:9200/_cluster/health >/dev/null 2>&1; then
            break
        fi
        print_info "Waiting for Elasticsearch... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        print_error "Elasticsearch failed to start within timeout"
        exit 1
    fi
    
    print_step "3" "Starting monitoring services"
    docker-compose up -d prometheus grafana alertmanager
    
    print_step "4" "Starting logging services"
    docker-compose up -d kibana filebeat
    
    print_success "All monitoring services started"
    echo
}

# Verify installation
verify_installation() {
    print_header "Verifying Installation"
    
    local services=(
        "Prometheus:http://localhost:9090/-/ready:Prometheus is ready"
        "Grafana:http://localhost:3001/api/health:Grafana is healthy"
        "Alertmanager:http://localhost:9093/-/ready:Alertmanager is ready"
        "Elasticsearch:http://localhost:9200/_cluster/health:Elasticsearch cluster is healthy"
        "Kibana:http://localhost:5601/api/status:Kibana is ready"
    )
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r name url expected <<< "$service_info"
        
        if curl -s --max-time 10 "$url" >/dev/null 2>&1; then
            print_success "$name is running"
        else
            print_warning "$name is not responding (may still be starting)"
        fi
    done
    
    echo
}

# Generate summary
generate_summary() {
    print_header "Setup Complete! 📊"
    
    echo -e "${GREEN}✨ InErgize monitoring and logging infrastructure is ready!${NC}"
    echo
    echo "📍 Monitoring Services:"
    echo "  • Prometheus:     http://localhost:9090"
    echo "  • Grafana:        http://localhost:3001 (admin/admin)"
    echo "  • Alertmanager:   http://localhost:9093"
    echo
    echo "📍 Logging Services:"
    echo "  • Elasticsearch:  http://localhost:9200"
    echo "  • Kibana:         http://localhost:5601"
    echo
    echo "🔧 Utility Scripts:"
    echo "  • Collect metrics: ./scripts/collect-metrics.sh"
    echo "  • Analyze logs:    ./scripts/analyze-logs.sh [date-from] [date-to]"
    echo "  • Health check:    ./scripts/health-check.sh"
    echo
    echo "📚 Configuration Files:"
    echo "  • Prometheus:      infrastructure/monitoring/prometheus.yml"
    echo "  • Grafana:         infrastructure/monitoring/grafana/"
    echo "  • Alertmanager:    infrastructure/monitoring/alertmanager/"
    echo "  • Filebeat:        infrastructure/logging/filebeat.yml"
    echo
    echo "💡 Next Steps:"
    echo "  1. Import Grafana dashboards"
    echo "  2. Configure alert notification channels"
    echo "  3. Set up custom business metrics"
    echo "  4. Review and customize alert rules"
    echo
    print_success "Happy monitoring! 📈"
}

# Error handler
handle_error() {
    print_error "Setup failed at line $1"
    echo
    print_info "Troubleshooting:"
    echo "  • Check Docker is running and has sufficient resources"
    echo "  • Ensure ports 9090, 3001, 9093, 9200, 5601 are available"
    echo "  • Review docker-compose logs for detailed error messages"
    exit 1
}

# Set up error handling
trap 'handle_error $LINENO' ERR

# Main setup function
main() {
    clear
    echo -e "${PURPLE}"
    echo "📊 InErgize Monitoring & Logging Setup"
    echo "====================================="
    echo -e "${NC}"
    echo
    
    # Check if user wants to continue
    if [[ "${1:-}" != "--yes" && "${1:-}" != "-y" ]]; then
        echo "This script will set up comprehensive monitoring and logging infrastructure."
        echo "This includes Prometheus, Grafana, Alertmanager, Elasticsearch, and Kibana."
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
    check_prerequisites
    setup_prometheus
    setup_grafana
    setup_elasticsearch
    setup_alertmanager
    setup_monitoring_scripts
    start_monitoring_stack
    verify_installation
    generate_summary
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "InErgize Monitoring & Logging Setup"
        echo
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --yes, -y      Skip confirmation prompt"
        echo "  --help, -h     Show this help"
        echo
        echo "This script will:"
        echo "  • Set up Prometheus for metrics collection"
        echo "  • Configure Grafana for visualization"
        echo "  • Set up Alertmanager for notifications"
        echo "  • Configure Elasticsearch for log storage"
        echo "  • Set up Kibana for log analysis"
        echo "  • Create monitoring utility scripts"
        echo
        ;;
    *)
        main "$@"
        ;;
esac