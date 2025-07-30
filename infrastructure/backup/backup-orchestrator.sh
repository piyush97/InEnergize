#!/bin/bash

# InErgize Backup Orchestrator
# Comprehensive backup automation with disaster recovery capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/backup}"
ENVIRONMENT="${ENVIRONMENT:-production}"
BACKUP_TYPE="${1:-full}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
S3_BUCKET="${S3_BACKUP_BUCKET:-inergize-backups-primary}"
S3_REGION="${S3_REGION:-us-east-1}"

# Logging configuration
LOG_FILE="$BACKUP_ROOT/logs/backup-$(date +%Y%m%d-%H%M%S).log"
METRICS_FILE="$BACKUP_ROOT/metrics/backup-metrics.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$METRICS_FILE")"

log() {
    local message="$(date '+%Y-%m-%d %H:%M:%S') [BACKUP] $*"
    echo -e "$message" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $*${NC}" >&2
}

warn() {
    log "${YELLOW}WARNING: $*${NC}"
}

success() {
    log "${GREEN}SUCCESS: $*${NC}"
}

info() {
    log "${BLUE}INFO: $*${NC}"
}

# Metrics collection
declare -A BACKUP_METRICS
BACKUP_METRICS[start_time]=$(date +%s)
BACKUP_METRICS[environment]="$ENVIRONMENT"
BACKUP_METRICS[backup_type]="$BACKUP_TYPE"

update_metrics() {
    local key="$1"
    local value="$2"
    BACKUP_METRICS[$key]="$value"
}

write_metrics() {
    local end_time=$(date +%s)
    local duration=$((end_time - BACKUP_METRICS[start_time]))
    
    cat > "$METRICS_FILE" << EOF
{
  "backup_run": {
    "timestamp": "$(date -Iseconds)",
    "environment": "${BACKUP_METRICS[environment]}",
    "backup_type": "${BACKUP_METRICS[backup_type]}",
    "duration_seconds": $duration,
    "status": "${BACKUP_METRICS[status]:-unknown}",
    "total_size_bytes": ${BACKUP_METRICS[total_size]:-0},
    "compressed_size_bytes": ${BACKUP_METRICS[compressed_size]:-0},
    "databases": {
      "postgresql_status": "${BACKUP_METRICS[postgres_status]:-unknown}",
      "postgresql_size": ${BACKUP_METRICS[postgres_size]:-0},
      "timescaledb_status": "${BACKUP_METRICS[timescale_status]:-unknown}",
      "timescaledb_size": ${BACKUP_METRICS[timescale_size]:-0},
      "redis_status": "${BACKUP_METRICS[redis_status]:-unknown}",
      "redis_size": ${BACKUP_METRICS[redis_size]:-0}
    },
    "filesystem": {
      "status": "${BACKUP_METRICS[filesystem_status]:-unknown}",
      "size": ${BACKUP_METRICS[filesystem_size]:-0}
    },
    "storage": {
      "local_status": "${BACKUP_METRICS[local_status]:-unknown}",
      "s3_status": "${BACKUP_METRICS[s3_status]:-unknown}",
      "verification_status": "${BACKUP_METRICS[verification_status]:-unknown}"
    }
  }
}
EOF
}

