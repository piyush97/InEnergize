#!/bin/sh

# Container Vulnerability Scanning Script for InErgize
# Implements multi-layered security scanning approach

set -euo pipefail

# Configuration
SCAN_DIR="/app"
REPORT_DIR="/tmp/security-reports"
SEVERITY_THRESHOLD="HIGH"
MAX_VULNERABILITIES=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SECURITY-SCAN] $*"
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

# Create report directory
mkdir -p "$REPORT_DIR"

# 1. Package Vulnerability Scanning (if npm audit is available)
if command -v npm >/dev/null 2>&1 && [ -f "/app/package.json" ]; then
    log "Running npm audit for dependency vulnerabilities..."
    
    if npm audit --audit-level="$SEVERITY_THRESHOLD" --json > "$REPORT_DIR/npm-audit.json" 2>/dev/null; then
        success "npm audit completed successfully"
        
        # Check for vulnerabilities
        VULN_COUNT=$(cat "$REPORT_DIR/npm-audit.json" | grep -o '"high":[0-9]*' | cut -d: -f2 | head -1 || echo "0")
        CRITICAL_COUNT=$(cat "$REPORT_DIR/npm-audit.json" | grep -o '"critical":[0-9]*' | cut -d: -f2 | head -1 || echo "0")
        
        if [ "$VULN_COUNT" -gt "$MAX_VULNERABILITIES" ] || [ "$CRITICAL_COUNT" -gt 0 ]; then
            error "High/Critical vulnerabilities found: High=$VULN_COUNT, Critical=$CRITICAL_COUNT"
            cat "$REPORT_DIR/npm-audit.json"
            exit 1
        fi
    else
        warn "npm audit failed or found vulnerabilities"
    fi
else
    warn "npm not available or package.json not found, skipping dependency scan"
fi

# 2. File System Security Scan
log "Running file system security scan..."

# Check for sensitive files
SENSITIVE_FILES="
.env
.env.local
.env.production
id_rsa
id_dsa
id_ecdsa
id_ed25519
*.pem
*.key
*.p12
*.pfx
config.json
secrets.yml
"

FOUND_SENSITIVE=0
for pattern in $SENSITIVE_FILES; do
    if find "$SCAN_DIR" -name "$pattern" -type f 2>/dev/null | grep -q .; then
        error "Sensitive file found matching pattern: $pattern"
        find "$SCAN_DIR" -name "$pattern" -type f
        FOUND_SENSITIVE=1
    fi
done

if [ "$FOUND_SENSITIVE" -eq 1 ]; then
    error "Sensitive files detected in container"
    exit 1
fi

# 3. Permission Check
log "Checking file permissions..."

# Check for world-writable files
WORLD_WRITABLE=$(find "$SCAN_DIR" -type f -perm -002 2>/dev/null | wc -l)
if [ "$WORLD_WRITABLE" -gt 0 ]; then
    error "World-writable files found: $WORLD_WRITABLE"
    find "$SCAN_DIR" -type f -perm -002 2>/dev/null
    exit 1
fi

# Check for SUID/SGID files
SUID_FILES=$(find "$SCAN_DIR" -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | wc -l)
if [ "$SUID_FILES" -gt 0 ]; then
    warn "SUID/SGID files found: $SUID_FILES"
    find "$SCAN_DIR" -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null
fi

# 4. Configuration Security Check
log "Checking configuration security..."

# Check for hardcoded secrets in common files
HARDCODED_PATTERNS="
password=
secret=
key=
token=
api_key=
private_key=
"

HARDCODED_FOUND=0
for pattern in $HARDCODED_PATTERNS; do
    if find "$SCAN_DIR" -name "*.js" -o -name "*.ts" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" | \
       xargs grep -l "$pattern" 2>/dev/null | grep -q .; then
        warn "Potential hardcoded secret pattern found: $pattern"
        HARDCODED_FOUND=1
    fi
done

if [ "$HARDCODED_FOUND" -eq 1 ]; then
    warn "Potential hardcoded secrets detected - manual review required"
fi

# 5. Runtime Security Check
log "Checking runtime security configuration..."

# Check if running as root
if [ "$(id -u)" -eq 0 ]; then
    error "Container is running as root user"
    exit 1
fi

# Check for proper signal handling
if ! pgrep -f "dumb-init" >/dev/null 2>&1; then
    warn "dumb-init not detected - signal handling may be improper"
fi

# 6. Network Security Check
log "Checking network security..."

# Check for listening ports
LISTENING_PORTS=$(netstat -tuln 2>/dev/null | grep LISTEN | wc -l || echo "0")
log "Found $LISTENING_PORTS listening ports"

# Generate security report
cat > "$REPORT_DIR/security-summary.json" << EOF
{
  "scan_timestamp": "$(date -Iseconds)",
  "image_info": {
    "user": "$(whoami)",
    "uid": "$(id -u)",
    "gid": "$(id -g)"
  },
  "vulnerabilities": {
    "npm_high": ${VULN_COUNT:-0},
    "npm_critical": ${CRITICAL_COUNT:-0}
  },
  "file_security": {
    "sensitive_files": $FOUND_SENSITIVE,
    "world_writable": $WORLD_WRITABLE,
    "suid_files": $SUID_FILES,
    "hardcoded_secrets": $HARDCODED_FOUND
  },
  "runtime_security": {
    "running_as_root": $([ "$(id -u)" -eq 0 ] && echo "true" || echo "false"),
    "listening_ports": $LISTENING_PORTS
  },
  "scan_result": "$([ "$FOUND_SENSITIVE" -eq 0 ] && [ "$(id -u)" -ne 0 ] && echo "PASSED" || echo "FAILED")"
}
EOF

# Final report
if [ "$FOUND_SENSITIVE" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
    success "Security scan completed - NO CRITICAL ISSUES FOUND"
    cat "$REPORT_DIR/security-summary.json"
    exit 0
else
    error "Security scan completed - CRITICAL ISSUES FOUND"
    cat "$REPORT_DIR/security-summary.json"
    exit 1
fi