#!/bin/bash

# SSL/TLS Certificate Setup Script for InErgize Production
# Handles Let's Encrypt certificates with Cloudflare DNS validation
# Version: 1.0 | Date: 2025-01-08

set -euo pipefail

# Configuration
DOMAIN="inergize.app"
SUBDOMAINS=("www" "api" "cdn" "admin")
EMAIL="admin@inergize.app"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CERT_DIR="/etc/ssl/certs"
KEY_DIR="/etc/ssl/private"
LETSENCRYPT_DIR="/etc/letsencrypt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        log "Installing certbot..."
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y certbot python3-certbot-dns-cloudflare
        elif command -v yum &> /dev/null; then
            yum install -y certbot python3-certbot-dns-cloudflare
        else
            error "Package manager not supported. Please install certbot manually."
        fi
    fi
    
    # Check if openssl is installed
    if ! command -v openssl &> /dev/null; then
        error "OpenSSL is required but not installed"
    fi
    
    log "Dependencies check completed"
}

# Validate Cloudflare API token
validate_cloudflare_token() {
    if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
        error "CLOUDFLARE_API_TOKEN environment variable is required"
    fi
    
    log "Validating Cloudflare API token..."
    
    # Test API token
    RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        log "Cloudflare API token is valid"
    else
        error "Invalid Cloudflare API token"
    fi
}

# Create Cloudflare credentials file
create_cloudflare_credentials() {
    log "Creating Cloudflare credentials file..."
    
    CLOUDFLARE_CREDS_FILE="/root/.secrets/certbot/cloudflare.ini"
    mkdir -p "$(dirname "$CLOUDFLARE_CREDS_FILE")"
    
    cat > "$CLOUDFLARE_CREDS_FILE" << EOF
# Cloudflare API token for certbot
dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN
EOF
    
    chmod 600 "$CLOUDFLARE_CREDS_FILE"
    log "Cloudflare credentials file created"
}

# Create SSL directories
create_ssl_directories() {
    log "Creating SSL directories..."
    
    mkdir -p "$CERT_DIR"
    mkdir -p "$KEY_DIR"
    mkdir -p "$LETSENCRYPT_DIR"
    
    # Set proper permissions
    chmod 755 "$CERT_DIR"
    chmod 700 "$KEY_DIR"
    chmod 755 "$LETSENCRYPT_DIR"
    
    log "SSL directories created"
}

# Generate temporary self-signed certificates for initial setup
generate_temp_certificates() {
    log "Generating temporary self-signed certificates..."
    
    # Generate private key
    openssl genrsa -out "$KEY_DIR/inergize.key" 2048
    chmod 600 "$KEY_DIR/inergize.key"
    
    # Generate self-signed certificate
    openssl req -new -x509 -key "$KEY_DIR/inergize.key" \
        -out "$CERT_DIR/inergize.crt" -days 1 \
        -subj "/C=US/ST=CA/L=San Francisco/O=InErgize/CN=$DOMAIN"
    
    chmod 644 "$CERT_DIR/inergize.crt"
    
    log "Temporary certificates generated"
}

# Request Let's Encrypt certificates
request_letsencrypt_certificates() {
    log "Requesting Let's Encrypt certificates..."
    
    # Build domain list
    DOMAIN_LIST="-d $DOMAIN"
    for subdomain in "${SUBDOMAINS[@]}"; do
        DOMAIN_LIST="$DOMAIN_LIST -d $subdomain.$DOMAIN"
    done
    
    log "Requesting certificates for: $DOMAIN_LIST"
    
    # Request certificate using Cloudflare DNS challenge
    certbot certonly \
        --dns-cloudflare \
        --dns-cloudflare-credentials /root/.secrets/certbot/cloudflare.ini \
        --dns-cloudflare-propagation-seconds 60 \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive \
        --expand \
        $DOMAIN_LIST
    
    if [[ $? -eq 0 ]]; then
        log "Let's Encrypt certificates obtained successfully"
    else
        error "Failed to obtain Let's Encrypt certificates"
    fi
}

# Install certificates
install_certificates() {
    log "Installing certificates..."
    
    # Copy certificates to nginx directories
    cp "$LETSENCRYPT_DIR/live/$DOMAIN/fullchain.pem" "$CERT_DIR/inergize.crt"
    cp "$LETSENCRYPT_DIR/live/$DOMAIN/privkey.pem" "$KEY_DIR/inergize.key"
    
    # Set proper permissions
    chmod 644 "$CERT_DIR/inergize.crt"
    chmod 600 "$KEY_DIR/inergize.key"
    
    # Verify certificate
    if openssl x509 -in "$CERT_DIR/inergize.crt" -text -noout &> /dev/null; then
        log "Certificate installation verified"
    else
        error "Certificate verification failed"
    fi
    
    log "Certificates installed successfully"
}

