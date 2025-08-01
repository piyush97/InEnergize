#!/bin/bash

# InErgize Production Security Hardening Script
# Comprehensive security setup for LinkedIn optimization platform
# Version: 1.0 | Date: 2025-01-08

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/inergize-security-hardening.log"
BACKUP_DIR="/etc/inergize/security-backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    log "Created backup directory: $BACKUP_DIR"
}

# System hardening
harden_system() {
    log "Starting system hardening..."
    
    # Update system packages
    log "Updating system packages..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get upgrade -y
        apt-get autoremove -y && apt-get autoclean
    elif command -v yum &> /dev/null; then
        yum update -y && yum clean all
    fi
    
    # Install security tools
    log "Installing security tools..."
    if command -v apt-get &> /dev/null; then
        apt-get install -y \
            fail2ban \
            ufw \
            lynis \
            rkhunter \
            chkrootkit \
            aide \
            unattended-upgrades \
            logwatch \
            psad \
            clamav \
            clamav-daemon
    elif command -v yum &> /dev/null; then
        yum install -y \
            fail2ban \
            firewalld \
            aide \
            rkhunter \
            chkrootkit \
            yum-cron \
            logwatch \
            psad \
            clamav \
            clamav-update
    fi
    
    log "System hardening completed"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        # Ubuntu/Debian - UFW
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        
        # Allow essential services
        ufw allow 22/tcp    # SSH
        ufw allow 80/tcp    # HTTP
        ufw allow 443/tcp   # HTTPS
        ufw allow 8080/tcp  # NGINX status
        
        # Allow internal network access for services
        ufw allow from 172.16.0.0/12 to any port 5432  # PostgreSQL
        ufw allow from 172.16.0.0/12 to any port 6379  # Redis
        ufw allow from 172.16.0.0/12 to any port 9090  # Prometheus
        ufw allow from 172.16.0.0/12 to any port 3001  # Grafana
        
        # Rate limiting for SSH
        ufw limit ssh
        
        # Enable firewall
        ufw --force enable
        
        log "UFW firewall configured"
        
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS/RHEL - FirewallD
        systemctl enable firewalld
        systemctl start firewalld
        
        # Configure zones
        firewall-cmd --set-default-zone=public
        
        # Allow essential services
        firewall-cmd --permanent --zone=public --add-service=ssh
        firewall-cmd --permanent --zone=public --add-service=http
        firewall-cmd --permanent --zone=public --add-service=https
        
        # Allow internal services
        firewall-cmd --permanent --zone=internal --add-port=5432/tcp  # PostgreSQL
        firewall-cmd --permanent --zone=internal --add-port=6379/tcp  # Redis
        firewall-cmd --permanent --zone=internal --add-port=9090/tcp  # Prometheus
        
        # Add internal networks
        firewall-cmd --permanent --zone=internal --add-source=172.16.0.0/12
        
        # Apply changes
        firewall-cmd --reload
        
        log "FirewallD configured"
    fi
}

# Configure Fail2Ban
configure_fail2ban() {
    log "Configuring Fail2Ban..."
    
    # Backup original configuration
    cp /etc/fail2ban/jail.conf "$BACKUP_DIR/jail.conf.backup" 2>/dev/null || true
    
    # Create custom jail configuration
    cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
# Ban IP for 24 hours after 5 failed attempts within 10 minutes
bantime = 86400
findtime = 600
maxretry = 5
backend = systemd
banaction = iptables-multiport
protocol = tcp
chain = INPUT
action = %(action_mwl)s

# Email notifications
destemail = security@inergize.app
sendername = InErgize-Fail2Ban
sender = fail2ban@inergize.app

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 600
bantime = 7200

[nginx-botsearch]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400

[postfix-sasl]
enabled = true
port = smtp,465,submission
logpath = /var/log/mail.log
maxretry = 3

[docker-auth]
enabled = true
port = 2376
logpath = /var/log/docker.log
maxretry = 3

[inergize-api]
enabled = true
port = 3000,8000
logpath = /var/log/inergize/api.log
maxretry = 10
findtime = 300
bantime = 3600
EOF

    # Create custom filter for InErgize API
    cat > /etc/fail2ban/filter.d/inergize-api.conf <<EOF
[Definition]
failregex = ^.*\[ERROR\].*Authentication failed for IP <HOST>.*$
            ^.*\[ERROR\].*Rate limit exceeded for IP <HOST>.*$
            ^.*\[ERROR\].*Suspicious activity from IP <HOST>.*$
ignoreregex =
EOF

    # Restart and enable Fail2Ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    log "Fail2Ban configured"
}

