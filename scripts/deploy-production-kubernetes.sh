#!/bin/bash
# InErgize Production Kubernetes Deployment Script
# Automated deployment with comprehensive validation and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KUBE_DIR="$PROJECT_ROOT/infrastructure/kubernetes"
GITOPS_DIR="$PROJECT_ROOT/infrastructure/gitops"
MONITORING_DIR="$PROJECT_ROOT/infrastructure/monitoring"
DR_DIR="$PROJECT_ROOT/infrastructure/disaster-recovery"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
ENVIRONMENT="${ENVIRONMENT:-production}"
CLUSTER_NAME="${CLUSTER_NAME:-inergize-production}"
NAMESPACE="${NAMESPACE:-inergize-production}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/inergize}"
IMAGE_TAG="${IMAGE_TAG:-3.0.0}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_VALIDATION="${SKIP_VALIDATION:-false}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_info() {
    print_status "$BLUE" "ℹ️  $1"
}

print_success() {
    print_status "$GREEN" "✅ $1"
}

print_warning() {
    print_status "$YELLOW" "⚠️  $1"
}

print_error() {
    print_status "$RED" "❌ $1"
}

# Function to send Slack notifications
send_slack_notification() {
    local message="$1"
    local color="${2:-warning}"
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            --silent --show-error || print_warning "Failed to send Slack notification"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "velero" "jq" "yq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Verify cluster name
    current_cluster=$(kubectl config current-context)
    if [[ "$current_cluster" != *"$CLUSTER_NAME"* ]]; then
        print_warning "Current cluster context '$current_cluster' doesn't match expected '$CLUSTER_NAME'"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check Docker registry access
    if ! docker pull "$DOCKER_REGISTRY/auth-service:$IMAGE_TAG" &> /dev/null; then
        print_warning "Cannot pull images from registry. Deployment may fail."
    fi
    
    print_success "Prerequisites check completed"
}

