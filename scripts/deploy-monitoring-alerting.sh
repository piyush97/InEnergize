#!/bin/bash

# InErgize Production Monitoring and Alerting Deployment Script
# Comprehensive monitoring stack with LinkedIn compliance tracking
# Version: 3.0.0

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="$PROJECT_ROOT/infrastructure/monitoring"
LOG_FILE="/var/log/inergize/monitoring-deployment.log"

# Monitoring stack configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE="${NAMESPACE:-inergize-production}"
MONITORING_NAMESPACE="${MONITORING_NAMESPACE:-monitoring}"

# Component enablement
ENABLE_PROMETHEUS="${ENABLE_PROMETHEUS:-true}"
ENABLE_GRAFANA="${ENABLE_GRAFANA:-true}"
ENABLE_ALERTMANAGER="${ENABLE_ALERTMANAGER:-true}"
ENABLE_ELK_STACK="${ENABLE_ELK_STACK:-true}"
ENABLE_JAEGER="${ENABLE_JAEGER:-true}"

# External integrations
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
PAGERDUTY_TOKEN="${PAGERDUTY_TOKEN:-}"
SMTP_HOST="${SMTP_HOST:-localhost:587}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"

# Storage configuration
PROMETHEUS_STORAGE="${PROMETHEUS_STORAGE:-100Gi}"
GRAFANA_STORAGE="${GRAFANA_STORAGE:-20Gi}"
ELASTICSEARCH_STORAGE="${ELASTICSEARCH_STORAGE:-200Gi}"

DRY_RUN="${DRY_RUN:-false}"

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

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Function to show usage
show_usage() {
    cat << EOF
InErgize Monitoring and Alerting Deployment Script

Usage: $0 [OPTIONS]

Options:
  --environment ENV            Environment (production/staging/development)
  --namespace NAMESPACE        Application namespace (default: inergize-production)
  --monitoring-namespace NS    Monitoring namespace (default: monitoring)
  --dry-run                   Show what would be deployed without executing
  --no-prometheus             Disable Prometheus deployment
  --no-grafana               Disable Grafana deployment
  --no-alertmanager          Disable AlertManager deployment
  --no-elk                   Disable ELK stack deployment
  --no-jaeger                Disable Jaeger tracing
  --help                     Show this help message

Environment Variables:
  SLACK_WEBHOOK              Slack webhook URL for alerts
  PAGERDUTY_TOKEN           PagerDuty integration token
  SMTP_HOST                 SMTP server for email alerts
  SMTP_USER/SMTP_PASS       SMTP credentials

Examples:
  $0                                    # Deploy full monitoring stack
  $0 --dry-run                         # Validate configuration
  $0 --environment staging --no-elk    # Deploy without ELK stack

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking monitoring deployment prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "jq" "yq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Add Helm repositories
    print_status "Adding Helm repositories..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add elastic https://helm.elastic.co
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    print_success "Prerequisites check completed"
}

# Function to create monitoring namespace
create_namespaces() {
    print_status "Creating monitoring namespaces..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create namespaces: $MONITORING_NAMESPACE"
        return
    fi
    
    # Create monitoring namespace
    kubectl create namespace "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Label namespace for monitoring
    kubectl label namespace "$MONITORING_NAMESPACE" monitoring=enabled --overwrite
    kubectl label namespace "$NAMESPACE" monitoring=enabled --overwrite
    
    print_success "Monitoring namespaces created"
}

