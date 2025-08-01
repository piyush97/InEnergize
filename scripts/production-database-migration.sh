#!/bin/bash

# InErgize Production Database Migration Script
# Comprehensive database setup and migration for production deployment
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
BACKUP_DIR="/var/backups/inergize"
MIGRATION_LOG="/var/log/inergize/migration.log"

# Database configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-inergize_production}"
POSTGRES_USER="${POSTGRES_USER:-inergize_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

TIMESCALE_HOST="${TIMESCALE_HOST:-localhost}"
TIMESCALE_PORT="${TIMESCALE_PORT:-5433}"
TIMESCALE_DB="${TIMESCALE_DB:-inergize_analytics}"
TIMESCALE_USER="${TIMESCALE_USER:-inergize_analytics_user}"
TIMESCALE_PASSWORD="${TIMESCALE_PASSWORD}"

# Migration settings
DRY_RUN="${DRY_RUN:-false}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
ENVIRONMENT="${ENVIRONMENT:-production}"

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
    echo "[$timestamp] [$level] $message" >> "$MIGRATION_LOG"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking migration prerequisites..."
    
    # Check required tools
    local required_tools=("psql" "pg_dump" "pg_restore" "createdb" "dropdb")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check if running as appropriate user
    if [[ "$ENVIRONMENT" == "production" && $(whoami) != "postgres" && $(whoami) != "root" ]]; then
        print_warning "Running as $(whoami). Consider running as postgres user for production"
    fi
    
    # Create backup directory if it doesn't exist
    if [[ ! -d "$BACKUP_DIR" ]]; then
        sudo mkdir -p "$BACKUP_DIR"
        sudo chown $(whoami):$(whoami) "$BACKUP_DIR"
    fi
    
    # Create log directory if it doesn't exist
    local log_dir=$(dirname "$MIGRATION_LOG")
    if [[ ! -d "$log_dir" ]]; then
        sudo mkdir -p "$log_dir"
        sudo chown $(whoami):$(whoami) "$log_dir"
    fi
    
    print_success "Prerequisites check completed"
}

# Function to validate database connections
validate_connections() {
    print_status "Validating database connections..."
    
    # Test PostgreSQL connection
    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c "SELECT 1;" &> /dev/null; then
        print_error "Cannot connect to PostgreSQL database"
        exit 1
    fi
    
    # Test TimescaleDB connection
    if ! PGPASSWORD="$TIMESCALE_PASSWORD" psql -h "$TIMESCALE_HOST" -p "$TIMESCALE_PORT" -U "$TIMESCALE_USER" -d postgres -c "SELECT 1;" &> /dev/null; then
        print_error "Cannot connect to TimescaleDB database"
        exit 1
    fi
    
    print_success "Database connections validated"
}

# Function to create backup before migration
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        print_status "Skipping backup creation"
        return
    fi
    
    print_status "Creating database backup before migration..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local postgres_backup="$BACKUP_DIR/postgres_backup_$timestamp.sql"
    local timescale_backup="$BACKUP_DIR/timescale_backup_$timestamp.sql"
    
    # Backup PostgreSQL
    print_status "Backing up PostgreSQL database..."
    if [[ "$DRY_RUN" != "true" ]]; then
        PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            --verbose \
            --clean \
            --if-exists \
            --create \
            --format=custom \
            --file="$postgres_backup"
        
        if [[ $? -eq 0 ]]; then
            print_success "PostgreSQL backup created: $postgres_backup"
            log_message "INFO" "PostgreSQL backup created: $postgres_backup"
        else
            print_error "PostgreSQL backup failed"
            exit 1
        fi
    else
        print_status "[DRY RUN] Would create PostgreSQL backup: $postgres_backup"
    fi
    
    # Backup TimescaleDB
    print_status "Backing up TimescaleDB database..."
    if [[ "$DRY_RUN" != "true" ]]; then
        PGPASSWORD="$TIMESCALE_PASSWORD" pg_dump \
            -h "$TIMESCALE_HOST" \
            -p "$TIMESCALE_PORT" \
            -U "$TIMESCALE_USER" \
            -d "$TIMESCALE_DB" \
            --verbose \
            --clean \
            --if-exists \
            --create \
            --format=custom \
            --file="$timescale_backup"
        
        if [[ $? -eq 0 ]]; then
            print_success "TimescaleDB backup created: $timescale_backup"
            log_message "INFO" "TimescaleDB backup created: $timescale_backup"
        else
            print_error "TimescaleDB backup failed"
            exit 1
        fi
    else
        print_status "[DRY RUN] Would create TimescaleDB backup: $timescale_backup"
    fi
}

