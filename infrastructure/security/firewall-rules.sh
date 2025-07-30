#!/bin/bash

# InErgize Network Firewall Rules
# Implements defense-in-depth with zero-trust principles

set -euo pipefail

# Configuration
DMZ_SUBNET="${DMZ_SUBNET:-172.20.1.0/24}"
APP_SUBNET="${APP_SUBNET:-172.20.2.0/24}"
DATA_SUBNET="${DATA_SUBNET:-172.20.3.0/24}"
MONITORING_SUBNET="${MONITORING_SUBNET:-172.20.4.0/24}"

# Logging
LOG_PREFIX="[INERGIZE-FW]"
LOG_LEVEL="info"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_PREFIX $*"
}

# Flush existing rules
flush_rules() {
    log "Flushing existing iptables rules"
    
    iptables -F
    iptables -t nat -F
    iptables -t mangle -F
    iptables -X
    iptables -t nat -X
    iptables -t mangle -X
    
    # IPv6 rules
    ip6tables -F
    ip6tables -X
}

# Set default policies (default deny)
set_default_policies() {
    log "Setting default deny policies"
    
    iptables -P INPUT DROP
    iptables -P FORWARD DROP
    iptables -P OUTPUT ACCEPT
    
    # IPv6 default deny
    ip6tables -P INPUT DROP
    ip6tables -P FORWARD DROP
    ip6tables -P OUTPUT DROP
}

# Allow loopback traffic
allow_loopback() {
    log "Allowing loopback traffic"
    
    iptables -A INPUT -i lo -j ACCEPT
    iptables -A OUTPUT -o lo -j ACCEPT
}

# Allow SSH access (restricted)
allow_ssh() {
    log "Configuring SSH access rules"
    
    # Allow SSH only from specific IP ranges (replace with actual management IPs)
    # iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT
    # iptables -A INPUT -p tcp --dport 22 -s 192.168.0.0/16 -j ACCEPT
    
    # For development, allow from localhost only
    iptables -A INPUT -p tcp --dport 22 -s 127.0.0.1 -j ACCEPT
    
    # Rate limit SSH connections
    iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m limit --limit 3/min --limit-burst 3 -j ACCEPT
    
    # Log SSH brute force attempts
    iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -j LOG --log-prefix "$LOG_PREFIX SSH-ATTACK: " --log-level $LOG_LEVEL
    iptables -A INPUT -p tcp --dport 22 -j DROP
}

# DMZ network rules (external-facing services)
configure_dmz_rules() {
    log "Configuring DMZ network rules"
    
    # Allow HTTP/HTTPS traffic to DMZ
    iptables -A INPUT -p tcp --dport 80 -s 0.0.0.0/0 -d $DMZ_SUBNET -j ACCEPT
    iptables -A INPUT -p tcp --dport 443 -s 0.0.0.0/0 -d $DMZ_SUBNET -j ACCEPT
    
    # Allow Kong API Gateway ports
    iptables -A INPUT -p tcp --dport 8000 -s 0.0.0.0/0 -d $DMZ_SUBNET -j ACCEPT
    iptables -A INPUT -p tcp --dport 8443 -s 0.0.0.0/0 -d $DMZ_SUBNET -j ACCEPT
    
    # Allow VPN traffic
    iptables -A INPUT -p udp --dport 1194 -s 0.0.0.0/0 -d $DMZ_SUBNET -j ACCEPT
    
    # DMZ can access application network on specific ports only
    iptables -A FORWARD -s $DMZ_SUBNET -d $APP_SUBNET -p tcp --dport 3001 -j ACCEPT  # Auth service
    iptables -A FORWARD -s $DMZ_SUBNET -d $APP_SUBNET -p tcp --dport 3002 -j ACCEPT  # User service
    iptables -A FORWARD -s $DMZ_SUBNET -d $APP_SUBNET -p tcp --dport 3003 -j ACCEPT  # LinkedIn service
    iptables -A FORWARD -s $DMZ_SUBNET -d $APP_SUBNET -p tcp --dport 3004 -j ACCEPT  # Analytics service
    iptables -A FORWARD -s $DMZ_SUBNET -d $APP_SUBNET -p tcp --dport 3005 -j ACCEPT  # AI service
    
    # Log and drop other DMZ to internal traffic
    iptables -A FORWARD -s $DMZ_SUBNET -d $APP_SUBNET -j LOG --log-prefix "$LOG_PREFIX DMZ-BLOCK: "
    iptables -A FORWARD -s $DMZ_SUBNET -d $APP_SUBNET -j DROP
    
    # DMZ cannot access data network directly
    iptables -A FORWARD -s $DMZ_SUBNET -d $DATA_SUBNET -j LOG --log-prefix "$LOG_PREFIX DMZ-DATA-BLOCK: "
    iptables -A FORWARD -s $DMZ_SUBNET -d $DATA_SUBNET -j DROP
}

