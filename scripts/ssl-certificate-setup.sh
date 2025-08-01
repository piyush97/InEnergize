#!/bin/bash

# InErgize SSL/TLS Certificate Setup Script
# Production-grade certificate management with auto-renewal
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
CERT_DIR="/etc/ssl/inergize"
BACKUP_DIR="/var/backups/ssl"
LOG_FILE="/var/log/inergize/ssl-setup.log"

# Certificate configuration
DOMAIN="${DOMAIN:-inergize.com}"
SUBDOMAINS="${SUBDOMAINS:-api app grafana prometheus argocd}"
EMAIL="${EMAIL:-admin@inergize.com}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Certificate provider (letsencrypt or self-signed)
CERT_PROVIDER="${CERT_PROVIDER:-letsencrypt}"
DRY_RUN="${DRY_RUN:-false}"
FORCE_RENEWAL="${FORCE_RENEWAL:-false}"

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
InErgize SSL/TLS Certificate Setup Script

Usage: $0 [OPTIONS]

Options:
  --domain DOMAIN              Primary domain (default: inergize.com)
  --subdomains "sub1 sub2"     Space-separated subdomains (default: api app grafana prometheus argocd)
  --email EMAIL                Email for Let's Encrypt (default: admin@inergize.com)
  --environment ENV            Environment (production/staging/development)
  --provider PROVIDER          Certificate provider (letsencrypt/self-signed)
  --dry-run                    Test certificate request without actually requesting
  --force-renewal              Force certificate renewal even if valid
  --help                       Show this help message

Examples:
  $0                                                          # Setup with defaults
  $0 --domain example.com --email admin@example.com          # Custom domain and email
  $0 --provider self-signed --environment development        # Self-signed for development
  $0 --dry-run                                               # Test configuration

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking SSL setup prerequisites..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
    
    # Check required tools based on provider
    if [[ "$CERT_PROVIDER" == "letsencrypt" ]]; then
        if ! command -v certbot &> /dev/null; then
            print_status "Installing certbot..."
            if command -v apt-get &> /dev/null; then
                apt-get update
                apt-get install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare
            elif command -v yum &> /dev/null; then
                yum install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare
            else
                print_error "Cannot install certbot. Please install manually."
                exit 1
            fi
        fi
    else
        # Check for openssl for self-signed certificates
        if ! command -v openssl &> /dev/null; then
            print_error "OpenSSL is required for self-signed certificates"
            exit 1
        fi
    fi
    
    # Create necessary directories
    mkdir -p "$CERT_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Set proper permissions
    chmod 700 "$CERT_DIR"
    chmod 700 "$BACKUP_DIR"
    
    print_success "Prerequisites check completed"
}

# Function to backup existing certificates
backup_existing_certificates() {
    if [[ -d "$CERT_DIR" && "$(ls -A $CERT_DIR)" ]]; then
        print_status "Backing up existing certificates..."
        
        local backup_file="$BACKUP_DIR/ssl_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        tar -czf "$backup_file" -C "$CERT_DIR" .
        
        print_success "Certificates backed up to: $backup_file"
        log_message "INFO" "Certificates backed up to: $backup_file"
    fi
}

# Function to generate self-signed certificates
generate_self_signed_certificates() {
    print_status "Generating self-signed certificates..."
    
    local cert_file="$CERT_DIR/$DOMAIN.crt"
    local key_file="$CERT_DIR/$DOMAIN.key"
    local ca_file="$CERT_DIR/ca.crt"
    local ca_key_file="$CERT_DIR/ca.key"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would generate self-signed certificates for $DOMAIN"
        return
    fi
    
    # Generate CA private key
    openssl genrsa -out "$ca_key_file" 4096
    
    # Generate CA certificate
    openssl req -new -x509 -key "$ca_key_file" -sha256 -subj "/C=US/ST=CA/O=InErgize/CN=InErgize CA" -days 3650 -out "$ca_file"
    
    # Generate server private key
    openssl genrsa -out "$key_file" 4096
    
    # Create certificate signing request
    local csr_file="$CERT_DIR/$DOMAIN.csr"
    openssl req -new -key "$key_file" -out "$csr_file" -subj "/C=US/ST=CA/O=InErgize/CN=$DOMAIN"
    
    # Create extensions file for SAN
    local ext_file="$CERT_DIR/$DOMAIN.ext"
    cat > "$ext_file" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
EOF
    
    # Add subdomains to SAN
    local dns_counter=2
    for subdomain in $SUBDOMAINS; do
        echo "DNS.$dns_counter = $subdomain.$DOMAIN" >> "$ext_file"
        ((dns_counter++))
    done
    
    # Generate certificate
    openssl x509 -req -in "$csr_file" -CA "$ca_file" -CAkey "$ca_key_file" -CAcreateserial -out "$cert_file" -days 365 -sha256 -extfile "$ext_file"
    
    # Clean up temporary files
    rm -f "$csr_file" "$ext_file"
    
    # Set proper permissions
    chmod 600 "$key_file" "$ca_key_file"
    chmod 644 "$cert_file" "$ca_file"
    
    print_success "Self-signed certificates generated"
    log_message "INFO" "Self-signed certificates generated for $DOMAIN"
}