# Function to check if databases exist and create them if needed
setup_databases() {
    print_status "Setting up production databases..."
    
    # Check if PostgreSQL database exists
    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -qw "$POSTGRES_DB"; then
        print_status "Creating PostgreSQL database: $POSTGRES_DB"
        if [[ "$DRY_RUN" != "true" ]]; then
            PGPASSWORD="$POSTGRES_PASSWORD" createdb \
                -h "$POSTGRES_HOST" \
                -p "$POSTGRES_PORT" \
                -U "$POSTGRES_USER" \
                "$POSTGRES_DB"
            print_success "PostgreSQL database created"
        else
            print_status "[DRY RUN] Would create PostgreSQL database: $POSTGRES_DB"
        fi
    else
        print_status "PostgreSQL database already exists: $POSTGRES_DB"
    fi
    
    # Check if TimescaleDB database exists
    if ! PGPASSWORD="$TIMESCALE_PASSWORD" psql -h "$TIMESCALE_HOST" -p "$TIMESCALE_PORT" -U "$TIMESCALE_USER" -lqt | cut -d \| -f 1 | grep -qw "$TIMESCALE_DB"; then
        print_status "Creating TimescaleDB database: $TIMESCALE_DB"
        if [[ "$DRY_RUN" != "true" ]]; then
            PGPASSWORD="$TIMESCALE_PASSWORD" createdb \
                -h "$TIMESCALE_HOST" \
                -p "$TIMESCALE_PORT" \
                -U "$TIMESCALE_USER" \
                "$TIMESCALE_DB"
            
            # Enable TimescaleDB extension
            PGPASSWORD="$TIMESCALE_PASSWORD" psql \
                -h "$TIMESCALE_HOST" \
                -p "$TIMESCALE_PORT" \
                -U "$TIMESCALE_USER" \
                -d "$TIMESCALE_DB" \
                -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
            
            print_success "TimescaleDB database created with extension"
        else
            print_status "[DRY RUN] Would create TimescaleDB database: $TIMESCALE_DB"
        fi
    else
        print_status "TimescaleDB database already exists: $TIMESCALE_DB"
    fi
}

# Function to run Prisma migrations for main database
run_prisma_migrations() {
    print_status "Running Prisma migrations for main database..."
    
    # Set DATABASE_URL for Prisma
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB?sslmode=require"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        cd "$PROJECT_ROOT/database"
        
        # Generate Prisma client
        print_status "Generating Prisma client..."
        npx prisma generate
        
        # Run migrations
        print_status "Applying Prisma migrations..."
        npx prisma migrate deploy
        
        # Run seeds if in development/staging
        if [[ "$ENVIRONMENT" != "production" ]]; then
            print_status "Running database seeds..."
            npx prisma db seed
        fi
        
        print_success "Prisma migrations completed"
        log_message "INFO" "Prisma migrations completed successfully"
    else
        print_status "[DRY RUN] Would run Prisma migrations"
    fi
}

# Function to run analytics schema migration
run_analytics_migration() {
    print_status "Running analytics schema migration..."
    
    local migration_file="$PROJECT_ROOT/database/migrations/002_product_analytics_schema.sql"
    
    if [[ ! -f "$migration_file" ]]; then
        print_error "Analytics migration file not found: $migration_file"
        exit 1
    fi
    
    if [[ "$DRY_RUN" != "true" ]]; then
        print_status "Creating analytics schema..."
        PGPASSWORD="$TIMESCALE_PASSWORD" psql \
            -h "$TIMESCALE_HOST" \
            -p "$TIMESCALE_PORT" \
            -U "$TIMESCALE_USER" \
            -d "$TIMESCALE_DB" \
            -c "CREATE SCHEMA IF NOT EXISTS analytics;"
        
        print_status "Applying analytics migration..."
        PGPASSWORD="$TIMESCALE_PASSWORD" psql \
            -h "$TIMESCALE_HOST" \
            -p "$TIMESCALE_PORT" \
            -U "$TIMESCALE_USER" \
            -d "$TIMESCALE_DB" \
            -f "$migration_file"
        
        print_success "Analytics migration completed"
        log_message "INFO" "Analytics migration completed successfully"
    else
        print_status "[DRY RUN] Would run analytics migration from: $migration_file"
    fi
}