# Application network rules
configure_app_rules() {
    log "Configuring application network rules"
    
    # Allow inter-service communication within app network
    iptables -A FORWARD -s $APP_SUBNET -d $APP_SUBNET -j ACCEPT
    
    # App services can access data network on specific ports
    iptables -A FORWARD -s $APP_SUBNET -d $DATA_SUBNET -p tcp --dport 5432 -j ACCEPT  # PostgreSQL
    iptables -A FORWARD -s $APP_SUBNET -d $DATA_SUBNET -p tcp --dport 5433 -j ACCEPT  # TimescaleDB
    iptables -A FORWARD -s $APP_SUBNET -d $DATA_SUBNET -p tcp --dport 6379 -j ACCEPT  # Redis
    iptables -A FORWARD -s $APP_SUBNET -d $DATA_SUBNET -p tcp --dport 9200 -j ACCEPT  # Elasticsearch
    
    # Log and drop other app to data traffic
    iptables -A FORWARD -s $APP_SUBNET -d $DATA_SUBNET -j LOG --log-prefix "$LOG_PREFIX APP-DATA-BLOCK: "
    iptables -A FORWARD -s $APP_SUBNET -d $DATA_SUBNET -j DROP
    
    # App services can send monitoring data
    iptables -A FORWARD -s $APP_SUBNET -d $MONITORING_SUBNET -p tcp --dport 9090 -j ACCEPT  # Prometheus
    iptables -A FORWARD -s $APP_SUBNET -d $MONITORING_SUBNET -p tcp --dport 3000 -j ACCEPT  # Grafana
}

# Data network rules (most restrictive)
configure_data_rules() {
    log "Configuring data network rules"
    
    # Data services can only communicate within data network
    iptables -A FORWARD -s $DATA_SUBNET -d $DATA_SUBNET -j ACCEPT
    
    # Data services can send monitoring metrics
    iptables -A FORWARD -s $DATA_SUBNET -d $MONITORING_SUBNET -p tcp --dport 9090 -j ACCEPT
    
    # Block all other data network traffic
    iptables -A FORWARD -s $DATA_SUBNET -d $DMZ_SUBNET -j LOG --log-prefix "$LOG_PREFIX DATA-DMZ-BLOCK: "
    iptables -A FORWARD -s $DATA_SUBNET -d $DMZ_SUBNET -j DROP
    
    iptables -A FORWARD -s $DATA_SUBNET -d $APP_SUBNET -j LOG --log-prefix "$LOG_PREFIX DATA-APP-BLOCK: "
    iptables -A FORWARD -s $DATA_SUBNET -d $APP_SUBNET -j DROP
    
    # Allow return traffic
    iptables -A FORWARD -d $DATA_SUBNET -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
}

# Monitoring network rules
configure_monitoring_rules() {
    log "Configuring monitoring network rules"
    
    # Allow monitoring traffic within monitoring network
    iptables -A FORWARD -s $MONITORING_SUBNET -d $MONITORING_SUBNET -j ACCEPT
    
    # Monitoring can access all networks for metrics collection (read-only)
    iptables -A FORWARD -s $MONITORING_SUBNET -d $DMZ_SUBNET -p tcp --dport 9090 -j ACCEPT
    iptables -A FORWARD -s $MONITORING_SUBNET -d $APP_SUBNET -p tcp --dport 9090 -j ACCEPT
    iptables -A FORWARD -s $MONITORING_SUBNET -d $DATA_SUBNET -p tcp --dport 9090 -j ACCEPT
    
    # Allow access to monitoring web interfaces (from DMZ only)
    iptables -A FORWARD -s $DMZ_SUBNET -d $MONITORING_SUBNET -p tcp --dport 3000 -j ACCEPT  # Grafana
    iptables -A FORWARD -s $DMZ_SUBNET -d $MONITORING_SUBNET -p tcp --dport 9090 -j ACCEPT  # Prometheus
    iptables -A FORWARD -s $DMZ_SUBNET -d $MONITORING_SUBNET -p tcp --dport 5601 -j ACCEPT  # Kibana
}

