"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity,
  Users,
  Heart,
  MessageSquare,
  Eye,
  UserPlus,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Pause,
  Loader2,
  Square,
  BarChart3,
  FileText,
  Wifi,
  WifiOff,
  RefreshCw,
  Play
} from "lucide-react";

import { ConnectionAutomation } from "./ConnectionAutomation";
import { EngagementAutomation } from "./EngagementAutomation";
import { EnhancedSafetyMonitor } from "./EnhancedSafetyMonitor";
import { EnhancedQueueManager } from "./EnhancedQueueManager";
import { EnhancedTemplateManager } from "./EnhancedTemplateManager";
import { AutomationSettings } from "./AutomationSettings";
import { useOptimizedWebSocket } from "@/hooks/useOptimizedWebSocket";

import {
  AutomationDashboardProps,
  AutomationOverview,
  MessageTemplate,
  QueueItem,
  AutomationSettings as AutomationSettingsType,
  ScheduleConnectionRequest,
  ScheduleEngagementRequest,
  SafetyStatus
} from "@/types/automation";

export function AutomationDashboard({
  userId,
  subscriptionTier = 'free',
  onSettingsOpen
}: AutomationDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'connections' | 'engagement' | 'queue' | 'templates' | 'safety'>('overview');
  const [overview, setOverview] = useState<AutomationOverview | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Enhanced WebSocket connection with performance optimizations
  const wsUrl = useMemo(() => {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `${protocol}//${hostname}:3007/automation/dashboard/${userId}`;
  }, [userId]);

  const {
    isConnected: wsConnected,
    isConnecting,
    error: wsError,
    latency,
    sendMessage,
    subscribeToChannel,
    unsubscribeFromChannel,
    reconnect: reconnectWs
  } = useOptimizedWebSocket({
    url: wsUrl,
    reconnect: true,
    reconnectInterval: 3000,
    reconnectAttempts: 5,
    heartbeatInterval: 30000,
    debug: process.env.NODE_ENV === 'development',
    onMessage: useCallback((data) => {
      setLastUpdate(new Date());
      
      switch (data.type) {
        case 'overview_update':
          setOverview(data.overview);
          break;
        case 'queue_update':
          setQueueItems((prev) => {
            if (data.action === 'added') {
              return [...prev, data.item].sort((a, b) => 
                new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
              );
            } else if (data.action === 'updated') {
              return prev.map(item => item.id === data.item.id ? data.item : item);
            } else if (data.action === 'removed') {
              return prev.filter(item => item.id !== data.item.id);
            } else if (data.action === 'bulk_update') {
              return data.items;
            }
            return prev;
          });
          break;
        case 'safety_update':
          setSafetyStatus(data.safetyStatus);
          break;
        case 'template_update':
          setTemplates(data.templates);
          break;
        case 'automation_status':
          setAutomationEnabled(data.enabled);
          if (data.suspended) {
            setError(`Automation suspended: ${data.reason}`);
          }
          break;
        case 'safety_alert':
          // Handle critical safety alerts
          if (data.alert.severity === 'critical') {
            setError(`CRITICAL SAFETY ALERT: ${data.alert.message}`);
          }
          break;
        case 'performance_metrics':
          // Update performance metrics for optimization
          console.log('Performance metrics:', data.metrics);
          break;
      }
    }, []),
    onOpen: useCallback(() => {
      // Subscribe to relevant channels
      subscribeToChannel(`user:${userId}:automation`);
      subscribeToChannel(`user:${userId}:safety`);
      subscribeToChannel(`user:${userId}:queue`);
      
      // Request initial data
      sendMessage({
        type: 'request_initial_data',
        channels: ['overview', 'templates', 'queue', 'safety']
      });
    }, [userId, subscribeToChannel, sendMessage]),
    onError: useCallback((event) => {
      setError('WebSocket connection error. Some features may not work properly.');
    }, [])
  });

  // Enhanced data fetching with error handling and retries
  const fetchInitialData = useCallback(async (retryCount = 0) => {
    if (retryCount > 3) {
      setError('Failed to load automation data after 3 attempts');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [overviewResponse, templatesResponse, queueResponse, safetyResponse] = await Promise.all([
        fetch('/api/automation/overview', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch('/api/automation/templates', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch('/api/automation/queue', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch('/api/automation/safety/status', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        })
      ]);

      if (!overviewResponse.ok || !templatesResponse.ok || !queueResponse.ok || !safetyResponse.ok) {
        throw new Error('One or more API requests failed');
      }

      const [overviewData, templatesData, queueData, safetyData] = await Promise.all([
        overviewResponse.json(),
        templatesResponse.json(),
        queueResponse.json(),
        safetyResponse.json()
      ]);

      setOverview(overviewData);
      setTemplates(templatesData);
      setQueueItems(queueData);
      setSafetyStatus(safetyData);
      setAutomationEnabled(overviewData.automation.enabled);

    } catch (err) {
      console.error('Error fetching automation data:', err);
      if (retryCount < 3) {
        setTimeout(() => fetchInitialData(retryCount + 1), 2000 * (retryCount + 1));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load automation data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Enhanced API handlers with optimistic updates
  const handleScheduleConnection = useCallback(async (connectionData: ScheduleConnectionRequest) => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/connections/schedule', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(connectionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to schedule connection');
      }
      
      const result = await response.json();
      
      // Optimistic update
      setQueueItems(prev => [...prev, result.queueItem]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule connection');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScheduleEngagement = useCallback(async (engagementData: ScheduleEngagementRequest) => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/engagement/schedule', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(engagementData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to schedule engagement');
      }
      
      const result = await response.json();
      
      // Optimistic update
      setQueueItems(prev => [...prev, result.queueItem]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule engagement');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEmergencyStop = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/emergency-stop', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to stop automation');
      }
      
      // Immediate UI update
      setAutomationEnabled(false);
      setError('Automation stopped for safety');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop automation');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleResumeAutomation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/resume', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resume automation');
      }
      
      setAutomationEnabled(true);
      setError(null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume automation');
    } finally {
      setLoading(false);
    }
  }, []);

  // Status indicator helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      case 'suspended': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'suspended': return <Pause className="h-5 w-5 text-red-600" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    if (isConnecting) return 'text-yellow-500';
    if (wsConnected) return 'text-green-500';
    return 'text-red-500';
  };

  const getConnectionStatusIcon = () => {
    if (isConnecting) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (wsConnected) return <Wifi className="h-4 w-4" />;
    return <WifiOff className="h-4 w-4" />;
  };

  // Performance metrics for display
  const performanceMetrics = useMemo(() => ({
    wsLatency: latency,
    lastUpdate: lastUpdate.toLocaleTimeString(),
    queueSize: queueItems.length,
    alertsCount: safetyStatus?.activeAlerts.length || 0,
    templatesCount: templates.length
  }), [latency, lastUpdate, queueItems.length, safetyStatus?.activeAlerts.length, templates.length]);

  // Loading state
  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading automation dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header with Status Indicators */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">LinkedIn Automation</h1>
              
              {/* Automation Status */}
              <div className="flex items-center space-x-2">
                {automationEnabled ? (
                  <Play className="h-4 w-4 text-green-500" />
                ) : (
                  <Pause className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${automationEnabled ? 'text-green-600' : 'text-red-600'}`}>
                  {automationEnabled ? 'Active' : 'Stopped'}
                </span>
              </div>

              {/* Safety Status */}
              {safetyStatus && (
                <div className="flex items-center space-x-2">
                  {getStatusIcon(safetyStatus.overallStatus)}
                  <span className={`text-sm font-medium ${getStatusColor(safetyStatus.overallStatus)}`}>
                    Safety: {safetyStatus.overallStatus.charAt(0).toUpperCase() + safetyStatus.overallStatus.slice(1)}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {safetyStatus.score}/100
                  </Badge>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {getConnectionStatusIcon()}
                <div className="text-sm">
                  <span className={`font-medium ${getConnectionStatusColor()}`}>
                    {isConnecting ? 'Connecting...' : wsConnected ? 'Live' : 'Offline'}
                  </span>
                  {wsConnected && latency > 0 && (
                    <span className="text-gray-500 ml-1">({latency}ms)</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {performanceMetrics.lastUpdate}
                </span>
              </div>

              {/* Connection Control */}
              {!wsConnected && !isConnecting && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reconnectWs}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reconnect
                </Button>
              )}

              {/* Emergency Stop */}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmergencyStop}
                disabled={loading || !automationEnabled}
                className="relative"
              >
                <Square className="h-4 w-4 mr-2" />
                Emergency Stop
              </Button>

              {/* Resume Button */}
              {!automationEnabled && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleResumeAutomation}
                  disabled={loading || safetyStatus?.overallStatus === 'critical'}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}

              {/* Settings */}
              <Button variant="outline" size="sm" onClick={onSettingsOpen}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Navigation Tabs with Badge Indicators */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="connections" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Connections</span>
                {overview?.connections.pending > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {overview.connections.pending}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="engagement" className="flex items-center space-x-2">
                <Heart className="h-4 w-4" />
                <span>Engagement</span>
                {overview?.engagement.pending > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {overview.engagement.pending}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="queue" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Queue</span>
                {performanceMetrics.queueSize > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {performanceMetrics.queueSize}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Templates</span>
                <Badge variant="secondary" className="ml-1">
                  {performanceMetrics.templatesCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="safety" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Safety</span>
                {performanceMetrics.alertsCount > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {performanceMetrics.alertsCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Enhanced Tab Content */}
            <div className="py-6">
              <TabsContent value="overview" className="space-y-6">
                {overview && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Enhanced Overview Cards */}
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          Automation Performance
                          <Badge variant={automationEnabled ? "default" : "secondary"}>
                            {automationEnabled ? "Active" : "Paused"}
                          </Badge>
                        </CardTitle>
                        <CardDescription>Real-time automation metrics and performance</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 rounded-lg bg-blue-50">
                            <div className="text-2xl font-bold text-blue-600">{overview.connections.total}</div>
                            <p className="text-sm text-gray-600">Total Connections</p>
                            <p className="text-xs text-blue-500 mt-1">
                              {overview.connections.acceptanceRate}% acceptance
                            </p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-green-50">
                            <div className="text-2xl font-bold text-green-600">{overview.engagement.total}</div>
                            <p className="text-sm text-gray-600">Engagements</p>
                            <p className="text-xs text-green-500 mt-1">
                              {overview.engagement.successRate}% success
                            </p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-purple-50">
                            <div className="text-2xl font-bold text-purple-600">
                              {Math.round((overview.connections.acceptanceRate + overview.engagement.successRate) / 2)}%
                            </div>
                            <p className="text-sm text-gray-600">Overall Rate</p>
                            <p className="text-xs text-purple-500 mt-1">Combined success</p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-orange-50">
                            <div className="text-2xl font-bold text-orange-600">{safetyStatus?.score || 0}</div>
                            <p className="text-sm text-gray-600">Safety Score</p>
                            <p className="text-xs text-orange-500 mt-1">
                              {safetyStatus?.overallStatus || 'Unknown'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Enhanced Safety Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Safety Monitor</CardTitle>
                        <CardDescription>Real-time compliance status</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {safetyStatus ? (
                          <EnhancedSafetyMonitor
                            userId={userId}
                            status={safetyStatus}
                            onEmergencyStop={handleEmergencyStop}
                            onResumeAutomation={handleResumeAutomation}
                            onAcknowledgeAlert={async () => {}}
                            subscriptionTier={subscriptionTier}
                          />
                        ) : (
                          <div className="text-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Loading safety status...</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="connections">
                <ConnectionAutomation
                  userId={userId}
                  onScheduleConnection={handleScheduleConnection}
                  templates={templates.filter(t => t.type === 'connection')}
                  loading={loading}
                />
              </TabsContent>

              <TabsContent value="engagement">
                <EngagementAutomation
                  userId={userId}
                  onScheduleEngagement={handleScheduleEngagement}
                  templates={templates.filter(t => t.type === 'comment')}
                  loading={loading}
                />
              </TabsContent>

              <TabsContent value="queue">
                <EnhancedQueueManager
                  userId={userId}
                  queueItems={queueItems}
                  onUpdatePriority={async () => {}}
                  onCancelItem={async () => {}}
                  onRetryItem={async () => {}}
                  onBulkAction={async () => {}}
                  subscriptionTier={subscriptionTier}
                />
              </TabsContent>

              <TabsContent value="templates">
                <EnhancedTemplateManager
                  userId={userId}
                  templates={templates}
                  onCreateTemplate={async () => {}}
                  onUpdateTemplate={async () => {}}
                  onDeleteTemplate={async () => {}}
                  onAnalyzeTemplate={async () => ({})}
                  subscriptionTier={subscriptionTier}
                />
              </TabsContent>

              <TabsContent value="safety">
                {safetyStatus ? (
                  <EnhancedSafetyMonitor
                    userId={userId}
                    status={safetyStatus}
                    onEmergencyStop={handleEmergencyStop}
                    onResumeAutomation={handleResumeAutomation}
                    onAcknowledgeAlert={async () => {}}
                    subscriptionTier={subscriptionTier}
                  />
                ) : (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Loading safety monitor...</p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Enhanced Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setError(null)}
                className="ml-4"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* WebSocket Error Alert */}
      {wsError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <Alert variant="default" className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              Connection issues detected. Real-time updates may be delayed.
              <Button
                variant="link"
                size="sm"
                onClick={reconnectWs}
                className="ml-2 h-auto p-0 text-yellow-700"
              >
                Retry connection
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}