# Function to optimize database performance
optimize_databases() {
    print_status "Optimizing database performance..."
    
    if [[ "$DRY_RUN" != "true" ]]; then
        # PostgreSQL optimizations
        print_status "Optimizing PostgreSQL..."
        PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            -c "VACUUM ANALYZE;"
        
        # TimescaleDB optimizations
        print_status "Optimizing TimescaleDB..."
        PGPASSWORD="$TIMESCALE_PASSWORD" psql \
            -h "$TIMESCALE_HOST" \
            -p "$TIMESCALE_PORT" \
            -U "$TIMESCALE_USER" \
            -d "$TIMESCALE_DB" \
            -c "VACUUM ANALYZE;"
        
        print_success "Database optimization completed"
    else
        print_status "[DRY RUN] Would optimize databases"
    fi
}

# Function to validate migration success
validate_migration() {
    print_status "Validating migration success..."
    
    local validation_failed=false
    
    # Check PostgreSQL tables
    print_status "Checking PostgreSQL schema..."
    local pg_table_count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
    
    if [[ "$pg_table_count" -lt 10 ]]; then
        print_error "PostgreSQL migration validation failed: expected at least 10 tables, found $pg_table_count"
        validation_failed=true
    else
        print_success "PostgreSQL validation passed: $pg_table_count tables found"
    fi
    
    # Check TimescaleDB hypertables
    print_status "Checking TimescaleDB hypertables..."
    local ts_hypertable_count=$(PGPASSWORD="$TIMESCALE_PASSWORD" psql \
        -h "$TIMESCALE_HOST" \
        -p "$TIMESCALE_PORT" \
        -U "$TIMESCALE_USER" \
        -d "$TIMESCALE_DB" \
        -t -c "SELECT COUNT(*) FROM timescaledb_information.hypertables;" | xargs)
    
    if [[ "$ts_hypertable_count" -lt 15 ]]; then
        print_error "TimescaleDB migration validation failed: expected at least 15 hypertables, found $ts_hypertable_count"
        validation_failed=true
    else
        print_success "TimescaleDB validation passed: $ts_hypertable_count hypertables found"
    fi
    
    # Check continuous aggregates
    print_status "Checking continuous aggregates..."
    local ca_count=$(PGPASSWORD="$TIMESCALE_PASSWORD" psql \
        -h "$TIMESCALE_HOST" \
        -p "$TIMESCALE_PORT" \
        -U "$TIMESCALE_USER" \
        -d "$TIMESCALE_DB" \
        -t -c "SELECT COUNT(*) FROM timescaledb_information.continuous_aggregates;" | xargs)
    
    if [[ "$ca_count" -lt 4 ]]; then
        print_error "Continuous aggregates validation failed: expected at least 4, found $ca_count"
        validation_failed=true
    else
        print_success "Continuous aggregates validation passed: $ca_count found"
    fi
    
    # Test database connectivity with applications
    print_status "Testing application database connectivity..."
    
    # Test PostgreSQL connection string
    local pg_conn_test=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -c "SELECT 'PostgreSQL connection test successful';" 2>/dev/null | grep "successful" || echo "failed")
    
    if [[ "$pg_conn_test" == "failed" ]]; then
        print_error "PostgreSQL application connection test failed"
        validation_failed=true
    else
        print_success "PostgreSQL application connection test passed"
    fi
    
    # Test TimescaleDB connection string
    local ts_conn_test=$(PGPASSWORD="$TIMESCALE_PASSWORD" psql \
        -h "$TIMESCALE_HOST" \
        -p "$TIMESCALE_PORT" \
        -U "$TIMESCALE_USER" \
        -d "$TIMESCALE_DB" \
        -c "SELECT 'TimescaleDB connection test successful';" 2>/dev/null | grep "successful" || echo "failed")
    
    if [[ "$ts_conn_test" == "failed" ]]; then
        print_error "TimescaleDB application connection test failed"
        validation_failed=true
    else
        print_success "TimescaleDB application connection test passed"
    fi
    
    if [[ "$validation_failed" == "true" ]]; then
        print_error "Migration validation failed"
        log_message "ERROR" "Migration validation failed"
        exit 1
    fi
    
    print_success "Migration validation completed successfully"
    log_message "INFO" "Migration validation completed successfully"
}