# Secure SSH configuration
secure_ssh() {
    log "Securing SSH configuration..."
    
    # Backup original SSH config
    cp /etc/ssh/sshd_config "$BACKUP_DIR/sshd_config.backup"
    
    # Apply secure SSH configuration
    cat > /etc/ssh/sshd_config <<EOF
# InErgize Secure SSH Configuration

# Protocol and Port
Protocol 2
Port 22

# Authentication
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes

# Encryption
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,hmac-sha2-256,hmac-sha2-512
KexAlgorithms curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512,diffie-hellman-group14-sha256

# Security Settings
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30
MaxAuthTries 3
MaxSessions 2
MaxStartups 10:30:60

# Logging
SyslogFacility AUTH
LogLevel VERBOSE

# Features
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitTunnel no
PermitUserEnvironment no
PrintMotd no
PrintLastLog yes
TCPKeepAlive yes
Compression no

# Banner
Banner /etc/ssh/banner

# Allow specific users (adjust as needed)
AllowUsers deploy inergize-admin

# Host-based authentication
HostbasedAuthentication no
IgnoreRhosts yes
EOF

    # Create SSH banner
    cat > /etc/ssh/banner <<EOF
********************************************************************************
*                                                                              *
*                       AUTHORIZED ACCESS ONLY                                *
*                                                                              *
*   This system is for the exclusive use of authorized InErgize personnel.    *
*   Unauthorized access is prohibited and will be prosecuted to the full      *
*   extent of the law. All activities are monitored and recorded.             *
*                                                                              *
********************************************************************************
EOF

    # Restart SSH service
    systemctl restart sshd
    
    log "SSH secured"
}

# Kernel hardening
harden_kernel() {
    log "Hardening kernel parameters..."
    
    # Backup original sysctl configuration
    cp /etc/sysctl.conf "$BACKUP_DIR/sysctl.conf.backup" 2>/dev/null || true
    
    # Apply kernel hardening
    cat > /etc/sysctl.d/99-inergize-security.conf <<EOF
# InErgize Kernel Security Hardening

# Network Security
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# IPv6 Security
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Memory Protection
kernel.exec-shield = 1
kernel.randomize_va_space = 2
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1

# File System Security
fs.suid_dumpable = 0
fs.protected_hardlinks = 1
fs.protected_symlinks = 1

# Performance and DoS Protection
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1800
net.ipv4.tcp_keepalive_probes = 7
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_tw_reuse = 1

# Disable unused network protocols
net.ipv4.conf.all.mc_forwarding = 0
net.ipv4.conf.default.mc_forwarding = 0
net.ipv6.conf.all.disable_ipv6 = 1
EOF

    # Apply changes
    sysctl -p /etc/sysctl.d/99-inergize-security.conf
    
    log "Kernel hardened"
}

# File system hardening
harden_filesystem() {
    log "Hardening file system..."
    
    # Set proper permissions on critical files
    chmod 600 /etc/passwd-
    chmod 600 /etc/shadow-
    chmod 600 /etc/group-
    chmod 600 /etc/gshadow-
    chmod 644 /etc/passwd
    chmod 600 /etc/shadow
    chmod 644 /etc/group
    chmod 600 /etc/gshadow
    
    # Secure mount points in /etc/fstab
    if ! grep -q "nodev" /etc/fstab; then
        warn "Consider adding nodev, nosuid, noexec options to /etc/fstab mount points"
    fi
    
    # Set umask for better default permissions
    echo "umask 027" >> /etc/bash.bashrc
    echo "umask 027" >> /etc/profile
    
    # Remove unnecessary setuid/setgid binaries
    find / -type f \( -perm -4000 -o -perm -2000 \) -exec ls -la {} \; 2>/dev/null | \
        grep -E "(games|mail|news|uucp)" | \
        awk '{print $9}' | \
        xargs -r chmod -s
    
    log "File system hardened"
}

# Configure automatic security updates
configure_auto_updates() {
    log "Configuring automatic security updates..."
    
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
        
        cat > /etc/apt/apt.conf.d/50unattended-upgrades <<EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

Unattended-Upgrade::Package-Blacklist {
};

Unattended-Upgrade::DevRelease "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";

Unattended-Upgrade::Mail "security@inergize.app";
Unattended-Upgrade::MailOnlyOnError "true";
EOF
        
        systemctl enable unattended-upgrades
        
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        systemctl enable yum-cron
        sed -i 's/apply_updates = no/apply_updates = yes/' /etc/yum/yum-cron.conf
        sed -i 's/email_to = root/email_to = security@inergize.app/' /etc/yum/yum-cron.conf
    fi
    
    log "Automatic security updates configured"
}