# DDoS protection rules
configure_ddos_protection() {
    log "Configuring DDoS protection"
    
    # Limit new connections per second
    iptables -A INPUT -p tcp --dport 80 -m conntrack --ctstate NEW -m limit --limit 50/sec --limit-burst 100 -j ACCEPT
    iptables -A INPUT -p tcp --dport 443 -m conntrack --ctstate NEW -m limit --limit 50/sec --limit-burst 100 -j ACCEPT
    iptables -A INPUT -p tcp --dport 8000 -m conntrack --ctstate NEW -m limit --limit 25/sec --limit-burst 50 -j ACCEPT
    
    # Limit concurrent connections per IP
    iptables -A INPUT -p tcp --dport 80 -m connlimit --connlimit-above 20 -j LOG --log-prefix "$LOG_PREFIX DDOS-HTTP: "
    iptables -A INPUT -p tcp --dport 80 -m connlimit --connlimit-above 20 -j DROP
    
    iptables -A INPUT -p tcp --dport 443 -m connlimit --connlimit-above 20 -j LOG --log-prefix "$LOG_PREFIX DDOS-HTTPS: "
    iptables -A INPUT -p tcp --dport 443 -m connlimit --connlimit-above 20 -j DROP
    
    # Protect against SYN flood
    iptables -A INPUT -p tcp --syn -m limit --limit 1/s --limit-burst 3 -j RETURN
    iptables -A INPUT -p tcp --syn -j LOG --log-prefix "$LOG_PREFIX SYN-FLOOD: "
    iptables -A INPUT -p tcp --syn -j DROP
    
    # Protect against ping flood
    iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 3 -j ACCEPT
    iptables -A INPUT -p icmp --icmp-type echo-request -j LOG --log-prefix "$LOG_PREFIX PING-FLOOD: "
    iptables -A INPUT -p icmp --icmp-type echo-request -j DROP
}

# Anti-spoofing rules
configure_anti_spoofing() {
    log "Configuring anti-spoofing rules"
    
    # Drop packets with invalid source addresses
    iptables -A INPUT -s 127.0.0.0/8 ! -i lo -j LOG --log-prefix "$LOG_PREFIX SPOOF-LOOPBACK: "
    iptables -A INPUT -s 127.0.0.0/8 ! -i lo -j DROP
    
    iptables -A INPUT -s 0.0.0.0/8 -j LOG --log-prefix "$LOG_PREFIX SPOOF-NULL: "
    iptables -A INPUT -s 0.0.0.0/8 -j DROP
    
    iptables -A INPUT -s 169.254.0.0/16 -j LOG --log-prefix "$LOG_PREFIX SPOOF-LINK-LOCAL: "
    iptables -A INPUT -s 169.254.0.0/16 -j DROP
    
    iptables -A INPUT -s 224.0.0.0/4 -j LOG --log-prefix "$LOG_PREFIX SPOOF-MULTICAST: "
    iptables -A INPUT -s 224.0.0.0/4 -j DROP
    
    iptables -A INPUT -s 240.0.0.0/5 -j LOG --log-prefix "$LOG_PREFIX SPOOF-RESERVED: "
    iptables -A INPUT -s 240.0.0.0/5 -j DROP
}

# Allow established and related connections
allow_established() {
    log "Allowing established and related connections"
    
    iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
}

# Block invalid packets
block_invalid() {
    log "Blocking invalid packets"
    
    iptables -A INPUT -m conntrack --ctstate INVALID -j LOG --log-prefix "$LOG_PREFIX INVALID: "
    iptables -A INPUT -m conntrack --ctstate INVALID -j DROP
    
    iptables -A FORWARD -m conntrack --ctstate INVALID -j LOG --log-prefix "$LOG_PREFIX INVALID-FWD: "
    iptables -A FORWARD -m conntrack --ctstate INVALID -j DROP
}

# LinkedIn compliance traffic shaping
configure_linkedin_compliance() {
    log "Configuring LinkedIn compliance traffic shaping"
    
    # Rate limit LinkedIn API traffic (ultra-conservative)
    iptables -t mangle -A OUTPUT -p tcp --dport 443 -m string --string "api.linkedin.com" --algo bm -j MARK --set-mark 1
    iptables -t mangle -A OUTPUT -p tcp --dport 443 -m string --string "linkedin.com" --algo bm -j MARK --set-mark 1
    
    # Apply strict rate limiting to LinkedIn traffic
    iptables -A OUTPUT -m mark --mark 1 -m limit --limit 1/min --limit-burst 2 -j ACCEPT
    iptables -A OUTPUT -m mark --mark 1 -j LOG --log-prefix "$LOG_PREFIX LINKEDIN-RATE-LIMIT: "
    iptables -A OUTPUT -m mark --mark 1 -j DROP
}