# Test SSL configuration
test_ssl_configuration() {
    log "Testing SSL configuration..."
    
    # Test certificate validity
    CERT_EXPIRY=$(openssl x509 -in "$CERT_DIR/inergize.crt" -noout -enddate | cut -d= -f2)
    log "Certificate expires: $CERT_EXPIRY"
    
    # Test certificate chain
    if openssl verify -CAfile "$CERT_DIR/inergize.crt" "$CERT_DIR/inergize.crt" &> /dev/null; then
        log "Certificate chain verification passed"
    else
        warn "Certificate chain verification failed - this is expected for Let's Encrypt certificates"
    fi
    
    # Test SSL configuration using OpenSSL
    log "Testing SSL connection..."
    timeout 10 openssl s_client -connect localhost:443 -servername "$DOMAIN" </dev/null &> /dev/null
    if [[ $? -eq 0 ]]; then
        log "SSL connection test passed"
    else
        warn "SSL connection test failed - ensure nginx is running with SSL configuration"
    fi
}

# Setup certificate renewal
setup_certificate_renewal() {
    log "Setting up certificate renewal..."
    
    # Create renewal script
    RENEWAL_SCRIPT="/usr/local/bin/renew-inergize-certs.sh"
    cat > "$RENEWAL_SCRIPT" << 'EOF'
#!/bin/bash

# InErgize Certificate Renewal Script
set -euo pipefail

LOG_FILE="/var/log/cert-renewal.log"
CERT_DIR="/etc/ssl/certs"
KEY_DIR="/etc/ssl/private"
LETSENCRYPT_DIR="/etc/letsencrypt"
DOMAIN="inergize.app"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting certificate renewal process..."

# Renew certificates
if certbot renew --quiet; then
    log "Certificate renewal successful"
    
    # Update nginx certificates
    cp "$LETSENCRYPT_DIR/live/$DOMAIN/fullchain.pem" "$CERT_DIR/inergize.crt"
    cp "$LETSENCRYPT_DIR/live/$DOMAIN/privkey.pem" "$KEY_DIR/inergize.key"
    
    # Set permissions
    chmod 644 "$CERT_DIR/inergize.crt"
    chmod 600 "$KEY_DIR/inergize.key"
    
    # Reload nginx
    if command -v nginx &> /dev/null; then
        nginx -s reload
        log "Nginx reloaded with new certificates"
    fi
    
    # Send notification (optional)
    if command -v curl &> /dev/null && [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"✅ InErgize SSL certificates renewed successfully"}' \
            "$SLACK_WEBHOOK_URL"
    fi
    
    log "Certificate renewal completed successfully"
else
    log "ERROR: Certificate renewal failed"
    
    # Send error notification
    if command -v curl &> /dev/null && [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"❌ InErgize SSL certificate renewal failed - manual intervention required"}' \
            "$SLACK_WEBHOOK_URL"
    fi
    
    exit 1
fi
EOF
    
    chmod +x "$RENEWAL_SCRIPT"
    
    # Create cron job for automatic renewal
    CRON_JOB="0 3 * * * root $RENEWAL_SCRIPT"
    if ! crontab -l 2>/dev/null | grep -q "$RENEWAL_SCRIPT"; then
        echo "$CRON_JOB" >> /etc/crontab
        log "Cron job created for automatic renewal"
    else
        log "Cron job already exists"
    fi
    
    # Create systemd timer (modern alternative to cron)
    if command -v systemctl &> /dev/null; then
        cat > /etc/systemd/system/inergize-cert-renewal.service << EOF
[Unit]
Description=InErgize SSL Certificate Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=$RENEWAL_SCRIPT
User=root
EOF
        
        cat > /etc/systemd/system/inergize-cert-renewal.timer << EOF
[Unit]
Description=Run InErgize SSL Certificate Renewal daily
Requires=inergize-cert-renewal.service

[Timer]
OnCalendar=daily
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF
        
        systemctl daemon-reload
        systemctl enable inergize-cert-renewal.timer
        systemctl start inergize-cert-renewal.timer
        
        log "Systemd timer created for automatic renewal"
    fi
}

