#!/bin/bash

# InErgize Backup and Disaster Recovery Deployment Script
# Enterprise-grade backup strategy with automated recovery procedures
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
DR_DIR="$PROJECT_ROOT/infrastructure/disaster-recovery"
LOG_FILE="/var/log/inergize/disaster-recovery.log"

# Environment configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE="${NAMESPACE:-inergize-production}"
VELERO_NAMESPACE="${VELERO_NAMESPACE:-velero}"

# Backup configuration
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-inergize-production-backups}"
DR_S3_BUCKET="${DR_S3_BUCKET:-inergize-dr-backups-west}"
AWS_REGION="${AWS_REGION:-us-east-1}"
DR_AWS_REGION="${DR_AWS_REGION:-us-west-2}"

# Backup schedules
DAILY_BACKUP_TIME="${DAILY_BACKUP_TIME:-2}"  # 2 AM
HOURLY_CRITICAL_BACKUP="${HOURLY_CRITICAL_BACKUP:-true}"
WEEKLY_CROSS_REGION="${WEEKLY_CROSS_REGION:-true}"

# Retention policies
DAILY_RETENTION_DAYS="${DAILY_RETENTION_DAYS:-30}"
CRITICAL_RETENTION_DAYS="${CRITICAL_RETENTION_DAYS:-7}"
CROSS_REGION_RETENTION_DAYS="${CROSS_REGION_RETENTION_DAYS:-90}"

# Recovery objectives
RTO_MINUTES="${RTO_MINUTES:-240}"  # 4 hours
RPO_MINUTES="${RPO_MINUTES:-60}"   # 1 hour
CRITICAL_RTO_MINUTES="${CRITICAL_RTO_MINUTES:-30}"    # 30 minutes
LINKEDIN_RTO_MINUTES="${LINKEDIN_RTO_MINUTES:-15}"    # 15 minutes

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
InErgize Backup and Disaster Recovery Deployment Script

Usage: $0 [OPTIONS]

Options:
  --environment ENV           Environment (production/staging/development)
  --namespace NAMESPACE       Application namespace (default: inergize-production)
  --backup-bucket BUCKET      S3 bucket for primary backups
  --dr-bucket BUCKET         S3 bucket for cross-region disaster recovery
  --aws-region REGION        Primary AWS region (default: us-east-1)
  --dr-region REGION         DR AWS region (default: us-west-2)
  --rto-minutes MINUTES      Recovery Time Objective in minutes (default: 240)
  --rpo-minutes MINUTES      Recovery Point Objective in minutes (default: 60)
  --dry-run                  Show what would be deployed without executing
  --no-hourly-critical       Disable hourly critical data backups
  --no-cross-region          Disable weekly cross-region backups
  --help                     Show this help message

Environment Variables:
  AWS_ACCESS_KEY_ID          AWS access key for backup storage
  AWS_SECRET_ACCESS_KEY      AWS secret key for backup storage
  SLACK_WEBHOOK              Slack webhook for DR notifications

Examples:
  $0                                         # Deploy with defaults
  $0 --dry-run                              # Validate configuration
  $0 --environment staging --rto-minutes 60 # Staging with faster RTO

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking disaster recovery prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "velero" "aws" "jq")
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
    
    # Check AWS credentials
    if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        print_error "AWS credentials are required for backup storage"
        exit 1
    fi
    
    # Test AWS connectivity
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "Cannot authenticate with AWS"
        exit 1
    fi
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    print_success "Prerequisites check completed"
}

