#!/bin/bash

# InErgize Security Validation Script
# Comprehensive security validation for CI/CD pipeline

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-development}"
SECURITY_THRESHOLD="${SECURITY_THRESHOLD:-HIGH}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') [SECURITY-VAL] $*"
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

# Security validation functions
validate_linkedin_compliance() {
    info "Validating LinkedIn API compliance..."
    
    local compliance_file="$PROJECT_ROOT/services/linkedin-service/src/compliance/rate-limiter.ts"
    local validation_errors=0
    
    if [ ! -f "$compliance_file" ]; then
        error "LinkedIn compliance rate limiter not found"
        return 1
    fi
    
    # Check for ultra-conservative rate limits
    if ! grep -q "15.*day" "$compliance_file"; then
        error "LinkedIn daily connection limit not set to 15 (ultra-conservative)"
        ((validation_errors++))
    fi
    
    if ! grep -q "1.*minute" "$compliance_file"; then
        error "LinkedIn per-minute limit not set to 1 (ultra-conservative)"
        ((validation_errors++))
    fi
    
    # Check for health scoring system
    if ! grep -q "healthScore" "$compliance_file" || ! grep -q "40" "$compliance_file"; then
        error "LinkedIn health scoring system not properly implemented"
        ((validation_errors++))
    fi
    
    # Validate automation delay patterns
    local automation_file="$PROJECT_ROOT/services/linkedin-service/src/automation/automation-manager.ts"
    if [ -f "$automation_file" ]; then
        if ! grep -q "45.*180" "$automation_file"; then
            warn "LinkedIn automation delays should be 45-180 seconds for human-like behavior"
            ((validation_errors++))
        fi
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "LinkedIn compliance validation passed"
        return 0
    else
        error "LinkedIn compliance validation failed with $validation_errors issues"
        return 1
    fi
}

validate_gdpr_compliance() {
    info "Validating GDPR compliance..."
    
    local validation_errors=0
    
    # Check for data retention policies
    if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "dataRetention\|retention.*policy" >/dev/null 2>&1; then
        error "No data retention policies found"
        ((validation_errors++))
    fi
    
    # Check for consent management
    if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "consent\|gdpr" >/dev/null 2>&1; then
        warn "No explicit GDPR consent management found"
    fi
    
    # Check for data encryption
    if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "encrypt\|aes-256" >/dev/null 2>&1; then
        error "No data encryption implementation found"
        ((validation_errors++))
    fi
    
    # Check for right to be forgotten implementation
    if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "deleteUser\|rightToBeForgotten" >/dev/null 2>&1; then
        warn "No right to be forgotten implementation found"
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "GDPR compliance validation passed"
        return 0
    else
        error "GDPR compliance validation failed with $validation_errors issues"
        return 1
    fi
}

validate_soc2_controls() {
    info "Validating SOC 2 security controls..."
    
    local validation_errors=0
    
    # Access control validation
    local auth_service="$PROJECT_ROOT/services/auth-service"
    if [ -d "$auth_service" ]; then
        # Check for MFA implementation
        if ! find "$auth_service" -name "*.ts" | xargs grep -l "mfa\|totp\|2fa" >/dev/null 2>&1; then
            error "No MFA implementation found in auth service"
            ((validation_errors++))
        fi
        
        # Check for password strength requirements
        if ! find "$auth_service" -name "*.ts" | xargs grep -l "passwordStrength\|password.*complexity" >/dev/null 2>&1; then
            warn "No password strength validation found"
        fi
        
        # Check for session management
        if ! find "$auth_service" -name "*.ts" | xargs grep -l "session.*timeout\|jwt.*expire" >/dev/null 2>&1; then
            error "No proper session management found"
            ((validation_errors++))
        fi
    fi
    
    # Audit logging validation
    if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "audit.*log\|security.*event" >/dev/null 2>&1; then
        error "No audit logging implementation found"
        ((validation_errors++))
    fi
    
    # Encryption in transit validation
    if ! find "$PROJECT_ROOT" -name "*.yml" -o -name "*.yaml" | xargs grep -l "https\|tls.*1\\.3\|ssl" >/dev/null 2>&1; then
        error "No HTTPS/TLS configuration found"
        ((validation_errors++))
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "SOC 2 controls validation passed"
        return 0
    else
        error "SOC 2 controls validation failed with $validation_errors issues"
        return 1
    fi
}

