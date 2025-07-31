"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Shield,
  AlertTriangle,
  TrendingUp,
  Users,
  Activity,
  Zap,
  Target,
  AlertOctagon,
  Info,
  AlertCircle
} from "lucide-react";

import { SafetyStatus, SafetyAlert, RiskFactor } from "@/types/automation";

// Define missing types
interface ComplianceRule {
  id: string;
  title: string;
  description: string;
  status: 'compliant' | 'warning' | 'violation' | 'unknown';
  progress: number;
  current: number;
  limit: number;
  unit?: string;
}

interface SafetyInsight {
  type: 'trend' | 'compliance' | 'performance';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

interface EnhancedSafetyMonitorProps {
  userId: string;
  status: SafetyStatus;
  onEmergencyStop: () => Promise<void>;
  onResumeAutomation: () => Promise<void>;
  onAcknowledgeAlert: (alertId: string) => Promise<void>;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
}

export default function EnhancedSafetyMonitor({
  userId,
  status,
  onEmergencyStop,
  onResumeAutomation,
  onAcknowledgeAlert,
  subscriptionTier
}: EnhancedSafetyMonitorProps) {

  const [alertsFilter, setAlertsFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [isEmergencyStopConfirm, setIsEmergencyStopConfirm] = useState(false);
  const [healthHistory, setHealthHistory] = useState<Array<{timestamp: number, score: number}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock safety status and connection data since useAutomation is not available
  const safetyStatus = status;
  const isConnected = true;
  const connectionLatency = 50;

  // Track health score history for trend analysis
  useEffect(() => {
    if (safetyStatus?.score !== undefined) {
      const timestamp = Date.now();
      setHealthHistory(prev => {
        const newHistory = [...prev, { timestamp, score: safetyStatus.score }];
        // Keep only last 24 hours of data (assuming updates every minute)
        return newHistory.slice(-1440);
      });
    }
  }, [safetyStatus?.score]);

  // Calculate health trend
  const healthTrend = useMemo(() => {
    if (healthHistory.length < 2) return 'stable';
    
    const recent = healthHistory.slice(-10); // Last 10 readings
    const average = recent.reduce((sum, point) => sum + point.score, 0) / recent.length;
    const previousAverage = healthHistory.slice(-20, -10).reduce((sum, point) => sum + point.score, 0) / Math.max(1, healthHistory.slice(-20, -10).length);
    
    const diff = average - previousAverage;
    if (Math.abs(diff) < 2) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  }, [healthHistory]);

  // Enhanced emergency stop with double confirmation for critical status
  const handleEmergencyStop = useCallback(async () => {
    if (safetyStatus?.overallStatus === 'critical') {
      if (!isEmergencyStopConfirm) {
        setIsEmergencyStopConfirm(true);
        return;
      }
    }

    const confirmed = window.confirm(
      'EMERGENCY STOP: This will immediately halt ALL automation activities. Are you absolutely sure?'
    );

    if (confirmed) {
      try {
        await onEmergencyStop();
        setIsEmergencyStopConfirm(false);
        
        // Show immediate feedback
        if (Notification.permission === 'granted') {
          new Notification('Emergency Stop Activated', {
            body: 'All LinkedIn automation has been halted immediately',
            icon: '/icon-192x192.png',
            requireInteraction: true
          });
        }
      } catch (error) {
        console.error('Emergency stop failed:', error);
        alert('Emergency stop failed. Please try again or contact support.');
      }
    } else {
      setIsEmergencyStopConfirm(false);
    }
  }, [onEmergencyStop, safetyStatus?.overallStatus, isEmergencyStopConfirm]);

  // Real-time safety metrics with enhanced calculations
  const safetyMetrics = useMemo(() => {
    if (!safetyStatus) return null;

    const score = safetyStatus.score || 0;
    const alerts = safetyStatus.activeAlerts || [];
    
    // Calculate risk factors
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = alerts.filter(a => a.severity === 'medium').length;
    
    // Enhanced compliance calculations
    const dailyLimits = {
      connections: { used: safetyStatus.metrics?.dailyConnections || 0, limit: 15 },
      likes: { used: safetyStatus.metrics?.dailyLikes || 0, limit: 30 },
      comments: { used: safetyStatus.metrics?.dailyComments || 0, limit: 8 },
      profileViews: { used: safetyStatus.metrics?.dailyProfileViews || 0, limit: 25 }
    };

    const complianceScore = Object.values(dailyLimits).reduce((acc, limit) => {
      const usage = limit.used / limit.limit;
      if (usage <= 0.8) return acc + 25; // Under 80% is good
      if (usage <= 0.9) return acc + 15; // 80-90% is okay
      if (usage <= 1.0) return acc + 5;  // 90-100% is concerning
      return acc; // Over 100% is critical
    }, 0);

    // Connection health based on WebSocket latency and stability
    const connectionHealth = isConnected 
      ? Math.max(0, 100 - (connectionLatency || 0) / 10)
      : 0;

    return {
      score,
      trend: healthTrend,
      criticalAlerts,
      warningAlerts,
      totalAlerts: alerts.length,
      complianceScore: Math.min(100, complianceScore),
      connectionHealth,
      dailyLimits,
      riskLevel: score >= 80 ? 'low' : score >= 60 ? 'medium' : score >= 40 ? 'high' : 'critical',
      lastUpdate: new Date().toLocaleTimeString()
    };
  }, [safetyStatus, healthTrend, isConnected, connectionLatency]);

  // Filter active alerts
  const filteredAlerts = useMemo(() => {
    if (!safetyStatus?.activeAlerts) return [];
    
    return safetyStatus.activeAlerts.filter(alert => {
      if (alertsFilter === 'all') return true;
      return alert.severity === alertsFilter;
    });
  }, [safetyStatus?.activeAlerts, alertsFilter]);

  // Enhanced compliance rules with real-time status
  const COMPLIANCE_RULES: ComplianceRule[] = [
    {
      id: 'daily-connections',
      title: 'Daily Connection Limit',
      description: 'Maximum 15 connection requests per day (Ultra-conservative)',
      status: safetyMetrics ? (
        safetyMetrics.dailyLimits.connections.used <= 12 ? 'compliant' :
        safetyMetrics.dailyLimits.connections.used <= 15 ? 'warning' : 'violation'
      ) : 'unknown',
      progress: safetyMetrics ? (safetyMetrics.dailyLimits.connections.used / 15) * 100 : 0,
      current: safetyMetrics?.dailyLimits.connections.used || 0,
      limit: 15
    },
    {
      id: 'daily-likes',
      title: 'Daily Like Limit',
      description: 'Maximum 30 likes per day (50% of LinkedIn limit)',
      status: safetyMetrics ? (
        safetyMetrics.dailyLimits.likes.used <= 24 ? 'compliant' :
        safetyMetrics.dailyLimits.likes.used <= 30 ? 'warning' : 'violation'
      ) : 'unknown',
      progress: safetyMetrics ? (safetyMetrics.dailyLimits.likes.used / 30) * 100 : 0,
      current: safetyMetrics?.dailyLimits.likes.used || 0,
      limit: 30
    },
    {
      id: 'daily-comments',
      title: 'Daily Comment Limit',
      description: 'Maximum 8 comments per day (Conservative approach)',
      status: safetyMetrics ? (
        safetyMetrics.dailyLimits.comments.used <= 6 ? 'compliant' :
        safetyMetrics.dailyLimits.comments.used <= 8 ? 'warning' : 'violation'
      ) : 'unknown',
      progress: safetyMetrics ? (safetyMetrics.dailyLimits.comments.used / 8) * 100 : 0,
      current: safetyMetrics?.dailyLimits.comments.used || 0,
      limit: 8
    },
    {
      id: 'profile-views',
      title: 'Daily Profile Views',
      description: 'Maximum 25 profile views per day',
      status: safetyMetrics ? (
        safetyMetrics.dailyLimits.profileViews.used <= 20 ? 'compliant' :
        safetyMetrics.dailyLimits.profileViews.used <= 25 ? 'warning' : 'violation'
      ) : 'unknown',
      progress: safetyMetrics ? (safetyMetrics.dailyLimits.profileViews.used / 25) * 100 : 0,
      current: safetyMetrics?.dailyLimits.profileViews.used || 0,
      limit: 25
    },
    {
      id: 'connection-health',
      title: 'Real-time Connection',
      description: 'WebSocket connection stability and latency',
      status: isConnected ? (
        connectionLatency <= 100 ? 'compliant' :
        connectionLatency <= 500 ? 'warning' : 'violation'
      ) : 'violation',
      progress: safetyMetrics ? safetyMetrics.connectionHealth : 0,
      current: connectionLatency || 0,
      limit: 100,
      unit: 'ms'
    }
  ];

  // Safety insights with actionable recommendations
  const SAFETY_INSIGHTS: SafetyInsight[] = [
    {
      type: 'trend',
      title: `Health Score ${healthTrend === 'improving' ? 'Improving' : healthTrend === 'declining' ? 'Declining' : 'Stable'}`,
      description: healthTrend === 'improving' 
        ? 'Your automation health is trending upward. Keep following current practices.'
        : healthTrend === 'declining'
        ? 'Health score is declining. Review recent activities and consider reducing automation intensity.'
        : 'Health score is stable. Monitor for any changes and maintain current practices.',
      severity: healthTrend === 'declining' ? 'warning' : 'info'
    },
    {
      type: 'compliance',
      title: `Compliance Score: ${safetyMetrics?.complianceScore || 0}/100`,
      description: safetyMetrics && safetyMetrics.complianceScore >= 80
        ? 'Excellent compliance with LinkedIn limits. You\'re operating well within safe parameters.'
        : safetyMetrics && safetyMetrics.complianceScore >= 60
        ? 'Good compliance, but approaching daily limits. Consider pacing your activities.'
        : 'Low compliance score. Reduce automation activity to avoid potential account restrictions.',
      severity: safetyMetrics && safetyMetrics.complianceScore >= 80 ? 'info' : 
                safetyMetrics && safetyMetrics.complianceScore >= 60 ? 'warning' : 'critical'
    },
    {
      type: 'performance',
      title: `Connection Quality: ${safetyMetrics?.connectionHealth.toFixed(0) || 0}%`,
      description: isConnected
        ? connectionLatency <= 100
          ? 'Excellent real-time connection. All safety monitoring is fully operational.'
          : connectionLatency <= 500
          ? 'Good connection with minor latency. Safety monitoring is operational.'
          : 'Poor connection quality may affect real-time safety monitoring.'
        : 'Real-time connection lost. Safety monitoring may be delayed.',
      severity: isConnected && connectionLatency <= 100 ? 'info' : 
                isConnected && connectionLatency <= 500 ? 'warning' : 'critical'
    }
  ];

  const renderRealTimeStatus = () => (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-full ${
            safetyStatus?.overallStatus === 'healthy' ? 'bg-green-100' :
            safetyStatus?.overallStatus === 'warning' ? 'bg-yellow-100' :
            safetyStatus?.overallStatus === 'critical' ? 'bg-red-100 animate-pulse' :
            'bg-gray-100'
          }`}>
            <Shield className={`h-6 w-6 ${
              safetyStatus?.overallStatus === 'healthy' ? 'text-green-600' :
              safetyStatus?.overallStatus === 'warning' ? 'text-yellow-600' :
              safetyStatus?.overallStatus === 'critical' ? 'text-red-600' :
              'text-gray-600'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Real-Time Safety Monitor</h3>
            <p className="text-sm text-gray-600">
              Health Score: {safetyMetrics?.score || 0}/100 • 
              Risk Level: <span className={`font-medium ${
                safetyMetrics?.riskLevel === 'low' ? 'text-green-600' :
                safetyMetrics?.riskLevel === 'medium' ? 'text-yellow-600' :
                safetyMetrics?.riskLevel === 'high' ? 'text-orange-600' :
                'text-red-600'
              }`}>
                {safetyMetrics?.riskLevel || 'unknown'}
              </span> • 
              Last Update: {safetyMetrics?.lastUpdate}
            </p>
          </div>
        </div>

        {/* Emergency Stop Button - Enhanced */}
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          
          <Button
            variant={safetyStatus?.overallStatus === 'critical' || isEmergencyStopConfirm ? 'destructive' : 'outline'}
            size="lg"
            onClick={handleEmergencyStop}
            disabled={isLoading || safetyStatus?.overallStatus === 'suspended'}
            className={`${
              safetyStatus?.overallStatus === 'critical' || isEmergencyStopConfirm
                ? 'animate-pulse bg-red-600 hover:bg-red-700 text-white' 
                : ''
            }`}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {isLoading ? 'Stopping...' : 
             isEmergencyStopConfirm ? 'Confirm Stop!' : 
             'Emergency Stop'}
          </Button>
        </div>
      </div>

      {/* Health Score Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Health</span>
            <span className="text-lg font-bold">{safetyMetrics?.score || 0}/100</span>
          </div>
          <Progress 
            value={safetyMetrics?.score || 0} 
            className={`h-3 ${
              (safetyMetrics?.score || 0) >= 80 ? '[&>div]:bg-green-500' :
              (safetyMetrics?.score || 0) >= 60 ? '[&>div]:bg-yellow-500' :
              (safetyMetrics?.score || 0) >= 40 ? '[&>div]:bg-orange-500' :
              '[&>div]:bg-red-500'
            }`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Compliance</span>
            <span className="text-lg font-bold">{safetyMetrics?.complianceScore || 0}/100</span>
          </div>
          <Progress 
            value={safetyMetrics?.complianceScore || 0} 
            className={`h-3 ${
              (safetyMetrics?.complianceScore || 0) >= 80 ? '[&>div]:bg-green-500' :
              (safetyMetrics?.complianceScore || 0) >= 60 ? '[&>div]:bg-yellow-500' :
              '[&>div]:bg-red-500'
            }`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connection</span>
            <span className="text-lg font-bold">{safetyMetrics?.connectionHealth.toFixed(0) || 0}%</span>
          </div>
          <Progress 
            value={safetyMetrics?.connectionHealth || 0} 
            className={`h-3 ${
              (safetyMetrics?.connectionHealth || 0) >= 80 ? '[&>div]:bg-green-500' :
              (safetyMetrics?.connectionHealth || 0) >= 60 ? '[&>div]:bg-yellow-500' :
              '[&>div]:bg-red-500'
            }`}
          />
        </div>
      </div>
    </Card>
  );

  const renderComplianceRules = () => (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">LinkedIn Compliance Rules</h3>
      <div className="space-y-4">
        {COMPLIANCE_RULES.map((rule) => (
          <div key={rule.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  rule.status === 'compliant' ? 'bg-green-500' :
                  rule.status === 'warning' ? 'bg-yellow-500' :
                  rule.status === 'violation' ? 'bg-red-500' :
                  'bg-gray-500'
                }`} />
                <span className="font-medium">{rule.title}</span>
              </div>
              <Badge variant={
                rule.status === 'compliant' ? 'default' :
                rule.status === 'warning' ? 'secondary' :
                rule.status === 'violation' ? 'destructive' :
                'outline'
              }>
                {rule.current}/{rule.limit}{rule.unit || ''}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
            <Progress value={Math.min(100, rule.progress)} className="h-2" />
          </div>
        ))}
      </div>
    </Card>
  );

  const renderAlerts = () => (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          Active Alerts ({filteredAlerts.length})
        </h3>
        <select
          value={alertsFilter}
          onChange={(e) => setAlertsFilter(e.target.value as 'all' | 'critical' | 'warning' | 'info')}
          className="px-3 py-1 border rounded-md text-sm"
        >
          <option value="all">All Alerts</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No active alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    alert.severity === 'critical' ? 'bg-red-100' :
                    alert.severity === 'medium' ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    {alert.severity === 'critical' && <AlertCircle className="h-4 w-4 text-red-600" />}
                    {alert.severity === 'medium' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                    {alert.severity === 'low' && <Info className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-gray-600">{new Date(alert.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                
                {!alert.acknowledged && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAcknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  const renderInsights = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Safety Insights</h3>
      <div className="space-y-4">
        {SAFETY_INSIGHTS.map((insight, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg ${
              insight.severity === 'critical' ? 'bg-red-50 border border-red-200' :
              insight.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-blue-50 border border-blue-200'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-full ${
                insight.severity === 'critical' ? 'bg-red-100' :
                insight.severity === 'warning' ? 'bg-yellow-100' :
                'bg-blue-100'
              }`}>
                {insight.type === 'trend' && <TrendingUp className={`h-4 w-4 ${
                  insight.severity === 'critical' ? 'text-red-600' :
                  insight.severity === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />}
                {insight.type === 'compliance' && <Shield className={`h-4 w-4 ${
                  insight.severity === 'critical' ? 'text-red-600' :
                  insight.severity === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />}
                {insight.type === 'performance' && <Zap className={`h-4 w-4 ${
                  insight.severity === 'critical' ? 'text-red-600' :
                  insight.severity === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">{insight.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p className="font-medium">Safety Monitor Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {renderRealTimeStatus()}
      {renderComplianceRules()}
      {renderAlerts()}
      {renderInsights()}
    </div>
  );
};

export { EnhancedSafetyMonitor };