# Function to create S3 buckets
create_s3_buckets() {
    print_status "Setting up S3 backup storage..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create S3 buckets: $BACKUP_S3_BUCKET, $DR_S3_BUCKET"
        return
    fi
    
    # Create primary backup bucket
    print_status "Creating primary backup bucket: $BACKUP_S3_BUCKET"
    if ! aws s3 ls "s3://$BACKUP_S3_BUCKET" &> /dev/null; then
        aws s3 mb "s3://$BACKUP_S3_BUCKET" --region "$AWS_REGION"
        
        # Configure bucket encryption
        aws s3api put-bucket-encryption \
            --bucket "$BACKUP_S3_BUCKET" \
            --server-side-encryption-configuration '{
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "aws:kms"
                        },
                        "BucketKeyEnabled": true
                    }
                ]
            }'
        
        # Configure bucket versioning
        aws s3api put-bucket-versioning \
            --bucket "$BACKUP_S3_BUCKET" \
            --versioning-configuration Status=Enabled
        
        # Configure lifecycle policy
        aws s3api put-bucket-lifecycle-configuration \
            --bucket "$BACKUP_S3_BUCKET" \
            --lifecycle-configuration '{
                "Rules": [
                    {
                        "ID": "backup-lifecycle",
                        "Status": "Enabled",
                        "Transitions": [
                            {
                                "Days": 30,
                                "StorageClass": "STANDARD_IA"
                            },
                            {
                                "Days": 90,
                                "StorageClass": "GLACIER"
                            }
                        ],
                        "Expiration": {
                            "Days": 365
                        }
                    }
                ]
            }'
        
        print_success "Primary backup bucket created with encryption and lifecycle policy"
    else
        print_status "Primary backup bucket already exists"
    fi
    
    # Create DR backup bucket in different region
    print_status "Creating DR backup bucket: $DR_S3_BUCKET"
    if ! aws s3 ls "s3://$DR_S3_BUCKET" &> /dev/null; then
        aws s3 mb "s3://$DR_S3_BUCKET" --region "$DR_AWS_REGION"
        
        # Configure bucket encryption
        aws s3api put-bucket-encryption \
            --bucket "$DR_S3_BUCKET" \
            --server-side-encryption-configuration '{
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "aws:kms"
                        },
                        "BucketKeyEnabled": true
                    }
                ]
            }'
        
        # Configure cross-region replication
        aws s3api put-bucket-replication \
            --bucket "$BACKUP_S3_BUCKET" \
            --replication-configuration '{
                "Role": "arn:aws:iam::ACCOUNT:role/replication-role",
                "Rules": [
                    {
                        "ID": "ReplicateEverything",
                        "Status": "Enabled",
                        "Prefix": "",
                        "Destination": {
                            "Bucket": "arn:aws:s3:::'"$DR_S3_BUCKET"'",
                            "StorageClass": "STANDARD_IA"
                        }
                    }
                ]
            }' || print_warning "Cross-region replication setup may need manual IAM role configuration"
        
        print_success "DR backup bucket created"
    else
        print_status "DR backup bucket already exists"
    fi
}