validate_pci_compliance() {
    info "Validating PCI DSS compliance (if applicable)..."
    
    local validation_errors=0
    
    # Check if payment processing is implemented
    if find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "payment\|credit.*card\|stripe\|paypal" >/dev/null 2>&1; then
        info "Payment processing detected, validating PCI DSS compliance..."
        
        # Check for PCI DSS requirements
        if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "tokenization\|vault" >/dev/null 2>&1; then
            error "No tokenization or vaulting found for payment data"
            ((validation_errors++))
        fi
        
        # Check for secure transmission
        if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "encrypt.*payment\|secure.*transmission" >/dev/null 2>&1; then
            error "No secure payment transmission implementation found"
            ((validation_errors++))
        fi
        
        # Check for access controls on payment data
        if ! find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | xargs grep -l "payment.*access\|cardholder.*data" >/dev/null 2>&1; then
            warn "No specific access controls for payment data found"
        fi
    else
        info "No payment processing detected, skipping PCI DSS validation"
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "PCI DSS compliance validation passed"
        return 0
    else
        error "PCI DSS compliance validation failed with $validation_errors issues"
        return 1
    fi
}

validate_security_headers() {
    info "Validating security headers implementation..."
    
    local validation_errors=0
    
    # Check for security headers in Kong configuration
    local kong_config="$PROJECT_ROOT/infrastructure/kong"
    if [ -d "$kong_config" ]; then
        if ! find "$kong_config" -name "*.yml" | xargs grep -l "X-Content-Type-Options\|X-Frame-Options\|X-XSS-Protection" >/dev/null 2>&1; then
            error "No security headers configuration found in Kong"
            ((validation_errors++))
        fi
        
        if ! find "$kong_config" -name "*.yml" | xargs grep -l "Strict-Transport-Security" >/dev/null 2>&1; then
            error "No HSTS header configuration found"
            ((validation_errors++))
        fi
        
        if ! find "$kong_config" -name "*.yml" | xargs grep -l "Content-Security-Policy" >/dev/null 2>&1; then
            warn "No Content Security Policy found"
        fi
    fi
    
    # Check for security headers in web application
    local web_config="$PROJECT_ROOT/web"
    if [ -d "$web_config" ]; then
        if ! find "$web_config" -name "*.ts" -o -name "*.js" | xargs grep -l "security.*headers\|helmet" >/dev/null 2>&1; then
            warn "No security headers middleware found in web application"
        fi
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "Security headers validation passed"
        return 0
    else
        error "Security headers validation failed with $validation_errors issues"
        return 1
    fi
}

validate_container_security() {
    info "Validating container security configuration..."
    
    local validation_errors=0
    
    # Check Dockerfile security
    find "$PROJECT_ROOT" -name "Dockerfile" -o -name "*.dockerfile" | while read -r dockerfile; do
        info "Checking Dockerfile: $dockerfile"
        
        # Check for non-root user
        if ! grep -q "USER.*[^0]" "$dockerfile"; then
            error "Dockerfile $dockerfile does not specify non-root user"
            ((validation_errors++))
        fi
        
        # Check for specific base image tags (no :latest)
        if grep -q ":latest" "$dockerfile"; then
            warn "Dockerfile $dockerfile uses :latest tag (not recommended for production)"
        fi
        
        # Check for security options
        local compose_file="$PROJECT_ROOT/docker-compose.yml"
        if [ -f "$compose_file" ]; then
            local service_name=$(basename "$(dirname "$dockerfile")")
            if ! grep -A 10 "$service_name:" "$compose_file" | grep -q "no-new-privileges"; then
                warn "Service $service_name does not have no-new-privileges security option"
            fi
        fi
    done
    
    # Check Docker Compose security
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        if ! grep -q "no-new-privileges" "$PROJECT_ROOT/docker-compose.yml"; then
            error "No security options found in docker-compose.yml"
            ((validation_errors++))
        fi
        
        if grep -q "privileged.*true" "$PROJECT_ROOT/docker-compose.yml"; then
            error "Privileged containers found in docker-compose.yml"
            ((validation_errors++))
        fi
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "Container security validation passed"
        return 0
    else
        error "Container security validation failed with $validation_errors issues"
        return 1
    fi
}

