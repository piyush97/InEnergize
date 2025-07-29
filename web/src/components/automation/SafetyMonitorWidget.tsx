"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  Bell,
  Settings,
  Pause,
  Play,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Loader2,
  Square,
  Minus
} from "lucide-react";

import {
  SafetyMonitorProps,
  SafetyStatus,
  SafetyAlert,
  RiskFactor
} from "@/types/automation";

interface SafetyMetric {
  label: string;
  value: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  compliance?: {
    linkedinLimit: number;
    ourLimit: number;
    safetyMargin: string;
  };
}

export function SafetyMonitorWidget({
  userId,
  status,
  onEmergencyStop,
  onResumeAutomation,
  onAcknowledgeAlert
}: SafetyMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [realtimeStatus, setRealtimeStatus] = useState<SafetyStatus>(status);
  const [wsConnected, setWsConnected] = useState(false);
  const [alertHistory, setAlertHistory] = useState<SafetyAlert[]>([]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3007/automation/safety/${userId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Safety monitoring WebSocket connected');
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'safety_update') {
          setRealtimeStatus(data.status);
          setLastUpdate(new Date());
        } else if (data.type === 'safety_alert') {
          setAlertHistory(prev => [data.alert, ...prev].slice(0, 10)); // Keep last 10 alerts
          // Show toast notification for new alerts
          if (data.alert.severity === 'critical') {
            // Critical alert handling
            console.error('Critical safety alert:', data.alert);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('Safety monitoring WebSocket disconnected');
      setWsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    return () => {
      ws.close();
    };
  }, [userId]);

  // Real-time safety metrics with enhanced tracking
  const safetyMetrics: SafetyMetric[] = [
    {
      label: "Daily Connections",
      value: realtimeStatus.metrics.dailyConnections,
      limit: 15, // Ultra-conservative LinkedIn limit (15% of LinkedIn's 100/day)
      status: realtimeStatus.metrics.dailyConnections > 12 ? 'critical' :
              realtimeStatus.metrics.dailyConnections > 10 ? 'warning' : 'safe',
      trend: 'stable',
      compliance: {
        linkedinLimit: 100,
        ourLimit: 15,
        safetyMargin: '85%'
      }
    },
    {
      label: "Daily Likes", 
      value: realtimeStatus.metrics.dailyLikes,
      limit: 30, // Ultra-conservative (15% of LinkedIn's 200/day)
      status: realtimeStatus.metrics.dailyLikes > 24 ?interface SafetyMetric {
  label: string;
  value: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  compliance?: {
    linkedinLimit: number;
    ourLimit: number;
    safetyMargin: string;
  };
}: 
              realtimeStatus.metrics.dailyLikes > 30 ? 'critical' : 'safe',
      trend: 'up',
      compliance: {
        linkedinLimit: 200,
        ourLimit: 30,
        safetyMargin: '85%'
      }
    },
    {
      label: "Daily Comments",
      value: realtimeStatus.metrics.dailyComments,
      limit: 8, // Ultra-conservative (16% of LinkedIn's 50/day)
      status: realtimeStatus.metrics.dailyComments > 6 ?interface SafetyMetric {
  label: string;
  value: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  compliance?: {
    linkedinLimit: number;
    ourLimit: number;
    safetyMargin: string;
  };
}: 
              realtimeStatus.metrics.dailyComments > 8 ? 'critical' : 'safe',
      trend: 'stable',
      compliance: {
        linkedinLimit: 50,
        ourLimit: 8,
        safetyMargin: '84%'
      }
    },
    {
      label: "Profile Views",
      value: realtimeStatus.metrics.dailyProfileViews,
      limit: 25, // Ultra-conservative (17% of LinkedIn's 150/day)
      status: realtimeStatus.metrics.dailyProfileViews > 20 ?interface SafetyMetric {
  label: string;
  value: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  compliance?: {
    linkedinLimit: number;
    ourLimit: number;
    safetyMargin: string;
  };
}: 
              realtimeStatus.metrics.dailyProfileViews > 25 ? 'critical' : 'safe',
      trend: 'down',
      compliance: {
        linkedinLimit: 150,
        ourLimit: 25,
        safetyMargin: '83%'
      }
    },
    {
      label: "Error Rate",
      value: Math.round(realtimeStatus.metrics.errorRate * 100),
      limit: 3, // 3% error rate threshold
      status: realtimeStatus.metrics.errorRate > 0.02 ?interface SafetyMetric {
  label: string;
  value: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  compliance?: {
    linkedinLimit: number;
    ourLimit: number;
    safetyMargin: string;
  };
}: 
              realtimeStatus.metrics.errorRate > 0.03 ? 'critical' : 'safe',
      trend: realtimeStatus.metrics.errorRate > 0.01 ? 'up' : 'stable',
      compliance: {
        linkedinLimit: 100, // LinkedIn doesn't specify but we assume 100% = bad
        ourLimit: 3,
        safetyMargin: '97%'
      },
      unit: '%'
    }
  ];

  const getStatusColor = (overallStatus: SafetyStatus['overallStatus']) => {
    switch (overallStatus) {
      case 'healthy':
        return 'text-green-500 border-green-500 bg-green-50';
      case 'warning':
        return 'text-yellow-500 border-yellow-500 bg-yellow-50';
      case 'critical':
        return 'text-red-500 border-red-500 bg-red-50';
      case 'suspended':
        return 'text-red-600 border-red-600 bg-red-100';
      default:
        return 'text-gray-500 border-gray-500 bg-gray-50';
    }
  };

  const getStatusIcon = (overallStatus: SafetyStatus['overallStatus']) => {
    switch (overallStatus) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'suspended':
        return <Pause className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (overallStatus: SafetyStatus['overallStatus']) => {
    const config = {
      healthy: { variant: "default" as const, label: "Healthy", className: "bg-green-500 hover:bg-green-600" },
      warning: { variant: "default" as const, label: "Warning", className: "bg-yellow-500 hover:bg-yellow-600" },
      critical: { variant: "destructive" as const, label: "Critical", className: "" },
      suspended: { variant: "destructive" as const, label: "Suspended", className: "" }
    };

    const statusConfig = config[overallStatus];
    return (
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        {statusConfig.label}
      </Badge>
    );
  };

  const getMetricStatusBadge = (metricStatus: SafetyMetric['status']) => {
    const config = {
      safe: { variant: "default" as const, label: "Safe", className: "bg-green-100 text-green-800" },
      warning: { variant: "default" as const, label: "Warning", className: "bg-yellow-100 text-yellow-800" },
      critical: { variant: "destructive" as const, label: "Critical", className: "bg-red-100 text-red-800" }
    };

    const statusConfig = config[metricStatus];
    return (
      <Badge variant={statusConfig.variant} className={`${statusConfig.className} text-xs`}>
        {statusConfig.label}
      </Badge>
    );
  };

  const getTrendIcon = (trend: SafetyMetric['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  const handleEmergencyStop = async () => {
    setLoading(true);
    try {
      await onEmergencyStop();
    } finally {
      setLoading(false);
    }
  };

  const handleResumeAutomation = async () => {
    setLoading(true);
    try {
      await onResumeAutomation();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`w-full ${getStatusColor(realtimeStatus.overallStatus)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(realtimeStatus.overallStatus)}
            <div>
              <CardTitle className="text-lg">LinkedIn Safety Monitor</CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                     title={wsConnected ? 'Connected' : 'Disconnected'} />
                {wsConnected && <span className="text-xs text-green-600">Live</span>}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge(realtimeStatus.overallStatus)}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Safety Score Display */}
        <div className="mb-4 p-3 bg-white rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Safety Score</span>
            <span className="text-2xl font-bold text-green-600">{realtimeStatus.score}/100</span>
          </div>
          <Progress value={realtimeStatus.score} className="w-full h-2" />
          <p className="text-xs text-gray-600 mt-1">
            Higher scores indicate safer automation patterns
          </p>
        </div>

        {/* Quick Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {safetyMetrics.map((metric, index) => (
            <div key={index} className="p-3 bg-white rounded-lg border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{metric.label}</span>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">
                  {metric.value}{metric.unit || ''}
                  <span className="text-xs text-gray-500">/{metric.limit}</span>
                </span>
                {getMetricStatusBadge(metric.status)}
              </div>
              <Progress 
                value={(metric.value / metric.limit) * 100} 
                className="w-full h-1 mt-2"
                max={100}
              />
            </div>
          ))}
        </div>

        {/* Active Alerts */}
        {realtimeStatus.activeAlerts.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Active Alerts</h4>
            <div className="space-y-2">
              {realtimeStatus.activeAlerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{alert.type}</span>
                    <Badge variant="outline" className="text-xs">
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-gray-600 mt-1">{alert.message}</p>
                </div>
              ))}
              {realtimeStatus.activeAlerts.length > 3 && (
                <p className="text-xs text-gray-500">
                  +{realtimeStatus.activeAlerts.length - 3} more alerts
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {realtimeStatus.overallStatus === 'suspended' ? (
            <Button
              onClick={handleResumeAutomation}
              disabled={loading}
              variant="default"
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Resume Automation
            </Button>
          ) : (
            <Button
              onClick={handleEmergencyStop}
              disabled={loading}
              variant="destructive"
              size="sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
              Emergency Stop
            </Button>
          )}
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-6 pt-4 border-t">
            {/* Detailed Metrics */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Detailed Compliance Metrics</h4>
              {safetyMetrics.map((metric, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{metric.label}</span>
                    {getMetricStatusBadge(metric.status)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="block font-medium">Current</span>
                      <span>{metric.value}{metric.unit || ''}</span>
                    </div>
                    <div>
                      <span className="block font-medium">Our Limit</span>
                      <span>{metric.limit}{metric.unit || ''}</span>
                    </div>
                    {metric.compliance && (
                      <div>
                        <span className="block font-medium">LinkedIn Limit</span>
                        <span>{metric.compliance.linkedinLimit}{metric.unit || ''}</span>
                      </div>
                    )}
                  </div>
                  {metric.compliance && (
                    <div className="mt-2 text-xs text-green-600">
                      <span className="font-medium">Safety Margin: {metric.compliance.safetyMargin}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Recent Alert History */}
            {alertHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-2">Recent Alert History</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {alertHistory.map((alert, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{alert.type}</span>
                        <span className="text-gray-500">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

  const getMetricStatusColor = (status: SafetyMetric['status']) => {
    switch (status) {
      case 'safe':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: SafetyMetric['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const handleEmergencyStop = async () => {
    try {
      setLoading(true);
      await onEmergencyStop();
    } catch (error) {
      console.error('Emergency stop failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeAutomation = async () => {
    try {
      setLoading(true);
      await onResumeAutomation();
    } catch (error) {
      console.error('Resume automation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await onAcknowledgeAlert(alertId);
    } catch (error) {
      console.error('Acknowledge alert failed:', error);
    }
  };

  // Update last update timestamp periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const criticalAlerts = status.activeAlerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = status.activeAlerts.filter(alert => alert.severity === 'high' || alert.severity === 'medium');

  return (
    <Card className={`transition-all duration-200 ${getStatusColor(status.overallStatus)}`}>
      <CardHeader 
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(status.overallStatus)}
            <div>
              <CardTitle className="text-lg">Safety Monitor</CardTitle>
              <CardDescription>
                Score: {status.score}/100 • Last check: {status.lastHealthCheck.toLocaleTimeString()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {status.activeAlerts.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {status.activeAlerts.length} Alert{status.activeAlerts.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {getStatusBadge(status.overallStatus)}
            <RefreshCw className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Quick Safety Score Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>Safety Score</span>
            <span className="font-medium">{status.score}/100</span>
          </div>
          <Progress 
            value={status.score} 
            className={`h-2 ${
              status.score >= 80 ? 'bg-green-100' : 
              status.score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
            }`}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Critical Alerts */}
          {criticalAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-red-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Critical Alerts
              </h4>
              {criticalAlerts.map(alert => (
                <Alert key={alert.id} className="border-red-500 bg-red-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {alert.timestamp.toLocaleString()}
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Warning Alerts */}
          {warningAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-yellow-600 flex items-center">
                <Bell className="h-4 w-4 mr-2" />
                Warnings
              </h4>
              {warningAlerts.slice(0, 3).map(alert => (
                <Alert key={alert.id} className="border-yellow-500 bg-yellow-50">
                  <Bell className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {alert.timestamp.toLocaleString()}
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
              {warningAlerts.length > 3 && (
                <p className="text-sm text-muted-foreground">
                  +{warningAlerts.length - 3} more warnings
                </p>
              )}
            </div>
          )}

          {/* Real-time Metrics */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Real-time Metrics
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safetyMetrics.map((metric, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{metric.label}</span>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(metric.trend)}
                      <span className={`text-sm font-bold ${getMetricStatusColor(metric.status)}`}>
                        {metric.value}/{metric.limit}
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(metric.value / metric.limit) * 100} 
                    className={`h-2 ${
                      metric.status === 'safe' ? 'bg-green-100' :
                      metric.status ===interface SafetyMetric {
  label: string;
  value: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  compliance?: {
    linkedinLimit: number;
    ourLimit: number;
    safetyMargin: string;
  };
}? 'bg-yellow-100' : 'bg-red-100'
                    }`}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {Math.round((metric.value / metric.limit) * 100)}% of daily limit
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Success Rates */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Performance Metrics
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(status.metrics.connectionAcceptanceRate)}%
                </div>
                <div className="text-sm text-muted-foreground">Connection Rate</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(status.metrics.engagementSuccessRate)}%
                </div>
                <div className="text-sm text-muted-foreground">Engagement Rate</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(status.metrics.averageResponseTime)}ms
                </div>
                <div className="text-sm text-muted-foreground">Avg Response</div>
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          {status.riskFactors.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Risk Assessment
              </h4>
              <div className="space-y-2">
                {status.riskFactors.map((risk, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{risk.category}</span>
                      <Badge 
                        variant={risk.score > 70 ? "destructive" : risk.score > 40 ? "default" : "secondary"}
                        className={risk.score > 70 ? "" : risk.score > 40 ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                      >
                        {risk.score}/100
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                    {risk.recommendations.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Recommendations:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {risk.recommendations.map((rec, recIndex) => (
                            <li key={recIndex}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency Controls */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <div className="flex items-center space-x-2">
              {status.overallStatus === 'suspended' ? (
                <Button 
                  onClick={handleResumeAutomation}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Resume Automation
                </Button>
              ) : (
                <Button 
                  variant="destructive"
                  onClick={handleEmergencyStop}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Pause className="h-4 w-4 mr-2" />
                  )}
                  Emergency Stop
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}