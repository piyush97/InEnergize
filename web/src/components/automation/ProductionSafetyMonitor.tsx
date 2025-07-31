"use client";

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  Clock,
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  Eye,
  Heart,
  MessageSquare,
  Users,
  UserPlus,
  Activity,
  Zap,
  Target,
  AlertOctagon,
  Info,
  RefreshCw,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";

import { useAutomation } from "@/contexts/AutomationContext";
import { useWebSocket, useWebSocketEvent } from "@/contexts/WebSocketProvider";
import { SafetyStatus, SafetyAlert, RiskFactor } from "@/types/automation";

interface ProductionSafetyMonitorProps {
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  className?: string;
}

// LinkedIn conservative limits (15% of actual limits)
const LINKEDIN_CONSERVATIVE_LIMITS = {
  connections: { daily: 15, weekly: 100, monthly: 400 }, // LinkedIn allows ~100/day
  likes: { daily: 30, weekly: 200, monthly: 800 },       // LinkedIn allows ~200/day
  comments: { daily: 8, weekly: 50, monthly: 200 },      // LinkedIn allows ~50/day
  views: { daily: 25, weekly: 150, monthly: 600 },       // LinkedIn allows ~150/day
  follows: { daily: 5, weekly: 30, monthly: 120 },       // LinkedIn allows ~30/day
} as const;

// Safety thresholds for different alert levels
const SAFETY_THRESHOLDS = {
  excellent: 90,
  good: 75,
  fair: 60,
  warning: 45,
  critical: 30,
  emergency: 15,
} as const;

// Memoized Alert Card Component
const AlertCard = memo(({ 
  alert, 
  onAcknowledge 
}: { 
  alert: SafetyAlert; 
  onAcknowledge: (id: string) => Promise<void>; 
}) => {
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  
  const handleAcknowledge = useCallback(async () => {
    if (isAcknowledging) return;
    
    setIsAcknowledging(true);
    try {
      await onAcknowledge(alert.id);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    } finally {
      setIsAcknowledging(false);
    }
  }, [alert.id, onAcknowledge, isAcknowledging]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertOctagon className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info': return <Info className="h-4 w-4 text-blue-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Alert className={`${getSeverityColor(alert.severity)} transition-all duration-200`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          {getSeverityIcon(alert.severity)}
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{alert.type.replace('_', ' ').toUpperCase()}</h4>
            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
            <p className="text-xs text-gray-500 mt-2">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        
        {!alert.acknowledged && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="ml-4 flex-shrink-0"
            aria-label={`Acknowledge ${alert.type.replace('_', ' ')} alert`}
          >
            {isAcknowledging ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              "Acknowledge"
            )}
          </Button>
        )}
      </div>
    </Alert>
  );
});

AlertCard.displayName = 'AlertCard';