# Function to validate configuration files
validate_configuration() {
    print_info "Validating Kubernetes configuration files..."
    
    local validation_failed=false
    
    # Validate YAML syntax
    for yaml_file in "$KUBE_DIR"/*.yml "$MONITORING_DIR"/*.yml "$DR_DIR"/*.yml; do
        if [[ -f "$yaml_file" ]]; then
            if ! yq eval '.' "$yaml_file" > /dev/null 2>&1; then
                print_error "Invalid YAML syntax in $yaml_file"
                validation_failed=true
            fi
        fi
    done
    
    # Validate Kubernetes resources
    if ! kubectl apply --dry-run=client -f "$KUBE_DIR/" > /dev/null 2>&1; then
        print_error "Kubernetes resource validation failed"
        validation_failed=true
    fi
    
    # Check resource quotas
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        local current_cpu_requests
        current_cpu_requests=$(kubectl describe quota -n "$NAMESPACE" 2>/dev/null | grep "requests.cpu" | awk '{print $2}' || echo "0")
        if [[ "$current_cpu_requests" =~ ^[0-9]+$ ]] && [[ $current_cpu_requests -gt 18 ]]; then
            print_warning "Current CPU requests ($current_cpu_requests) near quota limit"
        fi
    fi
    
    if [[ "$validation_failed" == "true" ]]; then
        print_error "Configuration validation failed"
        exit 1
    fi
    
    print_success "Configuration validation completed"
}

# Function to setup External Secrets Operator
setup_external_secrets() {
    print_info "Setting up External Secrets Operator..."
    
    # Check if External Secrets Operator is already installed
    if ! kubectl get crd externalsecrets.external-secrets.io &> /dev/null; then
        print_info "Installing External Secrets Operator..."
        helm repo add external-secrets https://charts.external-secrets.io
        helm repo update
        
        helm upgrade --install external-secrets external-secrets/external-secrets \
            --namespace external-secrets-system \
            --create-namespace \
            --set installCRDs=true \
            --wait
    fi
    
    print_success "External Secrets Operator setup completed"
}

# Function to setup Velero for backups
setup_velero() {
    print_info "Setting up Velero for disaster recovery..."
    
    # Check if Velero is already installed
    if ! kubectl get namespace velero &> /dev/null; then
        print_info "Installing Velero..."
        helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
        helm repo update
        
        helm upgrade --install velero vmware-tanzu/velero \
            --namespace velero \
            --create-namespace \
            --set configuration.provider=aws \
            --set configuration.backupStorageLocation.bucket=inergize-production-backups \
            --set configuration.backupStorageLocation.config.region=us-east-1 \
            --set configuration.volumeSnapshotLocation.config.region=us-east-1 \
            --set credentials.useSecret=true \
            --set credentials.name=cloud-credentials \
            --wait
    fi
    
    print_success "Velero setup completed"
}

# Function to create/update secrets
manage_secrets() {
    print_info "Managing secrets..."
    
    # Apply External Secret configurations
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl apply --dry-run=client -f "$KUBE_DIR/secrets.yml"
    else
        kubectl apply -f "$KUBE_DIR/secrets.yml"
        
        # Wait for secrets to be created
        print_info "Waiting for External Secrets to sync..."
        local max_wait=300
        local wait_time=0
        
        while [[ $wait_time -lt $max_wait ]]; do
            if kubectl get secret -n "$NAMESPACE" database-secrets app-secrets linkedin-secrets ai-secrets &> /dev/null; then
                break
            fi
            sleep 10
            wait_time=$((wait_time + 10))
            print_info "Waiting for secrets... ($wait_time/$max_wait seconds)"
        done
        
        if [[ $wait_time -ge $max_wait ]]; then
            print_error "Timeout waiting for secrets to be created"
            exit 1
        fi
    fi
    
    print_success "Secrets management completed"
}

# Function to deploy databases
deploy_databases() {
    print_info "Deploying databases..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl apply --dry-run=client -f "$KUBE_DIR/databases.yml"
    else
        kubectl apply -f "$KUBE_DIR/databases.yml"
        
        # Wait for databases to be ready
        print_info "Waiting for databases to be ready..."
        kubectl wait --for=condition=ready pod -l app=postgresql -n "$NAMESPACE" --timeout=300s
        kubectl wait --for=condition=ready pod -l app=timescaledb -n "$NAMESPACE" --timeout=300s
        kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout=300s
    fi
    
    print_success "Database deployment completed"
}

# Function to deploy services
deploy_services() {
    print_info "Deploying microservices..."
    
    # Update image tags in deployment
    local temp_file
    temp_file=$(mktemp)
    sed "s|:latest|:$IMAGE_TAG|g" "$KUBE_DIR/services.yml" > "$temp_file"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl apply --dry-run=client -f "$temp_file"
    else
        kubectl apply -f "$temp_file"
        
        # Wait for services to be ready
        print_info "Waiting for services to be ready..."
        local services=("auth-service" "linkedin-service" "analytics-service" "ai-service" "user-service")
        
        for service in "${services[@]}"; do
            print_info "Waiting for $service to be ready..."
            kubectl wait --for=condition=available deployment "$service" -n "$NAMESPACE" --timeout=300s
            
            # Verify service health
            if ! kubectl exec -n "$NAMESPACE" "deployment/$service" -- curl -f http://localhost:3001/health --max-time 10 &> /dev/null; then
                print_warning "$service may not be responding to health checks"
            fi
        done
    fi
    
    rm -f "$temp_file"
    print_success "Service deployment completed"
}

# Function to setup auto-scaling
setup_autoscaling() {
    print_info "Setting up auto-scaling..."
    
    # Install KEDA if not present
    if ! kubectl get crd scaledobjects.keda.sh &> /dev/null; then
        print_info "Installing KEDA..."
        helm repo add kedacore https://kedacore.github.io/charts
        helm repo update
        
        helm upgrade --install keda kedacore/keda \
            --namespace keda \
            --create-namespace \
            --wait
    fi
    
    # Install VPA if not present
    if ! kubectl get crd verticalpodautoscalers.autoscaling.k8s.io &> /dev/null; then
        print_info "Installing Vertical Pod Autoscaler..."
        kubectl apply -f https://github.com/kubernetes/autoscaler/releases/latest/download/vpa-crd.yaml
        kubectl apply -f https://github.com/kubernetes/autoscaler/releases/latest/download/vpa-rbac.yaml
        kubectl apply -f https://github.com/kubernetes/autoscaler/releases/latest/download/vpa-deployment.yaml
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl apply --dry-run=client -f "$KUBE_DIR/autoscaling.yml"
    else
        kubectl apply -f "$KUBE_DIR/autoscaling.yml"
    fi
    
    print_success "Auto-scaling setup completed"
}

# Function to setup monitoring
setup_monitoring() {
    if [[ "$ENABLE_MONITORING" != "true" ]]; then
        print_info "Monitoring setup skipped"
        return
    fi
    
    print_info "Setting up monitoring and alerting..."
    
    # Install Prometheus Operator if not present
    if ! kubectl get crd prometheuses.monitoring.coreos.com &> /dev/null; then
        print_info "Installing Prometheus Operator..."
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --create-namespace \
            --set prometheus.prometheusSpec.retention=90d \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=fast-ssd \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi \
            --set grafana.persistence.enabled=true \
            --set grafana.persistence.storageClassName=fast-ssd \
            --set grafana.persistence.size=20Gi \
            --wait
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl apply --dry-run=client -f "$MONITORING_DIR/"
    else
        kubectl apply -f "$MONITORING_DIR/"
    fi
    
    print_success "Monitoring setup completed"
}

# Function to setup disaster recovery
setup_disaster_recovery() {
    print_info "Setting up disaster recovery..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl apply --dry-run=client -f "$DR_DIR/"
    else
        kubectl apply -f "$DR_DIR/"
        
        # Create initial backup
        print_info "Creating initial backup..."
        velero backup create initial-production-backup-$(date +%Y%m%d-%H%M%S) \
            --include-namespaces "$NAMESPACE" \
            --wait
    fi
    
    print_success "Disaster recovery setup completed"
}

# Function to setup GitOps with ArgoCD
setup_gitops() {
    print_info "Setting up GitOps with ArgoCD..."
    
    # Install ArgoCD if not present
    if ! kubectl get namespace argocd &> /dev/null; then
        print_info "Installing ArgoCD..."
        kubectl create namespace argocd
        kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
        
        # Wait for ArgoCD to be ready
        kubectl wait --for=condition=available deployment -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl apply --dry-run=client -f "$GITOPS_DIR/"
    else
        kubectl apply -f "$GITOPS_DIR/"
    fi
    
    print_success "GitOps setup completed"
}

# Function to run validation tests
run_validation() {
    if [[ "$SKIP_VALIDATION" == "true" ]]; then
        print_info "Validation skipped"
        return
    fi
    
    print_info "Running post-deployment validation..."
    
    local validation_failed=false
    
    # Test service endpoints
    local services=("auth-service:3001" "linkedin-service:3003" "analytics-service:3004" "ai-service:3005" "user-service:3002")
    
    for service_port in "${services[@]}"; do
        local service=${service_port%:*}
        local port=${service_port#*:}
        
        print_info "Testing $service endpoint..."
        if kubectl exec -n "$NAMESPACE" "deployment/$service" -- curl -f "http://localhost:$port/health" --max-time 10 &> /dev/null; then
            print_success "$service health check passed"
        else
            print_error "$service health check failed"
            validation_failed=true
        fi
    done
    
    # Test database connectivity
    print_info "Testing database connectivity..."
    if kubectl exec -n "$NAMESPACE" postgresql-0 -- pg_isready -U inergize_user -d inergize_production &> /dev/null; then
        print_success "PostgreSQL connectivity test passed"
    else
        print_error "PostgreSQL connectivity test failed"
        validation_failed=true
    fi
    
    if kubectl exec -n "$NAMESPACE" redis-0 -- redis-cli ping &> /dev/null; then
        print_success "Redis connectivity test passed"
    else
        print_error "Redis connectivity test failed"
        validation_failed=true
    fi
    
    # Test LinkedIn compliance
    print_info "Testing LinkedIn compliance monitoring..."
    if kubectl get prometheusrule linkedin-compliance-rules -n "$NAMESPACE" &> /dev/null; then
        print_success "LinkedIn compliance monitoring configured"
    else
        print_error "LinkedIn compliance monitoring not found"
        validation_failed=true
    fi
    
    # Test auto-scaling configuration
    print_info "Testing auto-scaling configuration..."
    local hpa_count
    hpa_count=$(kubectl get hpa -n "$NAMESPACE" --no-headers | wc -l)
    if [[ "$hpa_count" -ge 5 ]]; then
        print_success "Auto-scaling configured ($hpa_count HPAs found)"
    else
        print_error "Auto-scaling configuration incomplete ($hpa_count HPAs found)"
        validation_failed=true
    fi
    
    if [[ "$validation_failed" == "true" ]]; then
        print_error "Post-deployment validation failed"
        send_slack_notification "🚨 InErgize production deployment validation failed" "danger"
        exit 1
    fi
    
    print_success "Post-deployment validation completed successfully"
}

# Function to display deployment summary
show_deployment_summary() {
    print_info "Deployment Summary"
    echo "===================="
    echo "Environment: $ENVIRONMENT"
    echo "Cluster: $CLUSTER_NAME"
    echo "Namespace: $NAMESPACE"
    echo "Image Tag: $IMAGE_TAG"
    echo "Dry Run: $DRY_RUN"
    echo ""
    
    if [[ "$DRY_RUN" != "true" ]]; then
        echo "Deployed Resources:"
        kubectl get all -n "$NAMESPACE" --show-labels=false
        echo ""
        
        echo "Service URLs:"
        echo "- ArgoCD UI: https://argocd.inergize.com"
        echo "- Grafana: https://grafana.inergize.com"
        echo "- Prometheus: https://prometheus.inergize.com"
        echo ""
        
        echo "Getting ArgoCD admin password:"
        kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
        echo ""
    fi
}

# Function to handle rollback
rollback_deployment() {
    print_warning "Initiating rollback..."
    
    # Get latest successful backup
    local latest_backup
    latest_backup=$(velero backup get --output json | jq -r '.items[] | select(.status.phase=="Completed") | .metadata.name' | head -n1)
    
    if [[ -n "$latest_backup" ]]; then
        print_info "Rolling back to backup: $latest_backup"
        velero restore create "rollback-$(date +%Y%m%d-%H%M%S)" --from-backup "$latest_backup"
        send_slack_notification "🔄 InErgize production rollback initiated from backup: $latest_backup" "warning"
    else
        print_error "No backup found for rollback"
        send_slack_notification "❌ InErgize production rollback failed - no backup found" "danger"
        exit 1
    fi
}

# Function to cleanup on failure
cleanup_on_failure() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        print_error "Deployment failed with exit code $exit_code"
        
        if [[ "$DRY_RUN" != "true" ]]; then
            print_warning "Collecting failure information..."
            
            # Collect pod logs
            kubectl logs -n "$NAMESPACE" --selector app=linkedin-service --tail=100 > /tmp/linkedin-service-logs.txt || true
            kubectl logs -n "$NAMESPACE" --selector app=auth-service --tail=100 > /tmp/auth-service-logs.txt || true
            
            # Show recent events
            kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -20
            
            send_slack_notification "❌ InErgize production deployment failed. Check logs for details." "danger"
            
            # Ask for rollback
            read -p "Do you want to rollback to the last successful state? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
        fi
    fi
}

# Main deployment function
main() {
    print_info "Starting InErgize production deployment..."
    send_slack_notification "🚀 InErgize production deployment started by $(whoami)" "good"
    
    # Set trap for cleanup
    trap cleanup_on_failure EXIT
    
    # Execute deployment steps
    check_prerequisites
    validate_configuration
    
    if [[ "$DRY_RUN" != "true" ]]; then
        setup_external_secrets
        setup_velero
    fi
    
    manage_secrets
    deploy_databases
    deploy_services
    setup_autoscaling
    setup_monitoring
    setup_disaster_recovery
    setup_gitops
    
    run_validation
    show_deployment_summary
    
    # Disable trap on successful completion
    trap - EXIT
    
    print_success "InErgize production deployment completed successfully!"
    send_slack_notification "✅ InErgize production deployment completed successfully!" "good"
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -e, --environment ENVIRONMENT    Set environment (default: production)"
    echo "  -c, --cluster CLUSTER_NAME       Set cluster name (default: inergize-production)"
    echo "  -n, --namespace NAMESPACE         Set namespace (default: inergize-production)"
    echo "  -t, --tag IMAGE_TAG              Set image tag (default: 3.0.0)"
    echo "  -d, --dry-run                    Run in dry-run mode"
    echo "  -s, --skip-validation            Skip post-deployment validation"
    echo "  --no-monitoring                  Disable monitoring setup"
    echo "  -h, --help                       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  SLACK_WEBHOOK                    Slack webhook URL for notifications"
    echo "  DOCKER_REGISTRY                  Docker registry URL (default: ghcr.io/inergize)"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--cluster)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN="true"
            shift
            ;;
        -s|--skip-validation)
            SKIP_VALIDATION="true"
            shift
            ;;
        --no-monitoring)
            ENABLE_MONITORING="false"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Execute main function
main "$@"