# Install and configure intrusion detection
configure_intrusion_detection() {
    log "Configuring intrusion detection..."
    
    # Configure AIDE (Advanced Intrusion Detection Environment)
    if command -v aide &> /dev/null; then
        # Initialize AIDE database
        aide --init
        mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db
        
        # Create AIDE check script
        cat > /usr/local/bin/aide-check.sh <<'EOF'
#!/bin/bash
LOG_FILE="/var/log/aide-check.log"
REPORT_FILE="/tmp/aide-report.txt"

echo "[$(date)] Starting AIDE integrity check..." >> "$LOG_FILE"

if aide --check > "$REPORT_FILE" 2>&1; then
    echo "[$(date)] AIDE check completed successfully" >> "$LOG_FILE"
else
    echo "[$(date)] AIDE detected changes!" >> "$LOG_FILE"
    cat "$REPORT_FILE" >> "$LOG_FILE"
    
    # Send alert email if configured
    if command -v mail &> /dev/null; then
        mail -s "AIDE Alert: File system changes detected on $(hostname)" \
             security@inergize.app < "$REPORT_FILE"
    fi
fi

rm -f "$REPORT_FILE"
EOF
        chmod +x /usr/local/bin/aide-check.sh
        
        # Schedule daily AIDE checks
        echo "0 2 * * * root /usr/local/bin/aide-check.sh" >> /etc/crontab
    fi
    
    # Configure RKHunter (Rootkit Hunter)
    if command -v rkhunter &> /dev/null; then
        rkhunter --update
        rkhunter --propupd
        
        # Schedule weekly rootkit scans
        echo "0 3 * * 0 root /usr/bin/rkhunter --cronjob --update --quiet" >> /etc/crontab
    fi
    
    log "Intrusion detection configured"
}

# Configure log monitoring
configure_log_monitoring() {
    log "Configuring log monitoring..."
    
    # Configure logwatch
    if command -v logwatch &> /dev/null; then
        cat > /etc/logwatch/conf/logwatch.conf <<EOF
LogDir = /var/log
TmpDir = /var/cache/logwatch
MailTo = security@inergize.app
MailFrom = logwatch@inergize.app
Print = No
Save = /var/cache/logwatch
Range = yesterday
Detail = Med
Service = All
mailer = "/usr/sbin/sendmail -t"
EOF
        
        # Schedule daily logwatch reports
        echo "0 4 * * * root /usr/sbin/logwatch --output mail" >> /etc/crontab
    fi
    
    # Configure rsyslog for centralized logging
    cat >> /etc/rsyslog.conf <<EOF

# InErgize custom logging rules
\$ModLoad imfile

# Application logs
\$InputFileName /var/log/inergize/app.log
\$InputFileTag inergize-app:
\$InputFileStateFile stat-inergize-app
\$InputFileSeverity info
\$InputFileFacility local0
\$InputRunFileMonitor

# Security logs
auth,authpriv.*                 /var/log/auth.log
*.*;auth,authpriv.none          -/var/log/syslog
daemon.notice                   -/var/log/daemon.log
kern.*                          -/var/log/kern.log
mail.*                          -/var/log/mail.log
user.*                          -/var/log/user.log

# Emergency messages to all users
*.emerg                         :omusrmsg:*

# Send critical messages to remote syslog (if configured)
# *.crit                        @@remote-syslog-server:514
EOF
    
    systemctl restart rsyslog
    
    log "Log monitoring configured"
}

