#!/usr/bin/env node

/**
 * Monitoring & Alerting Automation for InErgize
 * 
 * Features:
 * - Intelligent alerting with contextual information
 * - Performance threshold monitoring
 * - LinkedIn compliance monitoring
 * - Service health correlation analysis
 * - Automated incident response workflows
 * - Slack/Teams integration for notifications
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

class MonitoringAutomation {
  constructor() {
    this.config = this.loadMonitoringConfig();
    this.services = [
      'auth-service', 'user-service', 'linkedin-service', 
      'analytics-service', 'ai-service', 'websocket-service'
    ];
    
    this.healthEndpoints = {
      'auth-service': 'http://localhost:3001/health',
      'user-service': 'http://localhost:3002/health',
      'linkedin-service': 'http://localhost:3003/health',
      'analytics-service': 'http://localhost:3004/health',
      'ai-service': 'http://localhost:3005/health',
      'websocket-service': 'http://localhost:3007/health',
      'web-app': 'http://localhost:3000',
      'kong': 'http://localhost:8001/status'
    };

    this.alertHistory = [];
    this.serviceStatus = {};
  }

  loadMonitoringConfig() {
    const defaultConfig = {
      thresholds: {
        responseTime: {
          warning: 500,    // 500ms
          critical: 2000   // 2s
        },
        errorRate: {
          warning: 1,      // 1%
          critical: 5      // 5%
        },
        cpuUsage: {
          warning: 70,     // 70%
          critical: 90     // 90%
        },
        memoryUsage: {
          warning: 80,     // 80%
          critical: 95     // 95%
        },
        diskUsage: {
          warning: 85,     // 85%
          critical: 95     // 95%
        }
      },
      linkedinCompliance: {
        dailyRateLimit: 15,      // Ultra-conservative
        healthScoreThreshold: 40, // Emergency stop threshold
        maxErrorRate: 3          // 3% error rate triggers suspension
      },
      alerting: {
        channels: {
          slack: process.env.SLACK_WEBHOOK_URL || null,
          email: process.env.ALERT_EMAIL || null,
          sms: process.env.ALERT_SMS || null
        },
        escalation: {
          warning: 5,     // 5 minutes before escalation
          critical: 2     // 2 minutes before escalation
        },
        cooldown: 300000  // 5 minutes cooldown between similar alerts
      },
      monitoring: {
        interval: 30000,        // 30 seconds
        healthCheckTimeout: 5000, // 5 seconds
        maxRetries: 3
      }
    };

    try {
      const configPath = join(PROJECT_ROOT, 'monitoring.config.json');
      if (existsSync(configPath)) {
        return { ...defaultConfig, ...JSON.parse(readFileSync(configPath, 'utf8')) };
      }
    } catch (error) {
      console.warn('Using default monitoring configuration');
    }

    return defaultConfig;
  }

  async executeCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: options.timeout || 10000,
        ...options
      });
      return { success: true, output: result.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkServiceHealth(service) {
    const startTime = Date.now();
    const endpoint = this.healthEndpoints[service];
    
    if (!endpoint) {
      return { 
        service, 
        healthy: false, 
        error: 'No health endpoint configured',
        responseTime: 0 
      };
    }

    try {
      const result = await this.executeCommand(
        `curl -f -s --max-time ${this.config.monitoring.healthCheckTimeout / 1000} -w "%{http_code},%{time_total}" ${endpoint}`,
        { timeout: this.config.monitoring.healthCheckTimeout + 1000 }
      );

      const responseTime = Date.now() - startTime;
      
      if (result.success) {
        const [httpCode, totalTime] = result.output.split(',').slice(-2);
        const actualResponseTime = Math.round(parseFloat(totalTime) * 1000);
        
        return {
          service,
          healthy: true,
          responseTime: actualResponseTime,
          httpCode: parseInt(httpCode),
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          service,
          healthy: false,
          error: result.error,
          responseTime,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        service,
        healthy: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkSystemResources() {
    const resources = {
      cpu: await this.getCpuUsage(),
      memory: await this.getMemoryUsage(),
      disk: await this.getDiskUsage(),
      docker: await this.getDockerStats(),
      timestamp: new Date().toISOString()
    };

    return resources;
  }

  async getCpuUsage() {
    try {
      const result = await this.executeCommand("top -l 1 -n 0 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'");
      return result.success ? parseFloat(result.output) || 0 : 0;
    } catch {
      return 0;
    }
  }

  async getMemoryUsage() {
    try {
      const result = await this.executeCommand("vm_stat | grep 'Pages active' | awk '{print $3}' | sed 's/\\.//'");
      const activePages = parseInt(result.output) || 0;
      const pageSize = 4096; // 4KB pages on macOS
      const totalMemory = require('os').totalmem();
      const usedMemory = activePages * pageSize;
      
      return Math.round((usedMemory / totalMemory) * 100);
    } catch {
      return 0;
    }
  }

  async getDiskUsage() {
    try {
      const result = await this.executeCommand("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
      return result.success ? parseInt(result.output) || 0 : 0;
    } catch {
      return 0;
    }
  }

  async getDockerStats() {
    try {
      const result = await this.executeCommand('docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"');
      
      if (!result.success) {
        return { containers: [], healthy: false };
      }

      const lines = result.output.split('\\n').slice(1); // Skip header
      const containers = [];

      for (const line of lines) {
        if (line.trim()) {
          const [name, cpu, memory] = line.split('\\t');
          containers.push({
            name: name.trim(),
            cpu: parseFloat(cpu.replace('%', '')) || 0,
            memory: memory.trim()
          });
        }
      }

      return { containers, healthy: true };
    } catch {
      return { containers: [], healthy: false };
    }
  }

  async checkLinkedInCompliance() {
    try {
      // Check Redis for LinkedIn rate limiting data
      const redisResult = await this.executeCommand(
        'docker exec inergize-redis redis-cli -a inergize_redis_password --raw HGETALL linkedin:rate:limits'
      );

      if (!redisResult.success) {
        return {
          compliant: false,
          error: 'Unable to check LinkedIn rate limits',
          timestamp: new Date().toISOString()
        };
      }

      // Parse Redis hash data
      const data = redisResult.output.split('\\n');
      const rateLimits = {};
      
      for (let i = 0; i < data.length; i += 2) {
        if (data[i] && data[i + 1]) {
          rateLimits[data[i]] = parseInt(data[i + 1]);
        }
      }

      // Check compliance
      const dailyConnections = rateLimits['daily:connections'] || 0;
      const dailyLikes = rateLimits['daily:likes'] || 0;
      const dailyComments = rateLimits['daily:comments'] || 0;
      const errorRate = rateLimits['error:rate'] || 0;

      const violations = [];
      
      if (dailyConnections > this.config.linkedinCompliance.dailyRateLimit) {
        violations.push(`Daily connections: ${dailyConnections}/${this.config.linkedinCompliance.dailyRateLimit}`);
      }
      
      if (dailyLikes > 30) { // 30/day limit for likes
        violations.push(`Daily likes: ${dailyLikes}/30`);
      }
      
      if (dailyComments > 8) { // 8/day limit for comments
        violations.push(`Daily comments: ${dailyComments}/8`);
      }
      
      if (errorRate > this.config.linkedinCompliance.maxErrorRate) {
        violations.push(`Error rate: ${errorRate}%/${this.config.linkedinCompliance.maxErrorRate}%`);
      }

      return {
        compliant: violations.length === 0,
        violations,
        rateLimits,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        compliant: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  analyzeHealthTrends(currentHealth) {
    // Update service status history
    for (const health of currentHealth) {
      if (!this.serviceStatus[health.service]) {
        this.serviceStatus[health.service] = {
          history: [],
          consecutiveFailures: 0,
          lastAlert: null
        };
      }

      const serviceStatus = this.serviceStatus[health.service];
      serviceStatus.history.push(health);
      
      // Keep only last 100 health checks
      if (serviceStatus.history.length > 100) {
        serviceStatus.history.shift();
      }

      // Update consecutive failures
      if (!health.healthy) {
        serviceStatus.consecutiveFailures++;
      } else {
        serviceStatus.consecutiveFailures = 0;
      }
    }

    // Identify trends and anomalies
    const trends = {};
    
    for (const [service, status] of Object.entries(this.serviceStatus)) {
      const recentHistory = status.history.slice(-10); // Last 10 checks
      
      if (recentHistory.length < 5) continue;

      const avgResponseTime = recentHistory
        .filter(h => h.healthy)
        .reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length;

      const healthyRate = recentHistory.filter(h => h.healthy).length / recentHistory.length;

      trends[service] = {
        avgResponseTime,
        healthyRate,
        consecutiveFailures: status.consecutiveFailures,
        trending: this.calculateTrend(recentHistory)
      };
    }

    return trends;
  }

  calculateTrend(history) {
    if (history.length < 5) return 'stable';

    const recent = history.slice(-3);
    const older = history.slice(-6, -3);

    const recentAvg = recent.reduce((sum, h) => sum + (h.healthy ? h.responseTime : 5000), 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + (h.healthy ? h.responseTime : 5000), 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 20) return 'deteriorating';
    if (change < -20) return 'improving';
    return 'stable';
  }

  shouldAlert(service, currentHealth, trend) {
    const now = Date.now();
    const serviceStatus = this.serviceStatus[service];

    // Check cooldown period
    if (serviceStatus.lastAlert && (now - serviceStatus.lastAlert) < this.config.alerting.cooldown) {
      return false;
    }

    // Critical conditions (always alert)
    if (!currentHealth.healthy && serviceStatus.consecutiveFailures >= 3) {
      return { level: 'critical', reason: 'Service down for 3+ consecutive checks' };
    }

    if (currentHealth.healthy && currentHealth.responseTime > this.config.thresholds.responseTime.critical) {
      return { level: 'critical', reason: `Response time ${currentHealth.responseTime}ms exceeds critical threshold` };
    }

    // Warning conditions
    if (currentHealth.healthy && currentHealth.responseTime > this.config.thresholds.responseTime.warning) {
      return { level: 'warning', reason: `Response time ${currentHealth.responseTime}ms exceeds warning threshold` };
    }

    if (trend.trending === 'deteriorating') {
      return { level: 'warning', reason: 'Service performance is deteriorating' };
    }

    return false;
  }

  async sendAlert(service, alertInfo, currentHealth, trend, resources) {
    const alert = {
      id: `${service}-${Date.now()}`,
      service,
      level: alertInfo.level,
      reason: alertInfo.reason,
      timestamp: new Date().toISOString(),
      details: {
        health: currentHealth,
        trend,
        resources,
        consecutiveFailures: this.serviceStatus[service]?.consecutiveFailures || 0
      }
    };

    // Add to alert history
    this.alertHistory.push(alert);
    this.serviceStatus[service].lastAlert = Date.now();

    console.log(`🚨 ALERT [${alert.level.toUpperCase()}] ${service}: ${alertInfo.reason}`);

    // Send to configured channels
    const notifications = [];

    if (this.config.alerting.channels.slack) {
      notifications.push(this.sendSlackAlert(alert));
    }

    if (this.config.alerting.channels.email) {
      notifications.push(this.sendEmailAlert(alert));
    }

    await Promise.all(notifications);

    // Trigger automated response for critical alerts
    if (alert.level === 'critical') {
      await this.triggerAutomatedResponse(alert);
    }

    return alert;
  }

  async sendSlackAlert(alert) {
    const color = alert.level === 'critical' ? 'danger' : 'warning';
    const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
    
    const message = {
      text: `${emoji} InErgize Alert: ${alert.service}`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Service',
            value: alert.service,
            short: true
          },
          {
            title: 'Level',
            value: alert.level.toUpperCase(),
            short: true
          },
          {
            title: 'Reason',
            value: alert.reason,
            short: false
          },
          {
            title: 'Response Time',
            value: `${alert.details.health.responseTime}ms`,
            short: true
          },
          {
            title: 'Consecutive Failures',
            value: alert.details.consecutiveFailures.toString(),
            short: true
          },
          {
            title: 'System Resources',
            value: `CPU: ${alert.details.resources.cpu}%, RAM: ${alert.details.resources.memory}%, Disk: ${alert.details.resources.disk}%`,
            short: false
          }
        ],
        footer: 'InErgize Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    try {
      const result = await this.executeCommand(
        `curl -X POST -H 'Content-type: application/json' --data '${JSON.stringify(message)}' ${this.config.alerting.channels.slack}`,
        { timeout: 10000 }
      );
      
      if (result.success) {
        console.log('✅ Slack alert sent successfully');
      } else {
        console.error('❌ Failed to send Slack alert:', result.error);
      }
    } catch (error) {
      console.error('❌ Error sending Slack alert:', error.message);
    }
  }

  async sendEmailAlert(alert) {
    // Placeholder for email alerting
    console.log(`📧 Email alert would be sent to: ${this.config.alerting.channels.email}`);
    console.log(`Subject: InErgize Alert - ${alert.service} ${alert.level}`);
    console.log(`Body: ${alert.reason}`);
  }

  async triggerAutomatedResponse(alert) {
    console.log(`🤖 Triggering automated response for critical alert: ${alert.service}`);

    // Automated response actions based on service
    switch (alert.service) {
      case 'linkedin-service':
        // Suspend LinkedIn automation if health score is critical
        await this.suspendLinkedInAutomation();
        break;
        
      case 'auth-service':
        // Restart auth service container
        await this.restartService('auth-service');
        break;
        
      case 'analytics-service':
        // Clear analytics cache to free up memory
        await this.clearAnalyticsCache();
        break;
        
      default:
        // Generic service restart
        await this.restartService(alert.service);
    }
  }

  async suspendLinkedInAutomation() {
    console.log('🛑 Emergency suspension of LinkedIn automation');
    
    try {
      // Set emergency suspension flag in Redis
      await this.executeCommand(
        'docker exec inergize-redis redis-cli -a inergize_redis_password SET linkedin:emergency:suspended true EX 3600'
      );
      
      console.log('✅ LinkedIn automation suspended for 1 hour');
    } catch (error) {
      console.error('❌ Failed to suspend LinkedIn automation:', error.message);
    }
  }

  async restartService(service) {
    console.log(`🔄 Restarting service: ${service}`);
    
    try {
      const result = await this.executeCommand(`docker-compose restart ${service}`, { timeout: 60000 });
      
      if (result.success) {
        console.log(`✅ Service ${service} restarted successfully`);
        
        // Wait for service to be healthy
        await this.sleep(10000);
        const health = await this.checkServiceHealth(service);
        
        if (health.healthy) {
          console.log(`✅ Service ${service} is healthy after restart`);
        } else {
          console.error(`❌ Service ${service} still unhealthy after restart`);
        }
      } else {
        console.error(`❌ Failed to restart service ${service}:`, result.error);
      }
    } catch (error) {
      console.error(`❌ Error restarting service ${service}:`, error.message);
    }
  }

  async clearAnalyticsCache() {
    console.log('🧹 Clearing analytics cache');
    
    try {
      await this.executeCommand(
        'docker exec inergize-redis redis-cli -a inergize_redis_password FLUSHDB'
      );
      console.log('✅ Analytics cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear analytics cache:', error.message);
    }
  }

  async generateDashboard() {
    const health = await Promise.all(
      this.services.map(service => this.checkServiceHealth(service))
    );
    
    const resources = await this.checkSystemResources();
    const linkedinCompliance = await this.checkLinkedInCompliance();
    const trends = this.analyzeHealthTrends(health);

    const dashboard = {
      timestamp: new Date().toISOString(),
      overall: {
        healthy: health.filter(h => h.healthy).length,
        total: health.length,
        healthPercentage: Math.round((health.filter(h => h.healthy).length / health.length) * 100)
      },
      services: health.reduce((acc, h) => {
        acc[h.service] = {
          healthy: h.healthy,
          responseTime: h.responseTime,
          trend: trends[h.service]?.trending || 'unknown',
          consecutiveFailures: trends[h.service]?.consecutiveFailures || 0
        };
        return acc;
      }, {}),
      resources,
      linkedinCompliance,
      recentAlerts: this.alertHistory.slice(-10)
    };

    // Save dashboard to file
    const dashboardPath = join(PROJECT_ROOT, '.monitoring-dashboard.json');
    writeFileSync(dashboardPath, JSON.stringify(dashboard, null, 2));

    return dashboard;
  }

  async startMonitoring() {
    console.log('🔍 Starting InErgize monitoring automation...');
    console.log(`Monitoring interval: ${this.config.monitoring.interval / 1000}s`);
    console.log(`Health check timeout: ${this.config.monitoring.healthCheckTimeout / 1000}s`);
    
    const monitoringLoop = async () => {
      try {
        console.log(`\\n📊 Monitoring check at ${new Date().toISOString()}`);
        
        // Check service health
        const health = await Promise.all(
          this.services.map(service => this.checkServiceHealth(service))
        );
        
        // Check system resources
        const resources = await this.checkSystemResources();
        
        // Check LinkedIn compliance
        const linkedinCompliance = await this.checkLinkedInCompliance();
        
        // Analyze trends
        const trends = this.analyzeHealthTrends(health);
        
        // Check for alerts
        for (const serviceHealth of health) {
          const trend = trends[serviceHealth.service];
          if (trend) {
            const alertInfo = this.shouldAlert(serviceHealth.service, serviceHealth, trend);
            if (alertInfo) {
              await this.sendAlert(serviceHealth.service, alertInfo, serviceHealth, trend, resources);
            }
          }
        }
        
        // Check LinkedIn compliance alerts
        if (!linkedinCompliance.compliant && linkedinCompliance.violations) {
          for (const violation of linkedinCompliance.violations) {
            await this.sendAlert('linkedin-service', {
              level: 'critical',
              reason: `LinkedIn compliance violation: ${violation}`
            }, { healthy: false, service: 'linkedin-service' }, {}, resources);
          }
        }
        
        // Generate dashboard
        await this.generateDashboard();
        
        // Status summary
        const healthyCount = health.filter(h => h.healthy).length;
        console.log(`📈 Status: ${healthyCount}/${health.length} services healthy`);
        console.log(`💻 Resources: CPU ${resources.cpu}%, RAM ${resources.memory}%, Disk ${resources.disk}%`);
        console.log(`🔗 LinkedIn: ${linkedinCompliance.compliant ? 'Compliant' : 'Violations detected'}`);
        
      } catch (error) {
        console.error('❌ Monitoring loop error:', error.message);
      }
      
      // Schedule next check
      setTimeout(monitoringLoop, this.config.monitoring.interval);
    };

    // Start monitoring loop
    monitoringLoop();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\\n🛑 Stopping monitoring automation...');
      process.exit(0);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  
  const monitor = new MonitoringAutomation();
  
  try {
    switch (command) {
      case 'start':
        await monitor.startMonitoring();
        break;
        
      case 'check':
        const dashboard = await monitor.generateDashboard();
        console.log(JSON.stringify(dashboard, null, 2));
        break;
        
      case 'health':
        const health = await Promise.all(
          monitor.services.map(service => monitor.checkServiceHealth(service))
        );
        console.log(JSON.stringify(health, null, 2));
        break;
        
      case 'resources':
        const resources = await monitor.checkSystemResources();
        console.log(JSON.stringify(resources, null, 2));
        break;
        
      case 'compliance':
        const compliance = await monitor.checkLinkedInCompliance();
        console.log(JSON.stringify(compliance, null, 2));
        break;
        
      default:
        console.log('Usage: monitoring-automation.js [command]');
        console.log('Commands:');
        console.log('  start      - Start continuous monitoring');
        console.log('  check      - Generate monitoring dashboard');
        console.log('  health     - Check service health');
        console.log('  resources  - Check system resources');
        console.log('  compliance - Check LinkedIn compliance');
        process.exit(1);
    }
  } catch (error) {
    console.error(`\\n❌ Command failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default MonitoringAutomation;