// Memoized Limit Progress Component
const LimitProgressCard = memo(({ 
  title, 
  current, 
  limit, 
  icon: Icon,
  subtitle,
  timeframe = 'daily'
}: {
  title: string;
  current: number;
  limit: number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  timeframe?: string;
}) => {
  const percentage = (current / limit) * 100;
  const remaining = limit - current;
  
  const getVariant = (percentage: number) => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 75) return 'warning';
    if (percentage >= 50) return 'caution';
    return 'safe';
  };
  
  const variant = getVariant(percentage);
  const variantStyles = {
    safe: 'border-green-200 bg-green-50',
    caution: 'border-yellow-200 bg-yellow-50',
    warning: 'border-orange-200 bg-orange-50',
    danger: 'border-red-200 bg-red-50'
  };

  return (
    <Card className={`${variantStyles[variant]} transition-all duration-200`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Icon className="h-5 w-5 text-gray-600" />
            <div>
              <h3 className="font-medium text-gray-900">{title}</h3>
              {subtitle && (
                <p className="text-xs text-gray-600">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              {current}/{limit}
            </p>
            <p className="text-xs text-gray-600 capitalize">{timeframe}</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Progress 
            value={percentage} 
            className="h-2"
            aria-label={`${title}: ${current} of ${limit} used (${percentage.toFixed(1)}%)`}
          />
          
          <div className="flex justify-between text-xs text-gray-600">
            <span>{percentage.toFixed(1)}% used</span>
            <span>{remaining} remaining</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

LimitProgressCard.displayName = 'LimitProgressCard';

export default function ProductionSafetyMonitor({ 
  userId, 
  subscriptionTier, 
  className 
}: ProductionSafetyMonitorProps) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showRiskFactors, setShowRiskFactors] = useState(false);
  const [alertSounds, setAlertSounds] = useState(true);
  
  // Automation context
  const { 
    safetyStatus, 
    acknowledgeAlert, 
    emergencyStop,
    resumeAutomation,
    isLoading, 
    error 
  } = useAutomation();
  
  // WebSocket connection for real-time updates
  const { isConnected } = useWebSocket();
  
  // Listen for safety alerts via WebSocket
  useWebSocketEvent('safety_alert', useCallback((data: unknown) => {
    if (alertSounds && 'Notification' in window) {
      new Notification('LinkedIn Safety Alert', {
        body: (data as any)?.message || 'Safety alert received',
        icon: '/icon-192x192.png',
        tag: 'safety-alert'
      });
    }
  }, [alertSounds]));

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Calculate safety metrics
  const safetyMetrics = useMemo(() => {
    if (!safetyStatus) return null;

    const { metrics } = safetyStatus;
    const limits = LINKEDIN_CONSERVATIVE_LIMITS;
    
    return {
      connections: {
        current: metrics.dailyConnections,
        limit: limits.connections.daily,
        percentage: (metrics.dailyConnections / limits.connections.daily) * 100,
      },
      likes: {
        current: metrics.dailyLikes,
        limit: limits.likes.daily,
        percentage: (metrics.dailyLikes / limits.likes.daily) * 100,
      },
      comments: {
        current: metrics.dailyComments,
        limit: limits.comments.daily,
        percentage: (metrics.dailyComments / limits.comments.daily) * 100,
      },
      views: {
        current: metrics.dailyProfileViews,
        limit: limits.views.daily,
        percentage: (metrics.dailyProfileViews / limits.views.daily) * 100,
      },
      follows: {
        current: metrics.dailyFollows,
        limit: limits.follows.daily,
        percentage: (metrics.dailyFollows / limits.follows.daily) * 100,
      },
    };
  }, [safetyStatus]);

  // Get safety status details
  const getHealthStatus = useCallback((score: number) => {
    if (score >= SAFETY_THRESHOLDS.excellent) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= SAFETY_THRESHOLDS.good) return { label: 'Good', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= SAFETY_THRESHOLDS.fair) return { label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score >= SAFETY_THRESHOLDS.warning) return { label: 'Warning', color: 'text-orange-600', bg: 'bg-orange-50' };
    if (score >= SAFETY_THRESHOLDS.critical) return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' };
    return { label: 'Emergency', color: 'text-red-700', bg: 'bg-red-100' };
  }, []);

  // Active alerts (unacknowledged)
  const activeAlerts = useMemo(() => {
    return safetyStatus?.activeAlerts?.filter(alert => !alert.acknowledged) || [];
  }, [safetyStatus?.activeAlerts]);

  // Handle emergency stop with confirmation
  const handleEmergencyStop = useCallback(async () => {
    if (window.confirm('⚠️ This will immediately stop all automation activities. Continue?')) {
      try {
        await emergencyStop();
      } catch (error) {
        console.error('Emergency stop failed:', error);
      }
    }
  }, [emergencyStop]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="sr-only">Loading safety monitor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load safety monitor: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!safetyStatus || !safetyMetrics) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Safety monitoring data is not available.
        </AlertDescription>
      </Alert>
    );
  }

  const healthStatus = getHealthStatus(safetyStatus.score);

  return (
    <div className={`space-y-6 ${className}`} role="region" aria-label="LinkedIn Safety Monitor">
      {/* Safety Score Header */}
      <Card className={`border-l-4 ${
        safetyStatus.score >= 75 ? 'border-l-green-500' : 
        safetyStatus.score >= 50 ? 'border-l-yellow-500' : 
        'border-l-red-500'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-gray-600" />
              <div>
                <CardTitle className="text-lg">LinkedIn Safety Monitor</CardTitle>
                <CardDescription>
                  Ultra-conservative limits (15% of LinkedIn's actual limits)
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              
              {/* Alert Sound Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAlertSounds(!alertSounds)}
                aria-label={`${alertSounds ? 'Disable' : 'Enable'} alert sounds`}
              >
                {alertSounds ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold">{safetyStatus.score}/100</span>
                <Badge className={`${healthStatus.color} ${healthStatus.bg} border-0`}>
                  {healthStatus.label}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Last updated: {new Date(safetyStatus.lastHealthCheck).toLocaleString()}
              </p>
            </div>
            
            {safetyStatus.overallStatus === 'suspended' && (
              <Button 
                onClick={resumeAutomation}
                className="bg-green-600 hover:bg-green-700"
                aria-label="Resume automation"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}
          </div>
          
          <Progress value={safetyStatus.score} className="h-3" />
          
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="font-medium text-gray-900">{safetyStatus.overallStatus}</p>
              <p className="text-gray-600">Status</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">{activeAlerts.length}</p>
              <p className="text-gray-600">Active Alerts</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">{safetyStatus.riskFactors.length}</p>
              <p className="text-gray-600">Risk Factors</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-red-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Active Safety Alerts ({activeAlerts.length})
              </CardTitle>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmergencyStop}
                aria-label="Emergency stop all automation"
              >
                <Pause className="h-4 w-4 mr-2" />
                Emergency Stop
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAlerts.slice(0, showAllAlerts ? undefined : 3).map((alert) => (
              <AlertCard 
                key={alert.id} 
                alert={alert} 
                onAcknowledge={acknowledgeAlert} 
              />
            ))}
            
            {activeAlerts.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                className="w-full"
              >
                {showAllAlerts ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show {activeAlerts.length - 3} More Alerts
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Limits Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <LimitProgressCard
          title="Connections"
          current={safetyMetrics.connections.current}
          limit={safetyMetrics.connections.limit}
          icon={Users}
          subtitle="Daily connection requests"
        />
        
        <LimitProgressCard
          title="Likes"
          current={safetyMetrics.likes.current}
          limit={safetyMetrics.likes.limit}
          icon={Heart}
          subtitle="Daily post likes"
        />
        
        <LimitProgressCard
          title="Comments"
          current={safetyMetrics.comments.current}
          limit={safetyMetrics.comments.limit}
          icon={MessageSquare}
          subtitle="Daily post comments"
        />
        
        <LimitProgressCard
          title="Profile Views"
          current={safetyMetrics.views.current}
          limit={safetyMetrics.views.limit}
          icon={Eye}
          subtitle="Daily profile views"
        />
        
        <LimitProgressCard
          title="Follows"
          current={safetyMetrics.follows.current}
          limit={safetyMetrics.follows.limit}
          icon={UserPlus}
          subtitle="Daily follows"
        />
        
        {/* Safety Score as a "limit" */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Safety Score</h3>
                  <p className="text-xs text-gray-600">Current health rating</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">
                  {safetyStatus.score}/100
                </p>
                <p className="text-xs text-gray-600">{healthStatus.label}</p>
              </div>
            </div>
            
            <Progress value={safetyStatus.score} className="h-2" />
            
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Health Score</span>
              <span className={healthStatus.color}>{healthStatus.label}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Factors */}
      {safetyStatus.riskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Risk Factors ({safetyStatus.riskFactors.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRiskFactors(!showRiskFactors)}
              >
                {showRiskFactors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          
          {showRiskFactors && (
            <CardContent>
              <div className="space-y-3">
                {safetyStatus.riskFactors.map((factor, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{factor.category}</p>
                      <p className="text-sm text-gray-600">{factor.description}</p>
                    </div>
                    <Badge variant={factor.score > 70 ? 'destructive' : factor.score > 40 ? 'secondary' : 'outline'}>
                      Score: {factor.score}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Help & Documentation */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">Ultra-Conservative Safety Limits</h3>
              <p className="text-sm text-blue-700 mt-1">
                InErgize uses only 15% of LinkedIn's actual daily limits to ensure maximum account safety 
                and compliance with LinkedIn's terms of service.
              </p>
              <div className="mt-3 flex items-center space-x-4 text-xs text-blue-600">
                <a href="/docs/safety" className="flex items-center hover:underline">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Safety Documentation
                </a>
                <a href="/docs/linkedin-compliance" className="flex items-center hover:underline">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  LinkedIn Compliance
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}