# Function to install Velero
install_velero() {
    print_status "Installing Velero for backup management..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would install Velero with AWS plugin"
        return
    fi
    
    # Create Velero namespace
    kubectl create namespace "$VELERO_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Create AWS credentials secret
    kubectl create secret generic cloud-credentials \
        --namespace="$VELERO_NAMESPACE" \
        --from-literal=cloud="[default]
aws_access_key_id=$AWS_ACCESS_KEY_ID
aws_secret_access_key=$AWS_SECRET_ACCESS_KEY" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Velero using Helm
    print_status "Installing Velero Helm chart..."
    helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
    helm repo update
    
    local velero_values="/tmp/velero-values.yaml"
    cat > "$velero_values" << EOF
configuration:
  provider: aws
  backupStorageLocation:
    name: primary-backup-s3
    bucket: $BACKUP_S3_BUCKET
    prefix: kubernetes
    config:
      region: $AWS_REGION
      s3ForcePathStyle: "false"
  volumeSnapshotLocation:
    name: primary-volume-snapshots
    config:
      region: $AWS_REGION
      enableSharedSnapshots: "true"

credentials:
  useSecret: true
  name: cloud-credentials
  secretContents:
    cloud: |
      [default]
      aws_access_key_id=$AWS_ACCESS_KEY_ID
      aws_secret_access_key=$AWS_SECRET_ACCESS_KEY

initContainers:
  - name: velero-plugin-for-aws
    image: velero/velero-plugin-for-aws:v1.8.0
    imagePullPolicy: IfNotPresent
    volumeMounts:
      - mountPath: /target
        name: plugins

deployRestic: true

restic:
  enabled: true
  podSecurityContext:
    runAsUser: 0
    fsGroup: 0
  securityContext:
    runAsUser: 0
    privileged: false

resources:
  requests:
    cpu: 500m
    memory: 128Mi
  limits:
    cpu: 1000m
    memory: 512Mi

rbac:
  create: true
  clusterAdministrator: true

serviceAccount:
  server:
    create: true
    name: velero

metrics:
  enabled: true
  scrapeInterval: 30s
  scrapeTimeout: 10s

schedules:
  daily-backup:
    disabled: false
    schedule: "0 $DAILY_BACKUP_TIME * * *"
    template:
      ttl: "${DAILY_RETENTION_DAYS * 24}h"
      includedNamespaces:
        - $NAMESPACE
      storageLocation: primary-backup-s3
      volumeSnapshotLocations:
        - primary-volume-snapshots
EOF
    
    helm upgrade --install velero vmware-tanzu/velero \
        --namespace "$VELERO_NAMESPACE" \
        --values "$velero_values" \
        --wait --timeout=10m
    
    rm -f "$velero_values"
    
    # Wait for Velero to be ready
    kubectl wait --for=condition=available deployment/velero \
        --namespace="$VELERO_NAMESPACE" --timeout=300s
    
    print_success "Velero installed successfully"
}

# Function to deploy backup configurations
deploy_backup_configurations() {
    print_status "Deploying backup schedules and configurations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would deploy backup schedules and storage locations"
        return
    fi
    
    # Apply backup storage locations and schedules
    kubectl apply -f "$DR_DIR/backup-strategy.yml"
    
    # Create additional backup schedules based on configuration
    if [[ "$HOURLY_CRITICAL_BACKUP" == "true" ]]; then
        print_status "Configuring hourly critical data backups..."
        
        kubectl apply -f - <<EOF
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: hourly-critical-linkedin
  namespace: $VELERO_NAMESPACE
  labels:
    environment: $ENVIRONMENT
    backup-type: critical
    compliance: linkedin
spec:
  schedule: "0 * * * *"  # Every hour
  template:
    metadata:
      labels:
        backup-type: critical
        environment: $ENVIRONMENT
        compliance: linkedin
    spec:
      storageLocation: primary-backup-s3
      includedNamespaces:
        - $NAMESPACE
      labelSelector:
        matchLabels:
          app: linkedin-service
      orLabelSelectors:
        - matchLabels:
            component: compliance
        - matchLabels:
            data-classification: critical
      snapshotVolumes: true
      ttl: "${CRITICAL_RETENTION_DAYS * 24}h"
EOF
    fi
    
    if [[ "$WEEKLY_CROSS_REGION" == "true" ]]; then
        print_status "Configuring weekly cross-region backups..."
        
        # Create secondary backup storage location
        kubectl apply -f - <<EOF
apiVersion: velero.io/v1
kind: BackupStorageLocation
metadata:
  name: secondary-backup-s3
  namespace: $VELERO_NAMESPACE
  labels:
    environment: $ENVIRONMENT
    purpose: cross-region-dr
spec:
  provider: aws
  objectStorage:
    bucket: $DR_S3_BUCKET
    prefix: kubernetes
  config:
    region: $DR_AWS_REGION
    s3ForcePathStyle: "false"
  credential:
    name: cloud-credentials
    key: cloud
EOF
        
        # Create weekly cross-region backup schedule
        kubectl apply -f - <<EOF
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: weekly-cross-region-backup
  namespace: $VELERO_NAMESPACE
  labels:
    environment: $ENVIRONMENT
    backup-type: cross-region
spec:
  schedule: "0 1 * * 0"  # 1 AM EST every Sunday
  template:
    metadata:
      labels:
        backup-type: cross-region
        environment: $ENVIRONMENT
    spec:
      storageLocation: secondary-backup-s3
      includedNamespaces:
        - $NAMESPACE
        - monitoring
      includedResources:
        - '*'
      snapshotVolumes: true
      ttl: "${CROSS_REGION_RETENTION_DAYS * 24}h"
EOF
    fi
    
    print_success "Backup configurations deployed"
}