# Install and configure ClamAV antivirus
configure_antivirus() {
    log "Configuring ClamAV antivirus..."
    
    if command -v clamscan &> /dev/null; then
        # Update virus definitions
        freshclam
        
        # Configure automatic updates
        cat > /etc/clamav/freshclam.conf <<EOF
DatabaseDirectory /var/lib/clamav
UpdateLogFile /var/log/clamav/freshclam.log
LogFileMaxSize 2M
LogTime yes
Foreground no
Debug no
MaxAttempts 5
DatabaseOwner clamav
AllowSupplementaryGroups no
DNSDatabaseInfo current.cvd.clamav.net
DatabaseMirror db.local.clamav.net
DatabaseMirror database.clamav.net
MaxChecks 24
Checks 2
Bytecode yes
EOF
        
        # Create virus scan script
        cat > /usr/local/bin/clamav-scan.sh <<'EOF'
#!/bin/bash
SCAN_LOG="/var/log/clamav/scan.log"
QUARANTINE_DIR="/var/quarantine"

mkdir -p "$QUARANTINE_DIR"

echo "[$(date)] Starting ClamAV system scan..." >> "$SCAN_LOG"

# Scan critical directories
clamscan -r --infected --remove=yes --log="$SCAN_LOG" \
    /home /var/www /tmp /var/tmp /usr/local/bin

if [ $? -eq 1 ]; then
    echo "[$(date)] Malware detected and quarantined!" >> "$SCAN_LOG"
    
    # Send alert
    if command -v mail &> /dev/null; then
        echo "ClamAV detected malware on $(hostname). Check $SCAN_LOG for details." | \
        mail -s "SECURITY ALERT: Malware detected" security@inergize.app
    fi
fi

echo "[$(date)] ClamAV scan completed" >> "$SCAN_LOG"
EOF
        chmod +x /usr/local/bin/clamav-scan.sh
        
        # Schedule daily scans
        echo "0 1 * * * root /usr/local/bin/clamav-scan.sh" >> /etc/crontab
        
        # Start ClamAV daemon
        systemctl enable clamav-daemon
        systemctl start clamav-daemon
    fi
    
    log "ClamAV antivirus configured"
}

# Create security monitoring dashboard
create_security_dashboard() {
    log "Creating security monitoring dashboard..."
    
    # Create security status script
    cat > /usr/local/bin/security-status.sh <<'EOF'
#!/bin/bash

echo "=== InErgize Security Status ==="
echo "Generated: $(date)"
echo ""

echo "=== System Information ==="
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime -p)"
echo "Kernel: $(uname -r)"
echo ""

echo "=== Firewall Status ==="
if command -v ufw &> /dev/null; then
    ufw status numbered
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --list-all
fi
echo ""

echo "=== Fail2Ban Status ==="
if command -v fail2ban-client &> /dev/null; then
    fail2ban-client status
    echo ""
    for jail in $(fail2ban-client status | grep "Jail list:" | cut -d: -f2 | tr ',' '\n' | tr -d ' '); do
        echo "=== $jail jail ==="
        fail2ban-client status "$jail"
        echo ""
    done
fi

echo "=== Security Updates ==="
if command -v apt &> /dev/null; then
    apt list --upgradable 2>/dev/null | grep -i security | wc -l
elif command -v yum &> /dev/null; then
    yum --security check-update 2>/dev/null | grep -c "needed for security"
fi
echo ""

echo "=== Recent Authentication Failures ==="
journalctl -u ssh --since="24 hours ago" | grep -i "failed\|failure" | tail -5
echo ""

echo "=== Disk Usage ==="
df -h | grep -E '^/dev/'
echo ""

echo "=== Memory Usage ==="
free -h
echo ""

echo "=== Network Connections ==="
ss -tuln | head -20
echo ""

echo "=== Process Summary ==="
ps aux --sort=-%cpu | head -10
EOF
    chmod +x /usr/local/bin/security-status.sh
    
    log "Security monitoring dashboard created"
}