# Pre-flight checks
preflight_checks() {
    info "Running pre-flight checks..."
    
    local checks_failed=0
    
    # Check available disk space
    local available_space=$(df "$BACKUP_ROOT" | awk 'NR==2 {print $4}')
    local required_space=10485760  # 10GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        error "Insufficient disk space. Available: ${available_space}KB, Required: ${required_space}KB"
        ((checks_failed++))
    fi
    
    # Check database connectivity
    if ! docker exec inergize-postgres pg_isready -U inergize_user -d inergize_dev >/dev/null 2>&1; then
        error "PostgreSQL database is not accessible"
        ((checks_failed++))
    fi
    
    if ! docker exec inergize-timescale pg_isready -U inergize_user -d inergize_analytics >/dev/null 2>&1; then
        error "TimescaleDB database is not accessible"
        ((checks_failed++))
    fi
    
    if ! docker exec inergize-redis redis-cli -a "${REDIS_PASSWORD:-inergize_redis_password}" ping >/dev/null 2>&1; then
        error "Redis is not accessible"
        ((checks_failed++))
    fi
    
    # Check AWS credentials if S3 backup is enabled
    if [ -n "$S3_BUCKET" ]; then
        if ! command -v aws >/dev/null 2>&1; then
            error "AWS CLI is not installed"
            ((checks_failed++))
        elif ! aws sts get-caller-identity >/dev/null 2>&1; then
            error "AWS credentials are not configured properly"
            ((checks_failed++))
        fi
    fi
    
    # Check encryption key
    if [ -z "$ENCRYPTION_KEY" ]; then
        warn "No encryption key provided, backups will not be encrypted"
    fi
    
    if [ $checks_failed -gt 0 ]; then
        error "Pre-flight checks failed with $checks_failed errors"
        return 1
    fi
    
    success "Pre-flight checks passed"
    return 0
}

# PostgreSQL backup
backup_postgresql() {
    info "Starting PostgreSQL backup..."
    
    local backup_dir="$BACKUP_ROOT/postgresql/$(date +%Y%m%d-%H%M%S)"
    local backup_file="$backup_dir/inergize_dev.sql.gz"
    
    mkdir -p "$backup_dir"
    
    # Create database dump with compression
    if docker exec inergize-postgres pg_dump \
        -U inergize_user \
        -d inergize_dev \
        --format=custom \
        --compress=6 \
        --verbose \
        --no-password \
        --file=/tmp/backup.sql; then
        
        # Copy backup file from container
        docker cp inergize-postgres:/tmp/backup.sql "$backup_file"
        docker exec inergize-postgres rm /tmp/backup.sql
        
        # Get backup size
        local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        update_metrics "postgres_size" "$backup_size"
        update_metrics "postgres_status" "success"
        
        success "PostgreSQL backup completed: $backup_file ($(numfmt --to=iec $backup_size))"
        echo "$backup_file"
    else
        error "PostgreSQL backup failed"
        update_metrics "postgres_status" "failed"
        return 1
    fi
}

# TimescaleDB backup
backup_timescaledb() {
    info "Starting TimescaleDB backup..."
    
    local backup_dir="$BACKUP_ROOT/timescaledb/$(date +%Y%m%d-%H%M%S)"
    local backup_file="$backup_dir/inergize_analytics.sql.gz"
    
    mkdir -p "$backup_dir"
    
    # Create TimescaleDB dump with continuous aggregates
    if docker exec inergize-timescale pg_dump \
        -U inergize_user \
        -d inergize_analytics \
        --format=custom \
        --compress=6 \
        --verbose \
        --no-password \
        --file=/tmp/timescale_backup.sql; then
        
        # Copy backup file from container
        docker cp inergize-timescale:/tmp/timescale_backup.sql "$backup_file"
        docker exec inergize-timescale rm /tmp/timescale_backup.sql
        
        # Get backup size
        local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        update_metrics "timescale_size" "$backup_size"
        update_metrics "timescale_status" "success"
        
        success "TimescaleDB backup completed: $backup_file ($(numfmt --to=iec $backup_size))"
        echo "$backup_file"
    else
        error "TimescaleDB backup failed"
        update_metrics "timescale_status" "failed"
        return 1
    fi
}