validate_secrets_management() {
    info "Validating secrets management..."
    
    local validation_errors=0
    
    # Check for hardcoded secrets
    if find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" -o -name "*.yml" -o -name "*.yaml" | \
       xargs grep -l "password.*=.*['\"].*['\"]" >/dev/null 2>&1; then
        error "Potential hardcoded passwords found"
        ((validation_errors++))
    fi
    
    if find "$PROJECT_ROOT" -name "*.ts" -o -name "*.js" | \
       xargs grep -l "api.*key.*=.*['\"].*['\"]" >/dev/null 2>&1; then
        error "Potential hardcoded API keys found"
        ((validation_errors++))
    fi
    
    # Check for .env files in git
    if find "$PROJECT_ROOT" -name ".env*" -not -path "*/.gitignore" | grep -v ".env.example" >/dev/null 2>&1; then
        warn "Environment files found (ensure they're in .gitignore)"
    fi
    
    # Check for secret management implementation
    if [ -f "$PROJECT_ROOT/infrastructure/secrets/secret-manager.ts" ]; then
        success "Secret management system found"
    else
        warn "No centralized secret management system found"
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "Secrets management validation passed"
        return 0
    else
        error "Secrets management validation failed with $validation_errors issues"
        return 1
    fi
}

validate_network_security() {
    info "Validating network security configuration..."
    
    local validation_errors=0
    
    # Check for network segmentation
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        if ! grep -q "networks:" "$PROJECT_ROOT/docker-compose.yml"; then
            warn "No custom networks defined in docker-compose.yml"
        fi
        
        # Check for exposed ports
        if grep -q "0\\.0\\.0\\.0:" "$PROJECT_ROOT/docker-compose.yml"; then
            warn "Services exposed on all interfaces (0.0.0.0)"
        fi
    fi
    
    # Check for firewall configuration
    if [ -f "$PROJECT_ROOT/infrastructure/security/firewall-rules.sh" ]; then
        success "Firewall configuration found"
    else
        warn "No firewall configuration found"
    fi
    
    # Check for TLS configuration
    if [ -f "$PROJECT_ROOT/infrastructure/security/tls-config.yml" ]; then
        if grep -q "TLSv1\\.3\|1\\.3" "$PROJECT_ROOT/infrastructure/security/tls-config.yml"; then
            success "TLS 1.3 configuration found"
        else
            warn "TLS 1.3 not configured (recommended for security)"
        fi
    else
        warn "No TLS configuration found"
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "Network security validation passed"
        return 0
    else
        error "Network security validation failed with $validation_errors issues"
        return 1
    fi
}

generate_security_report() {
    local report_file="$PROJECT_ROOT/security-validation-report.json"
    
    info "Generating security validation report..."
    
    cat > "$report_file" << EOF
{
  "security_validation_report": {
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "security_threshold": "$SECURITY_THRESHOLD",
    "project_root": "$PROJECT_ROOT",
    "validation_results": {
      "linkedin_compliance": "$linkedin_compliance_result",
      "gdpr_compliance": "$gdpr_compliance_result",
      "soc2_controls": "$soc2_controls_result",
      "pci_compliance": "$pci_compliance_result",
      "security_headers": "$security_headers_result",
      "container_security": "$container_security_result",
      "secrets_management": "$secrets_management_result",
      "network_security": "$network_security_result"
    },
    "overall_status": "$overall_status",
    "recommendations": [
      "Implement automated secret rotation",
      "Add runtime security monitoring",
      "Enable container image scanning in CI/CD",
      "Configure security event alerting",
      "Regular security assessments"
    ]
  }
}
EOF
    
    success "Security validation report generated: $report_file"
}

# Main execution
main() {
    info "Starting InErgize security validation..."
    
    local overall_exit_code=0
    
    # Run all validation checks
    linkedin_compliance_result="UNKNOWN"
    if validate_linkedin_compliance; then
        linkedin_compliance_result="PASSED"
    else
        linkedin_compliance_result="FAILED"
        overall_exit_code=1
    fi
    
    gdpr_compliance_result="UNKNOWN"
    if validate_gdpr_compliance; then
        gdpr_compliance_result="PASSED"
    else
        gdpr_compliance_result="FAILED"
        overall_exit_code=1
    fi
    
    soc2_controls_result="UNKNOWN"
    if validate_soc2_controls; then
        soc2_controls_result="PASSED"
    else
        soc2_controls_result="FAILED"
        overall_exit_code=1
    fi
    
    pci_compliance_result="UNKNOWN"
    if validate_pci_compliance; then
        pci_compliance_result="PASSED"
    else
        pci_compliance_result="FAILED"
        overall_exit_code=1
    fi
    
    security_headers_result="UNKNOWN"
    if validate_security_headers; then
        security_headers_result="PASSED"
    else
        security_headers_result="FAILED"
        overall_exit_code=1
    fi
    
    container_security_result="UNKNOWN"
    if validate_container_security; then
        container_security_result="PASSED"
    else
        container_security_result="FAILED"
        overall_exit_code=1
    fi
    
    secrets_management_result="UNKNOWN"
    if validate_secrets_management; then
        secrets_management_result="PASSED"
    else
        secrets_management_result="FAILED"
        overall_exit_code=1
    fi
    
    network_security_result="UNKNOWN"
    if validate_network_security; then
        network_security_result="PASSED"
    else
        network_security_result="FAILED"
        overall_exit_code=1
    fi
    
    # Determine overall status
    if [ $overall_exit_code -eq 0 ]; then
        overall_status="PASSED"
        success "All security validations passed!"
    else
        overall_status="FAILED"
        error "Some security validations failed!"
    fi
    
    # Generate report
    generate_security_report
    
    exit $overall_exit_code
}

# Run main function
main "$@"