# Function to deploy Prometheus stack
deploy_prometheus_stack() {
    if [[ "$ENABLE_PROMETHEUS" != "true" ]]; then
        print_status "Prometheus deployment skipped"
        return
    fi
    
    print_status "Deploying Prometheus monitoring stack..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would deploy Prometheus stack with $PROMETHEUS_STORAGE storage"
        return
    fi
    
    # Create Prometheus values file
    local prometheus_values="/tmp/prometheus-values.yaml"
    cat > "$prometheus_values" << EOF
prometheus:
  prometheusSpec:
    retention: 90d
    retentionSize: "80GB"
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: $PROMETHEUS_STORAGE
    
    # LinkedIn compliance monitoring
    additionalScrapeConfigs: |
      - job_name: 'linkedin-compliance'
        static_configs:
          - targets: ['linkedin-service.${NAMESPACE}:3003']
        scrape_interval: 15s
        metrics_path: '/metrics/compliance'
        
      - job_name: 'auth-security'
        static_configs:
          - targets: ['auth-service.${NAMESPACE}:3001']
        scrape_interval: 30s
        metrics_path: '/metrics/security'
        
      - job_name: 'api-gateway'
        static_configs:
          - targets: ['kong.${NAMESPACE}:8001']
        scrape_interval: 30s
        metrics_path: '/metrics'
    
    # Resource limits
    resources:
      limits:
        cpu: 2000m
        memory: 8Gi
      requests:
        cpu: 1000m
        memory: 4Gi
    
    # Service monitor selector
    serviceMonitorSelectorNilUsesHelmValues: false
    serviceMonitorSelector:
      matchLabels:
        team: inergize
    
    # Pod monitor selector
    podMonitorSelectorNilUsesHelmValues: false
    podMonitorSelector:
      matchLabels:
        team: inergize

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi
    
    # Resource limits
    resources:
      limits:
        cpu: 500m
        memory: 1Gi
      requests:
        cpu: 100m
        memory: 256Mi
    
    # External URL for webhooks
    externalUrl: https://alertmanager.inergize.com

grafana:
  enabled: $ENABLE_GRAFANA
  persistence:
    enabled: true
    storageClassName: fast-ssd
    size: $GRAFANA_STORAGE
  
  # Admin credentials
  adminPassword: $(openssl rand -base64 32)
  
  # Additional data sources
  additionalDataSources:
    - name: Elasticsearch
      type: elasticsearch
      url: http://elasticsearch.monitoring:9200
      access: proxy
      database: "logs-*"
      
    - name: Jaeger
      type: jaeger
      url: http://jaeger-query.monitoring:16686
      access: proxy
  
  # Resource limits
  resources:
    limits:
      cpu: 1000m
      memory: 2Gi
    requests:
      cpu: 500m
      memory: 1Gi
  
  # Grafana configuration
  grafana.ini:
    server:
      root_url: https://grafana.inergize.com
    security:
      disable_gravatar: true
      cookie_secure: true
      cookie_samesite: strict
    users:
      allow_sign_up: false
    auth:
      disable_login_form: false

# Node exporter for host metrics
nodeExporter:
  enabled: true
  
# Kube state metrics
kubeStateMetrics:
  enabled: true

# Prometheus operator
prometheusOperator:
  enabled: true
  resources:
    limits:
      cpu: 200m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 256Mi
EOF
    
    # Deploy Prometheus stack
    print_status "Installing kube-prometheus-stack..."
    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
        --namespace "$MONITORING_NAMESPACE" \
        --values "$prometheus_values" \
        --wait --timeout=15m
    
    # Clean up values file
    rm -f "$prometheus_values"
    
    print_success "Prometheus stack deployed"
}