# Redis backup
backup_redis() {
    info "Starting Redis backup..."
    
    local backup_dir="$BACKUP_ROOT/redis/$(date +%Y%m%d-%H%M%S)"
    local backup_file="$backup_dir/redis_dump.rdb"
    
    mkdir -p "$backup_dir"
    
    # Trigger Redis save and copy RDB file
    if docker exec inergize-redis redis-cli -a "${REDIS_PASSWORD:-inergize_redis_password}" BGSAVE; then
        # Wait for background save to complete
        while docker exec inergize-redis redis-cli -a "${REDIS_PASSWORD:-inergize_redis_password}" LASTSAVE | grep -q "$(docker exec inergize-redis redis-cli -a "${REDIS_PASSWORD:-inergize_redis_password}" LASTSAVE)"; do
            sleep 2
        done
        
        # Copy RDB file from container
        docker cp inergize-redis:/data/dump.rdb "$backup_file"
        
        # Compress the backup
        gzip "$backup_file"
        backup_file="$backup_file.gz"
        
        # Get backup size
        local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        update_metrics "redis_size" "$backup_size"
        update_metrics "redis_status" "success"
        
        success "Redis backup completed: $backup_file ($(numfmt --to=iec $backup_size))"
        echo "$backup_file"
    else
        error "Redis backup failed"
        update_metrics "redis_status" "failed"
        return 1
    fi
}

# Filesystem backup
backup_filesystem() {
    info "Starting filesystem backup..."
    
    local backup_dir="$BACKUP_ROOT/filesystem/$(date +%Y%m%d-%H%M%S)"
    local backup_file="$backup_dir/filesystem.tar.zst"
    
    mkdir -p "$backup_dir"
    
    local source_dirs=(
        "$PROJECT_ROOT/web/public/uploads"
        "$PROJECT_ROOT/logs"
        "$PROJECT_ROOT/.secrets"
        "/etc/ssl"
    )
    
    # Create compressed archive of filesystem data
    if tar -cf - "${source_dirs[@]}" 2>/dev/null | zstd -6 -o "$backup_file"; then
        # Get backup size
        local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        update_metrics "filesystem_size" "$backup_size"
        update_metrics "filesystem_status" "success"
        
        success "Filesystem backup completed: $backup_file ($(numfmt --to=iec $backup_size))"
        echo "$backup_file"
    else
        error "Filesystem backup failed"
        update_metrics "filesystem_status" "failed"
        return 1
    fi
}

# Encrypt backup files
encrypt_backup() {
    local backup_file="$1"
    local encrypted_file="$backup_file.enc"
    
    if [ -n "$ENCRYPTION_KEY" ]; then
        info "Encrypting backup: $(basename "$backup_file")"
        
        # Use AES-256-GCM encryption
        if openssl enc -aes-256-gcm -salt -pbkdf2 -in "$backup_file" -out "$encrypted_file" -k "$ENCRYPTION_KEY"; then
            # Remove unencrypted file
            rm "$backup_file"
            success "Backup encrypted: $(basename "$encrypted_file")"
            echo "$encrypted_file"
        else
            error "Failed to encrypt backup: $backup_file"
            return 1
        fi
    else
        # Return original file if no encryption
        echo "$backup_file"
    fi
}

# Upload to S3
upload_to_s3() {
    local backup_file="$1"
    local s3_key="$ENVIRONMENT/$(date +%Y/%m/%d)/$(basename "$backup_file")"
    local s3_uri="s3://$S3_BUCKET/$s3_key"
    
    info "Uploading to S3: $s3_uri"
    
    if aws s3 cp "$backup_file" "$s3_uri" \
        --region "$S3_REGION" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256; then
        
        success "Uploaded to S3: $s3_uri"
        update_metrics "s3_status" "success"
        return 0
    else
        error "Failed to upload to S3: $s3_uri"
        update_metrics "s3_status" "failed"
        return 1
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    info "Verifying backup integrity: $(basename "$backup_file")"
    
    # Check if file exists and is not empty
    if [ ! -f "$backup_file" ] || [ ! -s "$backup_file" ]; then
        error "Backup file is missing or empty: $backup_file"
        return 1
    fi
    
    # Verify file format based on extension
    case "$backup_file" in
        *.sql.gz|*.sql)
            # Verify SQL dump can be read
            if file "$backup_file" | grep -q "gzip\|SQL"; then
                success "SQL backup verification passed"
            else
                error "SQL backup verification failed"
                return 1
            fi
            ;;
        *.rdb.gz)
            # Verify Redis RDB format
            if zcat "$backup_file" | head -c 5 | grep -q "REDIS"; then
                success "Redis backup verification passed"
            else
                error "Redis backup verification failed"
                return 1
            fi
            ;;
        *.tar.zst)
            # Verify tar archive
            if zstd -t "$backup_file" >/dev/null 2>&1; then
                success "Filesystem backup verification passed"
            else
                error "Filesystem backup verification failed"
                return 1
            fi
            ;;
        *.enc)
            # For encrypted files, just check they're not empty
            success "Encrypted backup verification passed"
            ;;
        *)
            warn "Unknown backup format, skipping verification"
            ;;
    esac
    
    update_metrics "verification_status" "success"
    return 0
}