# Function to request Let's Encrypt certificates
request_letsencrypt_certificates() {
    print_status "Requesting Let's Encrypt certificates..."
    
    # Build domain list
    local domain_list="$DOMAIN"
    for subdomain in $SUBDOMAINS; do
        domain_list="$domain_list,$subdomain.$DOMAIN"
    done
    
    local certbot_args=(
        "certonly"
        "--non-interactive"
        "--agree-tos"
        "--email" "$EMAIL"
        "--domains" "$domain_list"
        "--cert-path" "$CERT_DIR/$DOMAIN.crt"
        "--key-path" "$CERT_DIR/$DOMAIN.key"
        "--fullchain-path" "$CERT_DIR/$DOMAIN-fullchain.crt"
        "--chain-path" "$CERT_DIR/$DOMAIN-chain.crt"
    )
    
    # Choose challenge method based on environment
    if command -v nginx &> /dev/null && systemctl is-active --quiet nginx; then
        certbot_args+=("--nginx")
        print_status "Using nginx plugin for certificate validation"
    elif [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        certbot_args+=("--dns-cloudflare" "--dns-cloudflare-credentials" "/etc/letsencrypt/cloudflare.ini")
        print_status "Using Cloudflare DNS challenge"
        
        # Create Cloudflare credentials file
        cat > "/etc/letsencrypt/cloudflare.ini" << EOF
dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN
EOF
        chmod 600 "/etc/letsencrypt/cloudflare.ini"
    else
        certbot_args+=("--standalone")
        print_status "Using standalone mode for certificate validation"
        print_warning "Make sure ports 80 and 443 are accessible from the internet"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        certbot_args+=("--dry-run")
        print_status "[DRY RUN] Testing certificate request"
    fi
    
    if [[ "$FORCE_RENEWAL" == "true" ]]; then
        certbot_args+=("--force-renewal")
        print_status "Forcing certificate renewal"
    fi
    
    # Execute certbot
    if certbot "${certbot_args[@]}"; then
        if [[ "$DRY_RUN" != "true" ]]; then
            # Copy certificates to our cert directory
            cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/$DOMAIN-fullchain.crt"
            cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/$DOMAIN.key"
            cp "/etc/letsencrypt/live/$DOMAIN/cert.pem" "$CERT_DIR/$DOMAIN.crt"
            cp "/etc/letsencrypt/live/$DOMAIN/chain.pem" "$CERT_DIR/$DOMAIN-chain.crt"
            
            # Set proper permissions
            chmod 600 "$CERT_DIR/$DOMAIN.key"
            chmod 644 "$CERT_DIR/$DOMAIN"*.crt
            
            print_success "Let's Encrypt certificates obtained"
            log_message "INFO" "Let's Encrypt certificates obtained for $DOMAIN"
        else
            print_success "Certificate request dry run completed successfully"
        fi
    else
        print_error "Failed to obtain Let's Encrypt certificates"
        exit 1
    fi
}

# Function to generate service-specific certificates
generate_service_certificates() {
    print_status "Generating service-specific certificates..."
    
    local services=("kong" "postgres" "timescale" "redis" "elasticsearch")
    
    for service in "${services[@]}"; do
        print_status "Generating certificate for $service..."
        
        local service_cert="$CERT_DIR/$service.crt"
        local service_key="$CERT_DIR/$service.key"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "[DRY RUN] Would generate certificate for $service"
            continue
        fi
        
        if [[ "$CERT_PROVIDER" == "letsencrypt" ]]; then
            # For Let's Encrypt, copy the main certificate
            cp "$CERT_DIR/$DOMAIN-fullchain.crt" "$service_cert"
            cp "$CERT_DIR/$DOMAIN.key" "$service_key"
        else
            # For self-signed, generate service-specific certificates
            openssl genrsa -out "$service_key" 2048
            
            openssl req -new -key "$service_key" -out "$CERT_DIR/$service.csr" -subj "/C=US/ST=CA/O=InErgize/CN=$service.inergize.local"
            
            openssl x509 -req -in "$CERT_DIR/$service.csr" -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial -out "$service_cert" -days 365 -sha256
            
            rm -f "$CERT_DIR/$service.csr"
        fi
        
        chmod 600 "$service_key"
        chmod 644 "$service_cert"
        
        print_success "Certificate generated for $service"
    done
}

# Function to setup certificate auto-renewal
setup_auto_renewal() {
    if [[ "$CERT_PROVIDER" != "letsencrypt" ]]; then
        print_status "Auto-renewal only available for Let's Encrypt certificates"
        return
    fi
    
    print_status "Setting up certificate auto-renewal..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would setup auto-renewal cron job"
        return
    fi
    
    # Create renewal script
    local renewal_script="/usr/local/bin/inergize-cert-renewal.sh"
    cat > "$renewal_script" << 'EOF'
#!/bin/bash
# InErgize Certificate Renewal Script

LOG_FILE="/var/log/inergize/cert-renewal.log"
CERT_DIR="/etc/ssl/inergize"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_message "Starting certificate renewal check"

# Renew certificates
if certbot renew --quiet; then
    log_message "Certificate renewal check completed successfully"
    
    # Copy renewed certificates
    if [[ -f "/etc/letsencrypt/live/inergize.com/fullchain.pem" ]]; then
        cp "/etc/letsencrypt/live/inergize.com/fullchain.pem" "$CERT_DIR/inergize.com-fullchain.crt"
        cp "/etc/letsencrypt/live/inergize.com/privkey.pem" "$CERT_DIR/inergize.com.key"
        cp "/etc/letsencrypt/live/inergize.com/cert.pem" "$CERT_DIR/inergize.com.crt"
        cp "/etc/letsencrypt/live/inergize.com/chain.pem" "$CERT_DIR/inergize.com-chain.crt"
        
        log_message "Certificates copied to InErgize cert directory"
        
        # Restart services that use certificates
        systemctl reload nginx || true
        kubectl rollout restart deployment/kong -n inergize-production || true
        
        log_message "Services restarted to use renewed certificates"
    fi
else
    log_message "Certificate renewal failed"
    exit 1
fi
EOF
    
    chmod +x "$renewal_script"
    
    # Create cron job for renewal (twice daily as recommended by Let's Encrypt)
    local cron_job="0 12,24 * * * $renewal_script"
    
    # Add to root crontab
    (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
    
    print_success "Auto-renewal setup completed"
    log_message "INFO" "Certificate auto-renewal configured"
}

# Function to validate certificates
validate_certificates() {
    print_status "Validating generated certificates..."
    
    local validation_failed=false
    
    # Check main certificate
    local cert_file="$CERT_DIR/$DOMAIN.crt"
    local key_file="$CERT_DIR/$DOMAIN.key"
    
    if [[ ! -f "$cert_file" ]]; then
        print_error "Main certificate not found: $cert_file"
        validation_failed=true
    elif [[ ! -f "$key_file" ]]; then
        print_error "Main private key not found: $key_file"
        validation_failed=true
    else
        # Check certificate validity
        if openssl x509 -in "$cert_file" -text -noout &> /dev/null; then
            local expiry_date=$(openssl x509 -in "$cert_file" -enddate -noout | cut -d= -f2)
            local days_until_expiry=$((($(date -d "$expiry_date" +%s) - $(date +%s)) / 86400))
            
            if [[ $days_until_expiry -lt 0 ]]; then
                print_error "Certificate has expired"
                validation_failed=true
            elif [[ $days_until_expiry -lt 30 ]]; then
                print_warning "Certificate expires in $days_until_expiry days"
            else
                print_success "Certificate is valid for $days_until_expiry days"
            fi
        else
            print_error "Certificate file is invalid"
            validation_failed=true
        fi
        
        # Check private key
        if openssl rsa -in "$key_file" -check -noout &> /dev/null; then
            print_success "Private key is valid"
        else
            print_error "Private key is invalid"
            validation_failed=true
        fi
        
        # Check certificate and key match
        local cert_modulus=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
        local key_modulus=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
        
        if [[ "$cert_modulus" == "$key_modulus" ]]; then
            print_success "Certificate and private key match"
        else
            print_error "Certificate and private key do not match"
            validation_failed=true
        fi
    fi
    
    # Check service certificates
    local services=("kong" "postgres" "timescale" "redis" "elasticsearch")
    for service in "${services[@]}"; do
        local service_cert="$CERT_DIR/$service.crt"
        local service_key="$CERT_DIR/$service.key"
        
        if [[ -f "$service_cert" && -f "$service_key" ]]; then
            if openssl x509 -in "$service_cert" -text -noout &> /dev/null; then
                print_success "$service certificate is valid"
            else
                print_error "$service certificate is invalid"
                validation_failed=true
            fi
        else
            print_warning "$service certificate not found (may not be required)"
        fi
    done
    
    if [[ "$validation_failed" == "true" ]]; then
        print_error "Certificate validation failed"
        exit 1
    fi
    
    print_success "Certificate validation completed successfully"
}

# Function to create Kubernetes secrets for certificates
create_kubernetes_secrets() {
    print_status "Creating Kubernetes secrets for certificates..."
    
    if ! command -v kubectl &> /dev/null; then
        print_warning "kubectl not found, skipping Kubernetes secret creation"
        return
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create Kubernetes secrets"
        return
    fi
    
    local namespace="inergize-production"
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Create TLS secret for main certificate
    if [[ -f "$CERT_DIR/$DOMAIN.crt" && -f "$CERT_DIR/$DOMAIN.key" ]]; then
        kubectl create secret tls inergize-tls-cert \
            --cert="$CERT_DIR/$DOMAIN.crt" \
            --key="$CERT_DIR/$DOMAIN.key" \
            --namespace="$namespace" \
            --dry-run=client -o yaml | kubectl apply -f -
        
        print_success "Main TLS secret created in Kubernetes"
    fi
    
    # Create secrets for service certificates
    local services=("kong" "postgres" "timescale" "redis" "elasticsearch")
    for service in "${services[@]}"; do
        local service_cert="$CERT_DIR/$service.crt"
        local service_key="$CERT_DIR/$service.key"
        
        if [[ -f "$service_cert" && -f "$service_key" ]]; then
            kubectl create secret tls "$service-tls-cert" \
                --cert="$service_cert" \
                --key="$service_key" \
                --namespace="$namespace" \
                --dry-run=client -o yaml | kubectl apply -f -
            
            print_success "$service TLS secret created in Kubernetes"
        fi
    done
}

# Function to create certificate summary report
create_certificate_report() {
    print_status "Creating certificate summary report..."
    
    local report_file="$BACKUP_DIR/certificate_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
InErgize SSL/TLS Certificate Report
==================================
Generated: $(date)
Environment: $ENVIRONMENT
Provider: $CERT_PROVIDER
Domain: $DOMAIN
Subdomains: $SUBDOMAINS

Certificate Details:
-------------------
EOF
    
    if [[ -f "$CERT_DIR/$DOMAIN.crt" ]]; then
        echo "Main Certificate:" >> "$report_file"
        openssl x509 -in "$CERT_DIR/$DOMAIN.crt" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:|DNS:)" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    echo "Certificate Files:" >> "$report_file"
    ls -la "$CERT_DIR"/ >> "$report_file"
    
    if [[ "$CERT_PROVIDER" == "letsencrypt" ]]; then
        echo -e "\nAuto-renewal: Enabled (runs twice daily)" >> "$report_file"
        echo "Next renewal check: $(date -d 'tomorrow 12:00')" >> "$report_file"
    else
        echo -e "\nAuto-renewal: Not applicable (self-signed certificates)" >> "$report_file"
    fi
    
    print_success "Certificate report created: $report_file"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --subdomains)
            SUBDOMAINS="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --provider)
            CERT_PROVIDER="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --force-renewal)
            FORCE_RENEWAL="true"
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
    
    print_status "==== InErgize SSL/TLS Certificate Setup Started ===="
    print_status "Domain: $DOMAIN"
    print_status "Subdomains: $SUBDOMAINS"
    print_status "Provider: $CERT_PROVIDER"
    print_status "Environment: $ENVIRONMENT"
    print_status "Dry Run: $DRY_RUN"
    
    log_message "INFO" "SSL certificate setup started - Domain: $DOMAIN, Provider: $CERT_PROVIDER, Environment: $ENVIRONMENT"
    
    # Execute setup steps
    check_prerequisites
    backup_existing_certificates
    
    if [[ "$CERT_PROVIDER" == "letsencrypt" ]]; then
        request_letsencrypt_certificates
        setup_auto_renewal
    else
        generate_self_signed_certificates
    fi
    
    generate_service_certificates
    validate_certificates
    create_kubernetes_secrets
    create_certificate_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "==== SSL Certificate Setup Dry Run Completed in ${duration}s ===="
        print_status "No actual changes were made. Run without --dry-run to execute setup."
    else
        print_success "==== SSL Certificate Setup Completed Successfully in ${duration}s ===="
        print_status "Setup Summary:"
        print_status "• Domain: $DOMAIN"
        print_status "• Provider: $CERT_PROVIDER"
        print_status "• Environment: $ENVIRONMENT"
        print_status "• Certificate Directory: $CERT_DIR"
        print_status "• Auto-renewal: $([ "$CERT_PROVIDER" == "letsencrypt" ] && echo "Enabled" || echo "N/A")"
        print_status "• Duration: ${duration}s"
        
        echo ""
        print_status "Certificate files created:"
        ls -la "$CERT_DIR"/ | grep -E '\.(crt|key)$'
    fi
    
    log_message "INFO" "SSL certificate setup completed successfully - Duration: ${duration}s"
}

# Execute main function
main "$@"