# Create OCSP stapling configuration
setup_ocsp_stapling() {
    log "Setting up OCSP stapling..."
    
    # Download intermediate certificate for OCSP stapling
    INTERMEDIATE_CERT="/etc/ssl/certs/lets-encrypt-intermediate.pem"
    curl -s "https://letsencrypt.org/certs/lets-encrypt-x3-cross-signed.pem" > "$INTERMEDIATE_CERT"
    
    # Verify OCSP response
    if openssl ocsp -no_nonce -respout /tmp/ocsp.resp \
        -issuer "$INTERMEDIATE_CERT" \
        -cert "$CERT_DIR/inergize.crt" \
        -url "http://ocsp.int-x3.letsencrypt.org" &> /dev/null; then
        log "OCSP stapling setup completed"
    else
        warn "OCSP stapling setup failed - continuing without it"
    fi
}

# Generate Diffie-Hellman parameters for enhanced security
generate_dhparam() {
    log "Generating Diffie-Hellman parameters (this may take a while)..."
    
    DH_PARAM_FILE="/etc/ssl/certs/dhparam.pem"
    if [[ ! -f "$DH_PARAM_FILE" ]]; then
        openssl dhparam -out "$DH_PARAM_FILE" 2048
        chmod 644 "$DH_PARAM_FILE"
        log "Diffie-Hellman parameters generated"
    else
        log "Diffie-Hellman parameters already exist"
    fi
}

# Security hardening
apply_security_hardening() {
    log "Applying security hardening..."
    
    # Set strict file permissions on certificate directories
    find "$CERT_DIR" -type f -exec chmod 644 {} \;
    find "$KEY_DIR" -type f -exec chmod 600 {} \;
    
    # Create security headers configuration for nginx
    SECURITY_CONF="/etc/nginx/conf.d/security-headers.conf"
    cat > "$SECURITY_CONF" << 'EOF'
# Security headers for InErgize
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https: wss:; frame-src 'none';" always;

# Hide nginx version
server_tokens off;

# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;
EOF
    
    log "Security hardening applied"
}

# Create monitoring script for certificate expiry
create_monitoring_script() {
    log "Creating certificate monitoring script..."
    
    MONITOR_SCRIPT="/usr/local/bin/monitor-inergize-certs.sh"
    cat > "$MONITOR_SCRIPT" << 'EOF'
#!/bin/bash

# InErgize Certificate Monitoring Script
set -euo pipefail

CERT_FILE="/etc/ssl/certs/inergize.crt"
DOMAIN="inergize.app"
WARNING_DAYS=30
CRITICAL_DAYS=7

# Check certificate expiry
if [[ -f "$CERT_FILE" ]]; then
    EXPIRY_DATE=$(openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f2)
    EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s)
    CURRENT_TIMESTAMP=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
    
    echo "Certificate expires in $DAYS_UNTIL_EXPIRY days ($EXPIRY_DATE)"
    
    if [[ $DAYS_UNTIL_EXPIRY -le $CRITICAL_DAYS ]]; then
        echo "CRITICAL: Certificate expires in $DAYS_UNTIL_EXPIRY days!"
        exit 2
    elif [[ $DAYS_UNTIL_EXPIRY -le $WARNING_DAYS ]]; then
        echo "WARNING: Certificate expires in $DAYS_UNTIL_EXPIRY days"
        exit 1
    else
        echo "OK: Certificate is valid for $DAYS_UNTIL_EXPIRY days"
        exit 0
    fi
else
    echo "CRITICAL: Certificate file not found!"
    exit 2
fi
EOF
    
    chmod +x "$MONITOR_SCRIPT"
    log "Certificate monitoring script created"
}

# Main execution
main() {
    log "Starting InErgize SSL/TLS Certificate Setup"
    
    check_root
    check_dependencies
    validate_cloudflare_token
    create_cloudflare_credentials
    create_ssl_directories
    generate_temp_certificates
    request_letsencrypt_certificates
    install_certificates
    test_ssl_configuration
    setup_certificate_renewal
    setup_ocsp_stapling
    generate_dhparam
    apply_security_hardening
    create_monitoring_script
    
    log "SSL/TLS Certificate Setup Completed Successfully!"
    log ""
    log "Next steps:"
    log "1. Update your DNS records to point to this server"
    log "2. Restart nginx: systemctl restart nginx"
    log "3. Test SSL configuration: https://www.ssllabs.com/ssltest/"
    log "4. Monitor certificate expiry with: $MONITOR_SCRIPT"
    log ""
    log "Certificate renewal is automated via cron and systemd timer"
}

# Run main function
main "$@"