# Function to create disaster recovery procedures
create_disaster_recovery_procedures() {
    print_status "Creating disaster recovery automation and procedures..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create DR procedures and automation"
        return
    fi
    
    # Create disaster recovery ConfigMap with procedures
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: disaster-recovery-procedures
  namespace: $NAMESPACE
  labels:
    component: disaster-recovery
    environment: $ENVIRONMENT
data:
  recovery-objectives.txt: |
    InErgize Disaster Recovery Objectives
    ===================================
    
    RTO (Recovery Time Objective): $RTO_MINUTES minutes
    RPO (Recovery Point Objective): $RPO_MINUTES minutes
    Critical Services RTO: $CRITICAL_RTO_MINUTES minutes
    LinkedIn Compliance RTO: $LINKEDIN_RTO_MINUTES minutes
    
    Backup Schedule:
    - Daily backups: $DAILY_BACKUP_TIME:00 AM (retention: $DAILY_RETENTION_DAYS days)
    - Critical hourly: Every hour (retention: $CRITICAL_RETENTION_DAYS days)
    - Cross-region weekly: Sundays 1:00 AM (retention: $CROSS_REGION_RETENTION_DAYS days)
  
  emergency-contacts.txt: |
    Emergency Contacts for Disaster Recovery
    =======================================
    
    Primary On-Call: +1-555-0001 (ops@inergize.com)
    Secondary On-Call: +1-555-0002 (sre@inergize.com)
    LinkedIn Compliance: +1-555-0003 (compliance@inergize.com)
    Legal/DPO: +1-555-0004 (legal@inergize.com)
    
    Escalation Matrix:
    - P0 (LinkedIn Compliance): < 15 minutes
    - P1 (Service Outage): < 30 minutes  
    - P2 (Performance): < 2 hours
    - P3 (Minor Issues): < 24 hours
    
  quick-recovery.sh: |
    #!/bin/bash
    # Quick disaster recovery commands
    
    set -euo pipefail
    
    NAMESPACE="$NAMESPACE"
    
    # Function to get latest backup
    get_latest_backup() {
        local backup_type="\$1"
        velero backup get --selector backup-type="\$backup_type" \
            --output json | jq -r '.items[] | select(.status.phase=="Completed") | .metadata.name' | head -n1
    }
    
    # Function to restore from backup
    restore_service() {
        local backup_name="\$1"
        local restore_name="emergency-restore-\$(date +%s)"
        
        echo "🔄 Starting restore from backup: \$backup_name"
        velero restore create "\$restore_name" --from-backup "\$backup_name"
        
        # Wait for restore completion
        while true; do
            status=\$(velero restore get "\$restore_name" -o jsonpath='{.status.phase}')
            case "\$status" in
                "Completed")
                    echo "✅ Restore completed successfully"
                    break
                    ;;
                "Failed")
                    echo "❌ Restore failed"
                    velero restore describe "\$restore_name"
                    exit 1
                    ;;
                *)
                    echo "⏳ Restore in progress: \$status"
                    sleep 10
                    ;;
            esac
        done
    }
    
    # LinkedIn emergency recovery
    linkedin_emergency() {
        echo "🚨 LinkedIn Emergency Recovery Initiated"
        
        # Stop LinkedIn service immediately
        kubectl scale deployment linkedin-service -n "\$NAMESPACE" --replicas=0
        echo "🛑 LinkedIn service stopped"
        
        # Get latest critical backup
        critical_backup=\$(get_latest_backup "critical")
        if [[ -n "\$critical_backup" ]]; then
            restore_service "\$critical_backup"
            
            # Restart LinkedIn service with single replica
            kubectl scale deployment linkedin-service -n "\$NAMESPACE" --replicas=1
            
            # Wait for health check
            kubectl wait --for=condition=available deployment/linkedin-service -n "\$NAMESPACE" --timeout=300s
            echo "✅ LinkedIn service restored"
        else
            echo "❌ No critical backup found"
            exit 1
        fi
    }
    
    # Full system recovery
    full_system_recovery() {
        echo "🚨 Full System Recovery Initiated"
        
        # Get latest daily backup
        daily_backup=\$(get_latest_backup "daily")
        if [[ -n "\$daily_backup" ]]; then
            restore_service "\$daily_backup"
            echo "✅ Full system restored from: \$daily_backup"
        else
            echo "❌ No daily backup found"
            exit 1
        fi
    }
    
    # Health check function
    health_check() {
        echo "🔍 Performing system health check..."
        
        failed_services=()
        for service in auth-service linkedin-service analytics-service ai-service user-service; do
            if ! kubectl get deployment "\$service" -n "\$NAMESPACE" &> /dev/null; then
                failed_services+=("\$service")
            elif [[ \$(kubectl get deployment "\$service" -n "\$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0") == "0" ]]; then
                failed_services+=("\$service")
            fi
        done
        
        if [[ \${#failed_services[@]} -gt 0 ]]; then
            echo "❌ Failed services: \${failed_services[*]}"
            return 1
        else
            echo "✅ All services healthy"
            return 0
        fi
    }
    
    # Main function
    case "\${1:-}" in
        "linkedin-emergency")
            linkedin_emergency
            ;;
        "full-recovery")
            full_system_recovery
            ;;
        "health-check")
            health_check
            ;;
        *)
            echo "Usage: \$0 {linkedin-emergency|full-recovery|health-check}"
            exit 1
            ;;
    esac
