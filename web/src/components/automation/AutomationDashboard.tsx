"use client";

import React, { useState, useEffect } from "react";
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
  FileText
} from "lucide-react";

import { ConnectionAutomation } from "./ConnectionAutomation";
import { EngagementAutomation } from "./EngagementAutomation";
import { SafetyMonitorWidget } from "./SafetyMonitorWidget";
import { AutomationQueuePanel } from "./AutomationQueuePanel";
import { TemplateManager } from "./TemplateManager";
import { AutomationSettings } from "./AutomationSettings";

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
  onSettingsOpen
}: AutomationDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'connections' | 'engagement' | 'queue' | 'templates' | 'safety'>('overview');
  const [overview, setOverview] = useState<AutomationOverview | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3007/automation/dashboard/${userId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Dashboard WebSocket connected');
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastUpdate(new Date());
        
        switch (data.type) {
          case 'overview_update':
            setOverview(data.overview);
            break;
          case 'queue_update':
            setQueueItems(data.queueItems);
            break;
          case 'safety_update':
            setSafetyStatus(data.safetyStatus);
            break;
          case 'template_update':
            setTemplates(data.templates);
            break;
          case 'automation_alert':
            // Handle automation alerts
            console.log('Automation alert:', data.alert);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('Dashboard WebSocket disconnected');
      setWsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    return () => {
      ws.close();
    };
  }, [userId, realTimeUpdates]);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [overviewResponse, templatesResponse, queueResponse, safetyResponse] = await Promise.all([
          fetch('/api/automation/overview'),
          fetch('/api/automation/templates'),
          fetch('/api/automation/queue'),
          fetch('/api/automation/safety/status')
        ]);

        if (!overviewResponse.ok) throw new Error('Failed to fetch overview');
        if (!templatesResponse.ok) throw new Error('Failed to fetch templates');
        if (!queueResponse.ok) throw new Error('Failed to fetch queue');
        if (!safetyResponse.ok) throw new Error('Failed to fetch safety status');

        const overviewData = await overviewResponse.json();
        const templatesData = await templatesResponse.json();
        const queueData = await queueResponse.json();
        const safetyData = await safetyResponse.json();

        setOverview(overviewData);
        setTemplates(templatesData);
        setQueueItems(queueData);
        setSafetyStatus(safetyData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load automation data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleScheduleConnection = async (connectionData: any) => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/connections/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionData)
      });

      if (!response.ok) throw new Error('Failed to schedule connection');
      
      // The WebSocket will update the UI automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule connection');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleEngagement = async (engagementData: any) => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/engagement/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(engagementData)
      });

      if (!response.ok) throw new Error('Failed to schedule engagement');
      
      // The WebSocket will update the UI automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule engagement');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/automation/emergency-stop', {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to stop automation');
      
      // The WebSocket will update the UI automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop automation');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'critical':
        return 'text-red-500';
      case 'suspended':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
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

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">LinkedIn Automation</h1>
              {safetyStatus && (
                <div className="flex items-center space-x-2">
                  {getStatusIcon(safetyStatus.overallStatus)}
                  <span className={`text-sm font-medium ${getStatusColor(safetyStatus.overallStatus)}`}>
                    {safetyStatus.overallStatus.charAt(0).toUpperCase() + safetyStatus.overallStatus.slice(1)}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Real-time Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
                <span className="text-xs text-gray-500">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </div>

              {/* Real-time Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRealTimeUpdates(!realTimeUpdates)}
              >
                <Activity className={`h-4 w-4 mr-2 ${realTimeUpdates ? 'text-green-500' : 'text-gray-400'}`} />
                {realTimeUpdates ? 'Live Updates' : 'Paused'}
              </Button>

              {/* Emergency Stop */}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmergencyStop}
                disabled={loading || safetyStatus?.overallStatus === 'suspended'}
              >
                <Square className="h-4 w-4 mr-2" />
                Emergency Stop
              </Button>

              {/* Settings */}
              <Button variant="outline" size="sm" onClick={onSettingsOpen}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
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
                  <Badge variant="secondary">{overview.connections.pending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="engagement" className="flex items-center space-x-2">
                <Heart className="h-4 w-4" />
                <span>Engagement</span>
                {overview?.engagement.pending > 0 && (
                  <Badge variant="secondary">{overview.engagement.pending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="queue" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Queue</span>
                {queueItems.length > 0 && (
                  <Badge variant="secondary">{queueItems.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Templates</span>
                <Badge variant="secondary">{templates.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="safety" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Safety</span>
                {safetyStatus?.activeAlerts.length > 0 && (
                  <Badge variant="destructive">{safetyStatus.activeAlerts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <div className="py-6">
              <TabsContent value="overview" className="space-y-6">
                {overview && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Overview Cards */}
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle>Automation Overview</CardTitle>
                        <CardDescription>Your automation performance at a glance</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{overview.connections.total}</div>
                            <p className="text-sm text-gray-600">Total Connections</p>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{overview.engagement.total}</div>
                            <p className="text-sm text-gray-600">Engagements</p>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{overview.automation.successRate}%</div>
                            <p className="text-sm text-gray-600">Success Rate</p>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{overview.safety?.score || 0}</div>
                            <p className="text-sm text-gray-600">Safety Score</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Safety Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Safety Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {safetyStatus && (
                          <SafetyMonitorWidget
                            userId={userId}
                            status={safetyStatus}
                            onEmergencyStop={handleEmergencyStop}
                            onResumeAutomation={() => {}}
                            onAcknowledgeAlert={() => {}}
                          />
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
                <AutomationQueuePanel
                  userId={userId}
                  queueItems={queueItems}
                  onUpdatePriority={async () => {}}
                  onCancelItem={async () => {}}
                  onRetryItem={async () => {}}
                  onBulkAction={async () => {}}
                />
              </TabsContent>

              <TabsContent value="templates">
                <TemplateManager
                  userId={userId}
                  templates={templates}
                  onCreateTemplate={async () => {}}
                  onUpdateTemplate={async () => {}}
                  onDeleteTemplate={async () => {}}
                  onAnalyzeTemplate={async () => ({})}
                />
              </TabsContent>

              <TabsContent value="safety">
                {safetyStatus && (
                  <SafetyMonitorWidget
                    userId={userId}
                    status={safetyStatus}
                    onEmergencyStop={handleEmergencyStop}
                    onResumeAutomation={() => {}}
                    onAcknowledgeAlert={() => {}}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}