# Emergency lockdown mode
emergency_lockdown() {
    log "EMERGENCY: Activating lockdown mode"
    
    # Block all traffic except SSH
    iptables -F INPUT
    iptables -F FORWARD
    iptables -F OUTPUT
    
    iptables -P INPUT DROP
    iptables -P FORWARD DROP
    iptables -P OUTPUT DROP
    
    # Allow loopback
    iptables -A INPUT -i lo -j ACCEPT
    iptables -A OUTPUT -o lo -j ACCEPT
    
    # Allow SSH for recovery
    iptables -A INPUT -p tcp --dport 22 -s 127.0.0.1 -j ACCEPT
    iptables -A OUTPUT -p tcp --sport 22 -d 127.0.0.1 -j ACCEPT
    
    # Allow established connections
    iptables -A INPUT -m conntrack --ctstate ESTABLISHED -j ACCEPT
    iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED -j ACCEPT
    
    log "EMERGENCY: System locked down - SSH access only"
}

# Log final deny rules
configure_logging() {
    log "Configuring final logging rules"
    
    # Log dropped packets (rate limited to prevent log flooding)
    iptables -A INPUT -m limit --limit 5/min --limit-burst 10 -j LOG --log-prefix "$LOG_PREFIX INPUT-DROP: " --log-level $LOG_LEVEL
    iptables -A FORWARD -m limit --limit 5/min --limit-burst 10 -j LOG --log-prefix "$LOG_PREFIX FORWARD-DROP: " --log-level $LOG_LEVEL
}

# Save rules
save_rules() {
    log "Saving iptables rules"
    
    if command -v iptables-save >/dev/null 2>&1; then
        iptables-save > /etc/iptables/rules.v4
        ip6tables-save > /etc/iptables/rules.v6
        log "Rules saved to /etc/iptables/"
    else
        log "Warning: iptables-save not available, rules not persisted"
    fi
}

# Status check
status_check() {
    log "Firewall status check"
    
    echo "=== INPUT CHAIN ==="
    iptables -L INPUT -n --line-numbers
    
    echo "=== FORWARD CHAIN ==="
    iptables -L FORWARD -n --line-numbers
    
    echo "=== OUTPUT CHAIN ==="
    iptables -L OUTPUT -n --line-numbers
    
    echo "=== NAT TABLE ==="
    iptables -t nat -L -n --line-numbers
    
    echo "=== MANGLE TABLE ==="
    iptables -t mangle -L -n --line-numbers
}

# Main function
main() {
    local action="${1:-start}"
    
    case "$action" in
        "start")
            log "Starting InErgize firewall configuration"
            
            flush_rules
            set_default_policies
            allow_loopback
            allow_established
            block_invalid
            configure_anti_spoofing
            configure_ddos_protection
            allow_ssh
            configure_dmz_rules
            configure_app_rules
            configure_data_rules
            configure_monitoring_rules
            configure_linkedin_compliance
            configure_logging
            save_rules
            
            log "Firewall configuration completed successfully"
            ;;
            
        "stop")
            log "Stopping firewall (allowing all traffic)"
            
            iptables -P INPUT ACCEPT
            iptables -P FORWARD ACCEPT
            iptables -P OUTPUT ACCEPT
            flush_rules
            
            log "Firewall stopped"
            ;;
            
        "status")
            status_check
            ;;
            
        "emergency")
            emergency_lockdown
            ;;
            
        *)
            echo "Usage: $0 {start|stop|status|emergency}"
            echo ""
            echo "  start     - Apply firewall rules"
            echo "  stop      - Remove firewall rules (allow all)"
            echo "  status    - Show current rules"
            echo "  emergency - Activate emergency lockdown"
            exit 1
            ;;
    esac
}

# Handle signals for graceful shutdown
trap 'log "Received SIGTERM, stopping firewall"; main stop; exit 0' TERM
trap 'log "Received SIGINT, stopping firewall"; main stop; exit 0' INT

# Run main function
main "$@"