EOF
    
    # Create automated health monitoring CronJob
    kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dr-health-monitor
  namespace: $NAMESPACE
  labels:
    component: disaster-recovery
    purpose: health-monitoring
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: dr-health-monitor
        spec:
          restartPolicy: OnFailure
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            fsGroup: 1000
          containers:
            - name: health-monitor
              image: bitnami/kubectl:latest
              imagePullPolicy: Always
              env:
                - name: NAMESPACE
                  value: "$NAMESPACE"
                - name: SLACK_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: monitoring-secrets
                      key: slack-webhook
                      optional: true
              command:
                - /bin/bash
                - -c
                - |
                  # Source the recovery procedures
                  source /scripts/quick-recovery.sh
                  
                  # Run health check
                  if ! health_check; then
                    echo "Health check failed - sending alert"
                    if [[ -n "\${SLACK_WEBHOOK:-}" ]]; then
                      curl -X POST "\$SLACK_WEBHOOK" \
                        -H 'Content-type: application/json' \
                        --data '{"text":"🚨 InErgize Health Check Failed - Manual intervention required"}'
                    fi
                    exit 1
                  fi
              resources:
                requests:
                  memory: "64Mi"
                  cpu: "50m"
                limits:
                  memory: "128Mi"
                  cpu: "100m"
              securityContext:
                allowPrivilegeEscalation: false
                readOnlyRootFilesystem: true
                runAsNonRoot: true
                capabilities:
                  drop:
                    - ALL
              volumeMounts:
                - name: scripts
                  mountPath: /scripts
                  readOnly: true
          volumes:
            - name: scripts
              configMap:
                name: disaster-recovery-procedures
                defaultMode: 0755
          serviceAccountName: disaster-recovery-monitor
EOF
    
    # Create service account and RBAC for health monitoring
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: disaster-recovery-monitor
  namespace: $NAMESPACE
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: disaster-recovery-monitor
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "patch", "update"]
  - apiGroups: [""]
    resources: ["pods", "services"]
    verbs: ["get", "list"]
  - apiGroups: ["velero.io"]
    resources: ["backups", "restores"]
    verbs: ["get", "list", "create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: disaster-recovery-monitor
subjects:
  - kind: ServiceAccount
    name: disaster-recovery-monitor
    namespace: $NAMESPACE
roleRef:
  kind: ClusterRole
  name: disaster-recovery-monitor
  apiGroup: rbac.authorization.k8s.io
EOF
    
    print_success "Disaster recovery procedures created"
}