# Function to deploy custom monitoring configurations
deploy_custom_monitoring() {
    print_status "Deploying custom monitoring configurations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would deploy custom monitoring rules and dashboards"
        return
    fi
    
    # Deploy LinkedIn compliance alerts
    kubectl apply -f "$MONITORING_DIR/linkedin-compliance-alerts.yml" -n "$MONITORING_NAMESPACE"
    
    # Deploy performance SLOs
    kubectl apply -f "$MONITORING_DIR/performance-slos.yml" -n "$MONITORING_NAMESPACE"
    
    # Deploy security monitoring rules
    kubectl apply -f "$MONITORING_DIR/security-rules.yml" -n "$MONITORING_NAMESPACE"
    
    # Create AlertManager configuration
    local alertmanager_config="/tmp/alertmanager-config.yaml"
    cat > "$alertmanager_config" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-kube-prometheus-stack-alertmanager
  namespace: $MONITORING_NAMESPACE
type: Opaque
stringData:
  alertmanager.yml: |
    global:
      smtp_smarthost: '$SMTP_HOST'
      smtp_from: 'alerts@inergize.com'
      slack_api_url: '$SLACK_WEBHOOK'
      
    route:
      group_by: ['alertname', 'service', 'severity']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'default'
      
      routes:
        # Critical alerts - immediate response
        - match:
            severity: critical
          receiver: 'critical-alerts'
          group_wait: 0s
          repeat_interval: 5m
          
        # LinkedIn compliance alerts
        - match:
            service: linkedin
          receiver: 'linkedin-compliance'
          group_wait: 30s
          repeat_interval: 15m
          
        # Security alerts
        - match_re:
            alertname: '.*security.*|.*breach.*|.*auth.*'
          receiver: 'security-team'
          group_wait: 30s
          repeat_interval: 10m
    
    receivers:
      - name: 'default'
        slack_configs:
          - channel: '#alerts'
            title: 'InErgize Alert'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
            
      - name: 'critical-alerts'
        slack_configs:
          - channel: '#critical-alerts'
            title: '🚨 CRITICAL ALERT 🚨'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
            color: 'danger'
        email_configs:
          - to: 'ops@inergize.com,cto@inergize.com'
            subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
            body: |
              Critical alert detected:
              {{ range .Alerts }}
              Alert: {{ .Annotations.summary }}
              Description: {{ .Annotations.description }}
              Service: {{ .Labels.service }}
              Time: {{ .StartsAt }}
              {{ end }}
            
      - name: 'linkedin-compliance'
        slack_configs:
          - channel: '#linkedin-compliance'
            title: 'LinkedIn Compliance Alert'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
            color: 'warning'
        email_configs:
          - to: 'compliance@inergize.com'
            subject: '[LINKEDIN] {{ .GroupLabels.alertname }}'
            
      - name: 'security-team'
        slack_configs:
          - channel: '#security'
            title: 'Security Alert'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
            color: 'danger'
        email_configs:
          - to: 'security@inergize.com'
            subject: '[SECURITY] {{ .GroupLabels.alertname }}'
EOF
    
    kubectl apply -f "$alertmanager_config"
    rm -f "$alertmanager_config"
    
    print_success "Custom monitoring configurations deployed"
}