# Configure security incident response
configure_incident_response() {
    log "Configuring security incident response..."
    
    # Create incident response script
    cat > /usr/local/bin/security-incident-response.sh <<'EOF'
#!/bin/bash

INCIDENT_LOG="/var/log/security-incidents.log"
INCIDENT_DIR="/var/log/incidents/$(date +%Y%m%d_%H%M%S)"

# Create incident directory
mkdir -p "$INCIDENT_DIR"

# Log incident
echo "[$(date)] SECURITY INCIDENT DETECTED: $1" >> "$INCIDENT_LOG"

# Gather forensic data
echo "Gathering forensic data..."

# System state
ps aux > "$INCIDENT_DIR/processes.txt"
ss -tuln > "$INCIDENT_DIR/network.txt"
last -n 50 > "$INCIDENT_DIR/last_logins.txt"
w > "$INCIDENT_DIR/current_users.txt"
df -h > "$INCIDENT_DIR/disk_usage.txt"
free -h > "$INCIDENT_DIR/memory.txt"
uname -a > "$INCIDENT_DIR/system_info.txt"

# Recent logs
journalctl --since="1 hour ago" > "$INCIDENT_DIR/recent_logs.txt"
tail -1000 /var/log/auth.log > "$INCIDENT_DIR/auth_logs.txt" 2>/dev/null || true
tail -1000 /var/log/nginx/access.log > "$INCIDENT_DIR/nginx_access.txt" 2>/dev/null || true
tail -1000 /var/log/nginx/error.log > "$INCIDENT_DIR/nginx_error.txt" 2>/dev/null || true

# Fail2Ban status
if command -v fail2ban-client &> /dev/null; then
    fail2ban-client status > "$INCIDENT_DIR/fail2ban_status.txt"
fi

# Create incident report
cat > "$INCIDENT_DIR/incident_report.md" <<EOL
# Security Incident Report

**Date/Time:** $(date)
**Incident Type:** $1
**Hostname:** $(hostname)
**IP Address:** $(hostname -I)

## Summary
[Describe the incident]

## Timeline
- $(date): Incident detected

## Actions Taken
- Forensic data collected
- Logs preserved
- [Additional actions]

## Next Steps
- [ ] Analyze logs
- [ ] Identify root cause
- [ ] Implement fixes
- [ ] Update security measures

## Files
- processes.txt: Running processes at time of incident
- network.txt: Network connections
- recent_logs.txt: System logs from past hour
- auth_logs.txt: Authentication logs
- nginx_*.txt: Web server logs
EOL

echo "Forensic data collected in: $INCIDENT_DIR"
echo "Incident logged to: $INCIDENT_LOG"

# Send notification
if command -v mail &> /dev/null; then
    echo "Security incident detected on $(hostname): $1" | \
    mail -s "SECURITY INCIDENT: $(hostname)" security@inergize.app
fi
EOF
    chmod +x /usr/local/bin/security-incident-response.sh
    
    log "Security incident response configured"
}

# Final security audit
perform_security_audit() {
    log "Performing final security audit..."
    
    # Run Lynis security audit
    if command -v lynis &> /dev/null; then
        lynis audit system --quiet > /var/log/lynis-audit.log 2>&1
        log "Lynis security audit completed. Report saved to /var/log/lynis-audit.log"
    fi
    
    # Generate security checklist
    cat > /root/security-checklist.txt <<EOF
InErgize Production Security Checklist
=====================================

System Hardening:
[ ] System packages updated
[ ] Firewall configured (UFW/FirewallD)  
[ ] Fail2Ban configured for intrusion prevention
[ ] SSH hardened (key-only, no root login)
[ ] Kernel security parameters applied
[ ] File system permissions secured
[ ] Automatic security updates enabled

Monitoring & Detection:
[ ] AIDE integrity monitoring configured
[ ] RKHunter rootkit detection enabled
[ ] ClamAV antivirus installed and running
[ ] Log monitoring with Logwatch
[ ] Security incident response procedures
[ ] Regular security audits scheduled

Application Security:
[ ] SSL/TLS certificates installed and valid
[ ] Security headers configured in nginx
[ ] Rate limiting implemented
[ ] Input validation in application code
[ ] Database access restricted
[ ] API authentication properly implemented

Backup & Recovery:
[ ] Regular backups configured
[ ] Backup restoration tested
[ ] Disaster recovery plan documented
[ ] Incident response procedures tested

Compliance & Documentation:
[ ] Security policies documented
[ ] Access controls implemented
[ ] Audit logs maintained
[ ] Regular security training scheduled
EOF
    
    log "Security checklist created at /root/security-checklist.txt"
}

# Main execution
main() {
    log "Starting InErgize Production Security Hardening"
    
    check_root
    create_backup_dir
    harden_system
    configure_firewall
    configure_fail2ban
    secure_ssh
    harden_kernel
    harden_filesystem
    configure_auto_updates
    configure_intrusion_detection
    configure_log_monitoring
    configure_antivirus
    create_security_dashboard
    configure_incident_response
    perform_security_audit
    
    log "Security hardening completed successfully!"
    log ""
    log "Security Status Summary:"
    log "- Firewall: Configured and active"
    log "- Fail2Ban: Monitoring SSH, HTTP, and API endpoints"
    log "- SSH: Hardened with key-only authentication"
    log "- Kernel: Security parameters applied"
    log "- Updates: Automatic security updates enabled"
    log "- Monitoring: AIDE, RKHunter, ClamAV configured"
    log "- Logging: Centralized logging and monitoring active"
    log ""
    log "Next steps:"
    log "1. Review /root/security-checklist.txt"
    log "2. Test SSH access with key authentication"
    log "3. Monitor /var/log/inergize-security-hardening.log"
    log "4. Schedule regular security audits"
    log "5. Train team on incident response procedures"
    log ""
    log "Emergency contact: security@inergize.app"
}

# Run main function
main "$@"