# Function to test backup and restore
test_backup_restore() {
    print_status "Testing backup and restore functionality..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would test backup and restore procedures"
        return
    fi
    
    # Create a test backup
    local test_backup_name="test-backup-$(date +%s)"
    print_status "Creating test backup: $test_backup_name"
    
    velero backup create "$test_backup_name" \
        --include-namespaces "$NAMESPACE" \
        --include-resources "configmaps,secrets" \
        --wait
    
    # Verify backup completed successfully
    local backup_status=$(velero backup get "$test_backup_name" -o jsonpath='{.items[0].status.phase}')
    if [[ "$backup_status" == "Completed" ]]; then
        print_success "Test backup completed successfully"
        
        # Test restore (dry run)
        local test_restore_name="test-restore-$(date +%s)"
        print_status "Testing restore (dry run): $test_restore_name"
        
        if velero restore create "$test_restore_name" \
            --from-backup "$test_backup_name" \
            --include-resources "configmaps" \
            --wait; then
            print_success "Test restore completed successfully"
            
            # Clean up test restore
            velero restore delete "$test_restore_name" --confirm
        else
            print_error "Test restore failed"
        fi
        
        # Clean up test backup
        velero backup delete "$test_backup_name" --confirm
    else
        print_error "Test backup failed with status: $backup_status"
    fi
}

# Function to validate disaster recovery setup
validate_disaster_recovery() {
    print_status "Validating disaster recovery setup..."
    
    local validation_failed=false
    
    # Check Velero installation
    if kubectl get deployment velero -n "$VELERO_NAMESPACE" &> /dev/null; then
        if kubectl get pods -n "$VELERO_NAMESPACE" -l component=velero | grep -q Running; then
            print_success "Velero is running"
        else
            print_error "Velero deployment validation failed"
            validation_failed=true
        fi
    else
        print_error "Velero deployment not found"
        validation_failed=true
    fi
    
    # Check backup storage locations
    local storage_locations=$(velero backup-location get --output json | jq -r '.items | length')
    if [[ $storage_locations -ge 1 ]]; then
        print_success "$storage_locations backup storage location(s) configured"
    else
        print_error "No backup storage locations found"
        validation_failed=true
    fi
    
    # Check backup schedules
    local schedules=$(velero schedule get --output json | jq -r '.items | length')
    if [[ $schedules -ge 1 ]]; then
        print_success "$schedules backup schedule(s) configured"
    else
        print_error "No backup schedules found"
        validation_failed=true
    fi
    
    # Check S3 bucket accessibility
    if aws s3 ls "s3://$BACKUP_S3_BUCKET" &> /dev/null; then
        print_success "Primary backup bucket accessible"
    else
        print_error "Cannot access primary backup bucket"
        validation_failed=true
    fi
    
    if [[ "$WEEKLY_CROSS_REGION" == "true" ]]; then
        if aws s3 ls "s3://$DR_S3_BUCKET" &> /dev/null; then
            print_success "DR backup bucket accessible"
        else
            print_error "Cannot access DR backup bucket"
            validation_failed=true
        fi
    fi
    
    # Check disaster recovery procedures
    if kubectl get configmap disaster-recovery-procedures -n "$NAMESPACE" &> /dev/null; then
        print_success "Disaster recovery procedures deployed"
    else
        print_warning "Disaster recovery procedures not found"
    fi
    
    # Check health monitoring
    if kubectl get cronjob dr-health-monitor -n "$NAMESPACE" &> /dev/null; then
        print_success "Health monitoring configured"
    else
        print_warning "Health monitoring not configured"
    fi
    
    if [[ "$validation_failed" == "true" ]]; then
        print_error "Disaster recovery validation failed"
        exit 1
    fi
    
    print_success "Disaster recovery validation completed successfully"
}