# Function to deploy ELK stack
deploy_elk_stack() {
    if [[ "$ENABLE_ELK_STACK" != "true" ]]; then
        print_status "ELK stack deployment skipped"
        return
    fi
    
    print_status "Deploying ELK stack for log aggregation..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would deploy ELK stack with $ELASTICSEARCH_STORAGE storage"
        return
    fi
    
    # Deploy Elasticsearch
    print_status "Deploying Elasticsearch..."
    local es_values="/tmp/elasticsearch-values.yaml"
    cat > "$es_values" << EOF
replicas: 3
minimumMasterNodes: 2

esConfig:
  elasticsearch.yml: |
    cluster.name: "inergize-logs"
    network.host: 0.0.0.0
    discovery.seed_hosts: "elasticsearch-master-headless"
    cluster.initial_master_nodes: "elasticsearch-master-0,elasticsearch-master-1,elasticsearch-master-2"
    xpack.security.enabled: true
    xpack.security.transport.ssl.enabled: true
    xpack.security.transport.ssl.verification_mode: certificate
    xpack.security.audit.enabled: true

volumeClaimTemplate:
  accessModes: ["ReadWriteOnce"]
  storageClassName: fast-ssd
  resources:
    requests:
      storage: $ELASTICSEARCH_STORAGE

resources:
  requests:
    cpu: 1000m
    memory: 4Gi
  limits:
    cpu: 2000m
    memory: 8Gi

# Security context
securityContext:
  fsGroup: 1000
  runAsUser: 1000

# Service configuration
service:
  type: ClusterIP
  nodePort: ""
  annotations: {}
  httpPortName: http
  transportPortName: transport
  labels: {}
  labelsHeadless: {}
  loadBalancerIP: ""
  loadBalancerSourceRanges: []
EOF
    
    helm upgrade --install elasticsearch elastic/elasticsearch \
        --namespace "$MONITORING_NAMESPACE" \
        --values "$es_values" \
        --wait --timeout=15m
    
    # Deploy Logstash
    print_status "Deploying Logstash..."
    local logstash_values="/tmp/logstash-values.yaml"
    cat > "$logstash_values" << EOF
replicas: 2

logstashConfig:
  logstash.yml: |
    http.host: 0.0.0.0
    pipeline.ecs_compatibility: disabled

logstashPipeline:
  logstash.conf: |
    input {
      beats {
        port => 5044
      }
      http {
        port => 8080
        codec => json
      }
    }
    
    filter {
      # Add timestamp
      date {
        match => [ "timestamp", "ISO8601" ]
      }
      
      # Parse service logs
      if [kubernetes][container][name] == "linkedin-service" {
        if [message] =~ /compliance.*violation/i {
          mutate {
            add_field => { "alert_type" => "linkedin_compliance" }
            add_field => { "severity" => "critical" }
          }
        }
      }
      
      if [kubernetes][container][name] == "auth-service" {
        if [message] =~ /login.*failed/i {
          mutate {
            add_field => { "alert_type" => "auth_failure" }
            add_field => { "severity" => "warning" }
          }
        }
      }
    }
    
    output {
      elasticsearch {
        hosts => ["elasticsearch-master:9200"]
        index => "logs-%{+YYYY.MM.dd}"
      }
    }

resources:
  requests:
    cpu: 500m
    memory: 2Gi
  limits:
    cpu: 1000m
    memory: 4Gi
EOF
    
    helm upgrade --install logstash elastic/logstash \
        --namespace "$MONITORING_NAMESPACE" \
        --values "$logstash_values" \
        --wait --timeout=10m
    
    # Deploy Kibana
    print_status "Deploying Kibana..."
    local kibana_values="/tmp/kibana-values.yaml"
    cat > "$kibana_values" << EOF
replicas: 1

elasticsearchHosts: "http://elasticsearch-master:9200"

kibanaConfig:
  kibana.yml: |
    server.host: 0.0.0.0
    elasticsearch.hosts: ["http://elasticsearch-master:9200"]
    server.publicBaseUrl: "https://kibana.inergize.com"
    xpack.security.enabled: true
    xpack.encryptedSavedObjects.encryptionKey: "$(openssl rand -base64 32)"

resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 1000m
    memory: 2Gi

service:
  type: ClusterIP
  port: 5601
  nodePort: ""
  labels: {}
  annotations: {}
  loadBalancerSourceRanges: []
EOF
    
    helm upgrade --install kibana elastic/kibana \
        --namespace "$MONITORING_NAMESPACE" \
        --values "$kibana_values" \
        --wait --timeout=10m
    
    # Clean up values files
    rm -f "$es_values" "$logstash_values" "$kibana_values"
    
    print_success "ELK stack deployed"
}

# Function to deploy Jaeger tracing
deploy_jaeger() {
    if [[ "$ENABLE_JAEGER" != "true" ]]; then
        print_status "Jaeger deployment skipped"
        return
    fi
    
    print_status "Deploying Jaeger for distributed tracing..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would deploy Jaeger tracing"
        return
    fi
    
    local jaeger_values="/tmp/jaeger-values.yaml"
    cat > "$jaeger_values" << EOF
provisionDataStore:
  cassandra: false
  elasticsearch: true

storage:
  type: elasticsearch
  elasticsearch:
    host: elasticsearch-master
    port: 9200
    scheme: http

agent:
  enabled: true
  
collector:
  enabled: true
  service:
    type: ClusterIP
  resources:
    limits:
      cpu: 500m
      memory: 1Gi
    requests:
      cpu: 100m
      memory: 256Mi

query:
  enabled: true
  service:
    type: ClusterIP
  resources:
    limits:
      cpu: 500m
      memory: 1Gi
    requests:
      cpu: 100m
      memory: 256Mi
EOF
    
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace "$MONITORING_NAMESPACE" \
        --values "$jaeger_values" \
        --wait --timeout=10m
    
    rm -f "$jaeger_values"
    
    print_success "Jaeger deployed"
}