# Function to create post-migration report
create_migration_report() {
    print_status "Creating migration report..."
    
    local report_file="$BACKUP_DIR/migration_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
InErgize Production Database Migration Report
============================================
Migration Date: $(date)
Environment: $ENVIRONMENT
Dry Run: $DRY_RUN

Database Configuration:
----------------------
PostgreSQL Host: $POSTGRES_HOST:$POSTGRES_PORT
PostgreSQL Database: $POSTGRES_DB
PostgreSQL User: $POSTGRES_USER

TimescaleDB Host: $TIMESCALE_HOST:$TIMESCALE_PORT
TimescaleDB Database: $TIMESCALE_DB
TimescaleDB User: $TIMESCALE_USER

Migration Results:
-----------------
EOF
    
    if [[ "$DRY_RUN" != "true" ]]; then
        # Add PostgreSQL table count
        local pg_tables=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
        echo "PostgreSQL Tables: $pg_tables" >> "$report_file"
        
        # Add TimescaleDB hypertable count
        local ts_hypertables=$(PGPASSWORD="$TIMESCALE_PASSWORD" psql \
            -h "$TIMESCALE_HOST" \
            -p "$TIMESCALE_PORT" \
            -U "$TIMESCALE_USER" \
            -d "$TIMESCALE_DB" \
            -t -c "SELECT COUNT(*) FROM timescaledb_information.hypertables;" | xargs)
        echo "TimescaleDB Hypertables: $ts_hypertables" >> "$report_file"
        
        # Add continuous aggregates count
        local ca_count=$(PGPASSWORD="$TIMESCALE_PASSWORD" psql \
            -h "$TIMESCALE_HOST" \
            -p "$TIMESCALE_PORT" \
            -U "$TIMESCALE_USER" \
            -d "$TIMESCALE_DB" \
            -t -c "SELECT COUNT(*) FROM timescaledb_information.continuous_aggregates;" | xargs)
        echo "Continuous Aggregates: $ca_count" >> "$report_file"
    else
        echo "DRY RUN - No actual changes made" >> "$report_file"
    fi
    
    echo -e "\nMigration Status: SUCCESS" >> "$report_file"
    echo "Report Location: $report_file" >> "$report_file"
    
    print_success "Migration report created: $report_file"
}

# Function to show usage
show_usage() {
    cat << EOF
InErgize Production Database Migration Script

Usage: $0 [OPTIONS]

Options:
  --dry-run              Show what would be done without executing
  --skip-backup          Skip creating backup before migration
  --environment ENV      Target environment (default: production)
  --help                Show this help message

Environment Variables:
  POSTGRES_HOST         PostgreSQL host (default: localhost)
  POSTGRES_PORT         PostgreSQL port (default: 5432)
  POSTGRES_DB           PostgreSQL database name
  POSTGRES_USER         PostgreSQL username
  POSTGRES_PASSWORD     PostgreSQL password (required)
  
  TIMESCALE_HOST        TimescaleDB host (default: localhost)
  TIMESCALE_PORT        TimescaleDB port (default: 5433)
  TIMESCALE_DB          TimescaleDB database name
  TIMESCALE_USER        TimescaleDB username
  TIMESCALE_PASSWORD    TimescaleDB password (required)

Examples:
  $0                           # Run full production migration
  $0 --dry-run                 # Validate migration without changes
  $0 --skip-backup             # Skip backup creation
  $0 --environment staging     # Run on staging environment

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP="true"
            shift
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
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

# Validate required environment variables
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    print_error "POSTGRES_PASSWORD environment variable is required"
    exit 1
fi

if [[ -z "${TIMESCALE_PASSWORD:-}" ]]; then
    print_error "TIMESCALE_PASSWORD environment variable is required"
    exit 1
fi

# Main migration function
main() {
    local start_time=$(date +%s)
    
    print_status "==== InErgize Database Migration Started ===="
    print_status "Environment: $ENVIRONMENT"
    print_status "Dry Run: $DRY_RUN"
    
    log_message "INFO" "Database migration started - Environment: $ENVIRONMENT, Dry Run: $DRY_RUN"
    
    # Execute migration steps
    check_prerequisites
    validate_connections
    create_backup
    setup_databases
    run_prisma_migrations
    run_analytics_migration
    optimize_databases
    validate_migration
    create_migration_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "==== Database Migration Dry Run Completed in ${duration}s ===="
        print_status "No actual changes were made. Run without --dry-run to execute migration."
    else
        print_success "==== Database Migration Completed Successfully in ${duration}s ===="
        print_status "Migration Summary:"
        print_status "• Environment: $ENVIRONMENT"
        print_status "• PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
        print_status "• TimescaleDB: $TIMESCALE_HOST:$TIMESCALE_PORT/$TIMESCALE_DB"
        print_status "• Duration: ${duration}s"
        print_status "• Backup Created: $([ "$SKIP_BACKUP" == "true" ] && echo "No" || echo "Yes")"
    fi
    
    log_message "INFO" "Database migration completed successfully - Duration: ${duration}s"
}

# Execute main function
main "$@"