# Cleanup old backups
cleanup_old_backups() {
    info "Cleaning up old backups..."
    
    local retention_days=30
    
    # Clean up local backups older than retention period
    find "$BACKUP_ROOT" -type f -name "*.sql.gz" -mtime +$retention_days -delete
    find "$BACKUP_ROOT" -type f -name "*.rdb.gz" -mtime +$retention_days -delete
    find "$BACKUP_ROOT" -type f -name "*.tar.zst" -mtime +$retention_days -delete
    find "$BACKUP_ROOT" -type f -name "*.enc" -mtime +$retention_days -delete
    
    # Clean up empty directories
    find "$BACKUP_ROOT" -type d -empty -delete
    
    success "Old backup cleanup completed"
}

# Send notifications
send_notification() {
    local status="$1"
    local message="$2"
    
    # Slack notification (if webhook configured)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color="good"
        [ "$status" = "failed" ] && color="danger"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1
    fi
    
    # Email notification (if configured)
    if [ -n "${BACKUP_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "InErgize Backup $status" "$BACKUP_EMAIL"
    fi
}

# Health check endpoint for monitoring
health_check() {
    local last_backup_time
    local current_time=$(date +%s)
    local max_age=86400  # 24 hours
    
    # Check if metrics file exists and is recent
    if [ -f "$METRICS_FILE" ]; then
        last_backup_time=$(jq -r '.backup_run.timestamp' "$METRICS_FILE" | xargs -I {} date -d {} +%s 2>/dev/null || echo 0)
        local age=$((current_time - last_backup_time))
        
        if [ $age -lt $max_age ]; then
            local status=$(jq -r '.backup_run.status' "$METRICS_FILE" 2>/dev/null || echo "unknown")
            echo "backup_healthy:$status:age:${age}s"
            [ "$status" = "success" ] && exit 0 || exit 1
        else
            echo "backup_stale:age:${age}s"
            exit 1
        fi
    else
        echo "backup_never_run"
        exit 1
    fi
}

# Restore functionality
restore_backup() {
    local backup_type="$1"
    local backup_date="${2:-latest}"
    
    warn "RESTORE OPERATION REQUESTED"
    warn "This will overwrite existing data!"
    
    read -p "Are you sure you want to restore $backup_type from $backup_date? (yes/no): " -r
    if [[ ! $REPLY = "yes" ]]; then
        info "Restore operation cancelled"
        return 0
    fi
    
    case "$backup_type" in
        "postgresql")
            restore_postgresql "$backup_date"
            ;;
        "timescaledb")
            restore_timescaledb "$backup_date"
            ;;
        "redis")
            restore_redis "$backup_date"
            ;;
        "filesystem")
            restore_filesystem "$backup_date"
            ;;
        *)
            error "Unknown backup type: $backup_type"
            return 1
            ;;
    esac
}