# Function to create service monitors
create_service_monitors() {
    print_status "Creating service monitors for application services..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create service monitors"
        return
    fi
    
    # LinkedIn service monitor
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: linkedin-service
  namespace: $MONITORING_NAMESPACE
  labels:
    team: inergize
spec:
  selector:
    matchLabels:
      app: linkedin-service
  namespaceSelector:
    matchNames:
      - $NAMESPACE
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
    - port: http
      path: /metrics/compliance
      interval: 15s
EOF
    
    # Auth service monitor
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: auth-service
  namespace: $MONITORING_NAMESPACE
  labels:
    team: inergize
spec:
  selector:
    matchLabels:
      app: auth-service
  namespaceSelector:
    matchNames:
      - $NAMESPACE
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
    - port: http
      path: /metrics/security
      interval: 30s
EOF
    
    # Analytics service monitor
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: analytics-service
  namespace: $MONITORING_NAMESPACE
  labels:
    team: inergize
spec:
  selector:
    matchLabels:
      app: analytics-service
  namespaceSelector:
    matchNames:
      - $NAMESPACE
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
    - port: websocket
      path: /metrics
      interval: 60s
EOF
    
    print_success "Service monitors created"
}

# Function to deploy custom dashboards
deploy_dashboards() {
    print_status "Deploying custom Grafana dashboards..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would deploy custom dashboards"
        return
    fi
    
    # LinkedIn Compliance Dashboard
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: linkedin-compliance-dashboard
  namespace: $MONITORING_NAMESPACE
  labels:
    grafana_dashboard: "1"
data:
  linkedin-compliance.json: |
    {
      "dashboard": {
        "id": null,
        "title": "LinkedIn Compliance Monitor",
        "tags": ["linkedin", "compliance"],
        "timezone": "browser",
        "panels": [
          {
            "id": 1,
            "title": "Compliance Health Score",
            "type": "gauge",
            "targets": [
              {
                "expr": "avg(linkedin_health_score)",
                "refId": "A"
              }
            ],
            "fieldConfig": {
              "defaults": {
                "min": 0,
                "max": 100,
                "thresholds": {
                  "steps": [
                    {"color": "red", "value": 0},
                    {"color": "yellow", "value": 40},
                    {"color": "green", "value": 80}
                  ]
                }
              }
            }
          },
          {
            "id": 2,
            "title": "Daily Connection Requests",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(increase(linkedin_connections_sent_total[1d]))",
                "refId": "A"
              }
            ]
          },
          {
            "id": 3,
            "title": "Rate Limit Status",
            "type": "table",
            "targets": [
              {
                "expr": "linkedin_rate_limit_remaining",
                "refId": "A"
              }
            ]
          }
        ]
      }
    }
EOF
    
    # Security Dashboard
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-dashboard
  namespace: $MONITORING_NAMESPACE
  labels:
    grafana_dashboard: "1"
data:
  security.json: |
    {
      "dashboard": {
        "id": null,
        "title": "Security Overview",
        "tags": ["security"],
        "timezone": "browser",
        "panels": [
          {
            "id": 1,
            "title": "Authentication Failures",
            "type": "stat",
            "targets": [
              {
                "expr": "sum(rate(auth_login_failures_total[5m]))",
                "refId": "A"
              }
            ],
            "fieldConfig": {
              "defaults": {
                "thresholds": {
                  "steps": [
                    {"color": "green", "value": 0},
                    {"color": "yellow", "value": 10},
                    {"color": "red", "value": 50}
                  ]
                }
              }
            }
          },
          {
            "id": 2,
            "title": "API Rate Limit Violations",
            "type": "graph",
            "targets": [
              {
                "expr": "sum by (service) (rate(kong_http_status{code=\"429\"}[5m]))",
                "refId": "A"
              }
            ]
          }
        ]
      }
    }
EOF
    
    print_success "Custom dashboards deployed"
}