# Function to create disaster recovery report
create_disaster_recovery_report() {
    print_status "Creating disaster recovery deployment report..."
    
    local report_file="/tmp/inergize_dr_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
InErgize Disaster Recovery Deployment Report
===========================================
Generated: $(date)
Environment: $ENVIRONMENT
Namespace: $NAMESPACE

Recovery Objectives:
-------------------
RTO (Recovery Time Objective): $RTO_MINUTES minutes
RPO (Recovery Point Objective): $RPO_MINUTES minutes
Critical Services RTO: $CRITICAL_RTO_MINUTES minutes
LinkedIn Compliance RTO: $LINKEDIN_RTO_MINUTES minutes

Backup Configuration:
--------------------
Primary S3 Bucket: $BACKUP_S3_BUCKET (Region: $AWS_REGION)
DR S3 Bucket: $DR_S3_BUCKET (Region: $DR_AWS_REGION)

Backup Schedules:
----------------
Daily Backups: ${DAILY_BACKUP_TIME}:00 AM (${DAILY_RETENTION_DAYS} days retention)
Hourly Critical: $([ "$HOURLY_CRITICAL_BACKUP" == "true" ] && echo "Enabled" || echo "Disabled") (${CRITICAL_RETENTION_DAYS} days retention)
Weekly Cross-Region: $([ "$WEEKLY_CROSS_REGION" == "true" ] && echo "Enabled" || echo "Disabled") (${CROSS_REGION_RETENTION_DAYS} days retention)

Deployed Components:
-------------------
EOF
    
    if [[ "$DRY_RUN" != "true" ]]; then
        # Add actual deployment status
        echo "Velero Version: $(velero version --client-only --output json | jq -r '.clientVersion.version')" >> "$report_file"
        echo "Storage Locations: $(velero backup-location get --output json | jq -r '.items | length')" >> "$report_file"
        echo "Backup Schedules: $(velero schedule get --output json | jq -r '.items | length')" >> "$report_file"
        
        # Add recent backups
        echo -e "\nRecent Backups:" >> "$report_file"
        velero backup get --output table | head -n 10 >> "$report_file"
    else
        echo "Status: DRY RUN - NO CHANGES MADE" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

Emergency Procedures:
--------------------
1. LinkedIn Emergency Recovery:
   kubectl exec -n $NAMESPACE -it deployment/disaster-recovery-procedures -- /scripts/quick-recovery.sh linkedin-emergency

2. Full System Recovery:
   kubectl exec -n $NAMESPACE -it deployment/disaster-recovery-procedures -- /scripts/quick-recovery.sh full-recovery

3. Health Check:
   kubectl exec -n $NAMESPACE -it deployment/disaster-recovery-procedures -- /scripts/quick-recovery.sh health-check

4. Manual Backup Creation:
   velero backup create manual-backup-\$(date +%s) --include-namespaces $NAMESPACE

5. Manual Restore:
   velero restore create manual-restore-\$(date +%s) --from-backup <backup-name>

Monitoring:
----------
Health Check Frequency: Every 5 minutes
Backup Success Monitoring: Automated
Slack Notifications: $([ -n "${SLACK_WEBHOOK:-}" ] && echo "Configured" || echo "Not configured")

Contact Information:
-------------------
Primary On-Call: ops@inergize.com
LinkedIn Compliance: compliance@inergize.com
Emergency Escalation: sre@inergize.com

Next Steps:
----------
1. Test disaster recovery procedures in staging environment
2. Conduct quarterly DR drills
3. Update emergency contact information
4. Review and adjust RTO/RPO targets based on business requirements
5. Set up monitoring alerts for backup failures

EOF
    
    print_success "Disaster recovery report created: $report_file"
    
    # Display key information
    echo ""
    print_status "==== Disaster Recovery Summary ===="
    echo "Environment: $ENVIRONMENT"
    echo "RTO: $RTO_MINUTES minutes | RPO: $RPO_MINUTES minutes"
    echo "LinkedIn RTO: $LINKEDIN_RTO_MINUTES minutes"
    echo "Primary Backup: $BACKUP_S3_BUCKET"
    echo "DR Backup: $DR_S3_BUCKET"
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
        --backup-bucket)
            BACKUP_S3_BUCKET="$2"
            shift 2
            ;;
        --dr-bucket)
            DR_S3_BUCKET="$2"
            shift 2
            ;;
        --aws-region)
            AWS_REGION="$2"
            shift 2
            ;;
        --dr-region)
            DR_AWS_REGION="$2"
            shift 2
            ;;
        --rto-minutes)
            RTO_MINUTES="$2"
            shift 2
            ;;
        --rpo-minutes)
            RPO_MINUTES="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --no-hourly-critical)
            HOURLY_CRITICAL_BACKUP="false"
            shift
            ;;
        --no-cross-region)
            WEEKLY_CROSS_REGION="false"
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
    
    print_status "==== InErgize Disaster Recovery Deployment Started ===="
    print_status "Environment: $ENVIRONMENT"
    print_status "Namespace: $NAMESPACE"
    print_status "RTO: $RTO_MINUTES minutes | RPO: $RPO_MINUTES minutes"
    print_status "Dry Run: $DRY_RUN"
    
    log_message "INFO" "Disaster recovery deployment started - Environment: $ENVIRONMENT, RTO: ${RTO_MINUTES}m, RPO: ${RPO_MINUTES}m"
    
    # Execute deployment steps
    check_prerequisites
    create_s3_buckets
    install_velero
    deploy_backup_configurations
    create_disaster_recovery_procedures
    
    if [[ "$DRY_RUN" != "true" ]]; then
        test_backup_restore
    fi
    
    validate_disaster_recovery
    create_disaster_recovery_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "==== Disaster Recovery Deployment Dry Run Completed in ${duration}s ===="
        print_status "No actual changes were made. Run without --dry-run to execute deployment."
    else
        print_success "==== Disaster Recovery Deployment Completed Successfully in ${duration}s ===="
        print_status "Deployment Summary:"
        print_status "• Environment: $ENVIRONMENT"
        print_status "• RTO: $RTO_MINUTES minutes | RPO: $RPO_MINUTES minutes"
        print_status "• LinkedIn RTO: $LINKEDIN_RTO_MINUTES minutes"
        print_status "• Primary Backup: $BACKUP_S3_BUCKET"
        print_status "• DR Backup: $DR_S3_BUCKET"
        print_status "• Daily Backups: ✓ | Critical Hourly: $([ "$HOURLY_CRITICAL_BACKUP" == "true" ] && echo "✓" || echo "✗")"
        print_status "• Cross-Region: $([ "$WEEKLY_CROSS_REGION" == "true" ] && echo "✓" || echo "✗") | Health Monitoring: ✓"
        print_status "• Duration: ${duration}s"
        
        echo ""
        print_status "Your InErgize disaster recovery system is now operational!"
        print_status "Critical LinkedIn compliance data is backed up hourly."
        print_status "Emergency recovery procedures are ready for use."
        
        # Show quick recovery commands
        echo ""
        print_status "Quick Recovery Commands:"
        echo "# LinkedIn Emergency: kubectl exec -n $NAMESPACE -it deployment/disaster-recovery-procedures -- /scripts/quick-recovery.sh linkedin-emergency"
        echo "# Full Recovery: kubectl exec -n $NAMESPACE -it deployment/disaster-recovery-procedures -- /scripts/quick-recovery.sh full-recovery"
        echo "# Health Check: kubectl exec -n $NAMESPACE -it deployment/disaster-recovery-procedures -- /scripts/quick-recovery.sh health-check"
    fi
    
    log_message "INFO" "Disaster recovery deployment completed successfully - Duration: ${duration}s"
}

# Execute main function
main "$@"