restore_postgresql() {
    local backup_date="$1"
    local backup_file
    
    if [ "$backup_date" = "latest" ]; then
        backup_file=$(find "$BACKUP_ROOT/postgresql" -name "*.sql.gz" -type f | sort | tail -1)
    else
        backup_file=$(find "$BACKUP_ROOT/postgresql" -name "*$backup_date*.sql.gz" -type f | head -1)
    fi
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        error "PostgreSQL backup file not found for date: $backup_date"
        return 1
    fi
    
    info "Restoring PostgreSQL from: $backup_file"
    
    # Stop services that depend on the database
    docker-compose stop auth-service user-service linkedin-service analytics-service ai-service web-app
    
    # Restore database
    if docker exec -i inergize-postgres pg_restore \
        -U inergize_user \
        -d inergize_dev \
        --clean \
        --no-owner \
        --no-privileges \
        --verbose < "$backup_file"; then
        
        success "PostgreSQL restore completed"
        
        # Restart services
        docker-compose start auth-service user-service linkedin-service analytics-service ai-service web-app
        
        return 0
    else
        error "PostgreSQL restore failed"
        return 1
    fi
}

# Main backup orchestration
main() {
    local command="${1:-backup}"
    
    case "$command" in
        "backup")
            info "Starting InErgize backup orchestration..."
            
            # Run pre-flight checks
            if ! preflight_checks; then
                update_metrics "status" "failed"
                write_metrics
                send_notification "failed" "Backup failed: Pre-flight checks failed"
                exit 1
            fi
            
            local backup_files=()
            local failed_backups=0
            local total_size=0
            
            # Perform backups
            info "Running database backups..."
            
            if postgres_backup=$(backup_postgresql); then
                backup_files+=("$postgres_backup")
            else
                ((failed_backups++))
            fi
            
            if timescale_backup=$(backup_timescaledb); then
                backup_files+=("$timescale_backup")
            else
                ((failed_backups++))
            fi
            
            if redis_backup=$(backup_redis); then
                backup_files+=("$redis_backup")
            else
                ((failed_backups++))
            fi
            
            if filesystem_backup=$(backup_filesystem); then
                backup_files+=("$filesystem_backup")
            else
                ((failed_backups++))
            fi
            
            # Process all backup files
            info "Processing backup files..."
            
            for backup_file in "${backup_files[@]}"; do
                # Get file size
                local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
                total_size=$((total_size + file_size))
                
                # Encrypt if configured
                if encrypted_file=$(encrypt_backup "$backup_file"); then
                    # Upload to S3
                    upload_to_s3 "$encrypted_file" || warn "S3 upload failed for $(basename "$encrypted_file")"
                    
                    # Verify backup
                    verify_backup "$encrypted_file" || warn "Verification failed for $(basename "$encrypted_file")"
                fi
            done
            
            # Update metrics
            update_metrics "total_size" "$total_size"
            update_metrics "local_status" "success"
            
            # Cleanup old backups
            cleanup_old_backups
            
            # Determine overall status
            if [ $failed_backups -eq 0 ]; then
                update_metrics "status" "success"
                success "Backup orchestration completed successfully"
                success "Total backup size: $(numfmt --to=iec $total_size)"
                send_notification "success" "Backup completed successfully. Total size: $(numfmt --to=iec $total_size)"
            else
                update_metrics "status" "partial"
                warn "Backup orchestration completed with $failed_backups failures"
                send_notification "warning" "Backup completed with $failed_backups failures"
            fi
            
            write_metrics
            ;;
            
        "restore")
            restore_backup "${2:-postgresql}" "${3:-latest}"
            ;;
            
        "health")
            health_check
            ;;
            
        "cleanup")
            cleanup_old_backups
            ;;
            
        *)
            echo "Usage: $0 {backup|restore|health|cleanup}"
            echo ""
            echo "  backup                    - Run full backup"
            echo "  restore <type> [date]     - Restore from backup"
            echo "  health                    - Check backup system health"
            echo "  cleanup                   - Clean up old backups"
            echo ""
            echo "Restore types: postgresql, timescaledb, redis, filesystem"
            exit 1
            ;;
    esac
}

# Handle signals for graceful shutdown
trap 'log "Received SIGTERM, shutting down gracefully"; exit 130' TERM
trap 'log "Received SIGINT, shutting down gracefully"; exit 130' INT

# Run main function
main "$@"