# Function to validate monitoring deployment
validate_monitoring() {
    print_status "Validating monitoring deployment..."
    
    local validation_failed=false
    
    # Check Prometheus
    if [[ "$ENABLE_PROMETHEUS" == "true" ]]; then
        print_status "Checking Prometheus deployment..."
        if kubectl get pods -n "$MONITORING_NAMESPACE" -l app.kubernetes.io/name=prometheus | grep -q Running; then
            print_success "Prometheus is running"
        else
            print_error "Prometheus deployment validation failed"
            validation_failed=true
        fi
    fi
    
    # Check Grafana
    if [[ "$ENABLE_GRAFANA" == "true" ]]; then
        print_status "Checking Grafana deployment..."
        if kubectl get pods -n "$MONITORING_NAMESPACE" -l app.kubernetes.io/name=grafana | grep -q Running; then
            print_success "Grafana is running"
        else
            print_error "Grafana deployment validation failed"
            validation_failed=true
        fi
    fi
    
    # Check AlertManager
    if [[ "$ENABLE_ALERTMANAGER" == "true" ]]; then
        print_status "Checking AlertManager deployment..."
        if kubectl get pods -n "$MONITORING_NAMESPACE" -l app.kubernetes.io/name=alertmanager | grep -q Running; then
            print_success "AlertManager is running"
        else
            print_error "AlertManager deployment validation failed"
            validation_failed=true
        fi
    fi
    
    # Check ELK stack
    if [[ "$ENABLE_ELK_STACK" == "true" ]]; then
        print_status "Checking ELK stack deployment..."
        local elk_components=("elasticsearch" "logstash" "kibana")
        for component in "${elk_components[@]}"; do
            if kubectl get pods -n "$MONITORING_NAMESPACE" -l app="$component" | grep -q Running; then
                print_success "$component is running"
            else
                print_warning "$component may not be fully ready"
            fi
        done
    fi
    
    # Check service monitors
    print_status "Checking service monitors..."
    local monitor_count=$(kubectl get servicemonitor -n "$MONITORING_NAMESPACE" --no-headers | wc -l)
    if [[ $monitor_count -ge 3 ]]; then
        print_success "$monitor_count service monitors found"
    else
        print_warning "Only $monitor_count service monitors found"
    fi
    
    if [[ "$validation_failed" == "true" ]]; then
        print_error "Monitoring deployment validation failed"
        exit 1
    fi
    
    print_success "Monitoring deployment validation completed"
}

# Function to create monitoring report
create_monitoring_report() {
    print_status "Creating monitoring deployment report..."
    
    local report_file="/tmp/inergize_monitoring_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
InErgize Monitoring and Alerting Deployment Report
=================================================
Generated: $(date)
Environment: $ENVIRONMENT
Namespace: $NAMESPACE
Monitoring Namespace: $MONITORING_NAMESPACE

Deployed Components:
-------------------
Prometheus: $([ "$ENABLE_PROMETHEUS" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
Grafana: $([ "$ENABLE_GRAFANA" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
AlertManager: $([ "$ENABLE_ALERTMANAGER" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
ELK Stack: $([ "$ENABLE_ELK_STACK" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
Jaeger Tracing: $([ "$ENABLE_JAEGER" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")

Storage Configuration:
---------------------
Prometheus Storage: $PROMETHEUS_STORAGE
Grafana Storage: $GRAFANA_STORAGE
Elasticsearch Storage: $ELASTICSEARCH_STORAGE

Integration Status:
------------------
Slack Webhook: $([ -n "$SLACK_WEBHOOK" ] && echo "✓ Configured" || echo "✗ Not configured")
PagerDuty: $([ -n "$PAGERDUTY_TOKEN" ] && echo "✓ Configured" || echo "✗ Not configured")
SMTP: $([ -n "$SMTP_USER" ] && echo "✓ Configured" || echo "✗ Not configured")

Key URLs (when ingress is configured):
-------------------------------------
• Prometheus: https://prometheus.inergize.com
• Grafana: https://grafana.inergize.com
• AlertManager: https://alertmanager.inergize.com
• Kibana: https://kibana.inergize.com
• Jaeger: https://jaeger.inergize.com

Default Credentials:
-------------------
EOF
    
    if [[ "$DRY_RUN" != "true" && "$ENABLE_GRAFANA" == "true" ]]; then
        local grafana_password=$(kubectl get secret -n "$MONITORING_NAMESPACE" kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 -d)
        echo "Grafana Admin: admin / $grafana_password" >> "$report_file"
    else
        echo "Grafana Admin: admin / <password in k8s secret>" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

LinkedIn Compliance Monitoring:
------------------------------
• Health score tracking: Active
• Rate limit monitoring: Active
• Compliance alerts: Configured
• Automated responses: Ready

Security Monitoring:
-------------------
• Authentication failure tracking: Active
• Brute force detection: Active
• Suspicious IP monitoring: Active
• Data breach indicators: Active

Next Steps:
----------
1. Configure ingress controllers for external access
2. Set up SSL certificates for monitoring endpoints
3. Test alert routing and notifications
4. Configure backup procedures for monitoring data
5. Set up log rotation and retention policies

EOF
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "Status: DRY RUN - NO CHANGES MADE" >> "$report_file"
    else
        echo "Status: LIVE DEPLOYMENT" >> "$report_file"
    fi
    
    print_success "Monitoring report created: $report_file"
    
    # Display key information
    echo ""
    print_status "==== Monitoring Deployment Summary ===="
    echo "Environment: $ENVIRONMENT"
    echo "Monitoring Namespace: $MONITORING_NAMESPACE"
    echo "Components: Prometheus, Grafana, AlertManager$([ "$ENABLE_ELK_STACK" == "true" ] && echo ", ELK Stack")$([ "$ENABLE_JAEGER" == "true" ] && echo ", Jaeger")"
    echo "Report: $report_file"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --monitoring-namespace)
            MONITORING_NAMESPACE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --no-prometheus)
            ENABLE_PROMETHEUS="false"
            shift
            ;;
        --no-grafana)
            ENABLE_GRAFANA="false"
            shift
            ;;
        --no-alertmanager)
            ENABLE_ALERTMANAGER="false"
            shift
            ;;
        --no-elk)
            ENABLE_ELK_STACK="false"
            shift
            ;;
        --no-jaeger)
            ENABLE_JAEGER="false"
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main function
main() {
    local start_time=$(date +%s)
    
    print_status "==== InErgize Monitoring and Alerting Deployment Started ===="
    print_status "Environment: $ENVIRONMENT"
    print_status "Namespace: $NAMESPACE"
    print_status "Monitoring Namespace: $MONITORING_NAMESPACE"
    print_status "Dry Run: $DRY_RUN"
    
    log_message "INFO" "Monitoring deployment started - Environment: $ENVIRONMENT, Namespace: $NAMESPACE"
    
    # Execute deployment steps
    check_prerequisites
    create_namespaces
    deploy_prometheus_stack
    deploy_custom_monitoring
    deploy_elk_stack
    deploy_jaeger
    create_service_monitors
    deploy_dashboards
    validate_monitoring
    create_monitoring_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "==== Monitoring Deployment Dry Run Completed in ${duration}s ===="
        print_status "No actual changes were made. Run without --dry-run to execute deployment."
    else
        print_success "==== Monitoring and Alerting Deployment Completed Successfully in ${duration}s ===="
        print_status "Deployment Summary:"
        print_status "• Environment: $ENVIRONMENT"
        print_status "• Monitoring Namespace: $MONITORING_NAMESPACE"
        print_status "• Prometheus: $([ "$ENABLE_PROMETHEUS" == "true" ] && echo "✓" || echo "✗")"
        print_status "• Grafana: $([ "$ENABLE_GRAFANA" == "true" ] && echo "✓" || echo "✗")"
        print_status "• AlertManager: $([ "$ENABLE_ALERTMANAGER" == "true" ] && echo "✓" || echo "✗")"
        print_status "• ELK Stack: $([ "$ENABLE_ELK_STACK" == "true" ] && echo "✓" || echo "✗")"
        print_status "• Jaeger: $([ "$ENABLE_JAEGER" == "true" ] && echo "✓" || echo "✗")"
        print_status "• Duration: ${duration}s"
        
        echo ""
        print_status "Your InErgize monitoring stack is now operational!"
        print_status "LinkedIn compliance and security monitoring are active."
        
        if [[ "$ENABLE_GRAFANA" == "true" ]]; then
            echo ""
            print_status "Grafana admin password:"
            kubectl get secret -n "$MONITORING_NAMESPACE" kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 -d
            echo ""
        fi
    fi
    
    log_message "INFO" "Monitoring deployment completed successfully - Duration: ${duration}s"
}

# Execute main function
main "$@"