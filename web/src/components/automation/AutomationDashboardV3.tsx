"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity,
  Shield,
  Clock,
  Users,
  MessageSquare,
  Eye,
  UserPlus,
  BarChart3,
  Settings,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Square,
  RefreshCw,
  Download,
  Bell,
  BellOff,
  Loader2,
  ChevronRight,
  Calendar,
  Globe
} from "lucide-react";

// Import enhanced components
import { AutomationProvider, useAutomation } from "@/contexts/AutomationContext";
import { AutomationCard, MetricCard, QuickActionCard } from "@/design-system/components/AutomationCard";
import { EnhancedTemplateManager } from "./EnhancedTemplateManager";
import { EnhancedQueueManager } from "./EnhancedQueueManager";
import { EnhancedSafetyMonitor } from "./EnhancedSafetyMonitor";
import { AutomationSettings } from "./AutomationSettings";

// Lazy load heavy components for better performance
const LazyTemplateManager = React.lazy(() => 
  import("./EnhancedTemplateManager").then(module => ({ default: module.EnhancedTemplateManager }))
);

const LazyQueueManager = React.lazy(() => 
  import("./EnhancedQueueManager").then(module => ({ default: module.EnhancedQueueManager }))
);

const LazySafetyMonitor = React.lazy(() => 
  import("./EnhancedSafetyMonitor").then(module => ({ default: module.EnhancedSafetyMonitor }))
);

interface AutomationDashboardV3Props {
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
}

// Main Dashboard Component
function AutomationDashboardContent() {
  const { 
    overview, 
    safetyStatus, 
    isConnected, 
    connectionLatency, 
    emergencyStop,
    scheduleConnection,
    scheduleEngagement,
    isLoading,
    error 
  } = useAutomation();

  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'queue' | 'safety' | 'settings' | 'analytics'>('overview');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isEmergencyStopPending, setIsEmergencyStopPending] = useState(false);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Real-time notification handler
  useEffect(() => {
    if (!notificationsEnabled || !safetyStatus) return;
    
    // Check for critical alerts
    const criticalAlerts = safetyStatus.activeAlerts.filter(alert => 
      alert.severity === 'critical' && !alert.acknowledged
    );
    
    if (criticalAlerts.length > 0) {
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification('LinkedIn Automation Alert', {
          body: `${criticalAlerts.length} critical safety alert(s) require attention`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
        });
      }
    }
  }, [safetyStatus?.activeAlerts, notificationsEnabled]);

  // Enhanced emergency stop with confirmation
  const handleEmergencyStop = useCallback(async () => {
    if (isEmergencyStopPending) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to trigger an emergency stop? This will immediately halt all automation activities.'
    );
    
    if (confirmed) {
      setIsEmergencyStopPending(true);
      try {
        await emergencyStop();
        // Show success notification
        if (Notification.permission === 'granted') {
          new Notification('Emergency Stop Activated', {
            body: 'All automation activities have been halted',
            icon: '/icon-192x192.png',
          });
        }
      } catch (error) {
        console.error('Emergency stop failed:', error);
      } finally {
        setIsEmergencyStopPending(false);
      }
    }
  }, [emergencyStop, isEmergencyStopPending]);

  // Quick actions for common tasks
  const quickActions = [
    {
      title: "Schedule Connections",
      description: "Add new connection requests to queue",
      icon: Users,
      onClick: () => setActiveTab('queue'),
      badge: overview?.connections.pending > 0 ? `${overview.connections.pending} pending` : undefined,
      disabled: safetyStatus?.overallStatus === 'critical' || safetyStatus?.overallStatus === 'suspended',
    },
    {
      title: "Create Template",
      description: "Design new message templates",
      icon: MessageSquare,
      onClick: () => setActiveTab('templates'),  
    },
    {
      title: "View Analytics",
      description: "Track automation performance",
      icon: BarChart3,
      onClick: () => setActiveTab('analytics'),
    },
    {
      title: "Safety Review",
      description: "Check compliance status",
      icon: Shield,
      onClick: () => setActiveTab('safety'),
      badge: safetyStatus?.activeAlerts.some(a => a.severity === 'critical') ? 'Critical' : undefined,
      urgent: safetyStatus?.activeAlerts.some(a => a.severity === 'critical'),
    },
  ];

  // Real-time metrics calculations
  const realTimeMetrics = useMemo(() => {
    if (!overview || !safetyStatus) return null;

    const connectionSuccessRate = overview.connections.completed > 0 
      ? (overview.connections.successful / overview.connections.completed * 100).toFixed(1)
      : '0';

    const engagementRate = overview.engagement.completed > 0
      ? (overview.engagement.successful / overview.engagement.completed * 100).toFixed(1)
      : '0';

    const healthScore = safetyStatus.score || 0;
    const riskLevel = healthScore >= 80 ? 'low' : healthScore >= 60 ? 'medium' : 'high';

    return {
      connectionSuccessRate: parseFloat(connectionSuccessRate),
      engagementRate: parseFloat(engagementRate),
      healthScore,
      riskLevel,
      dailyActivity: {
        connections: overview.connections.today || 0,
        likes: overview.engagement.likes?.today || 0,
        comments: overview.engagement.comments?.today || 0,
        profileViews: overview.engagement.profileViews?.today || 0,
      },
      limits: {
        connectionsRemaining: Math.max(0, 15 - (overview.connections.today || 0)),
        likesRemaining: Math.max(0, 30 - (overview.engagement.likes?.today || 0)),
        commentsRemaining: Math.max(0, 8 - (overview.engagement.comments?.today || 0)),
        profileViewsRemaining: Math.max(0, 25 - (overview.engagement.profileViews?.today || 0)),
      }
    };
  }, [overview, safetyStatus]);

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Real-time Status Banner */}
      <div className={`p-6 rounded-lg border-2 transition-all duration-300 ${
        safetyStatus?.overallStatus === 'healthy' ? 'bg-green-50 border-green-200' :
        safetyStatus?.overallStatus === 'warning' ? 'bg-yellow-50 border-yellow-200' :
        safetyStatus?.overallStatus === 'critical' ? 'bg-red-50 border-red-200 animate-pulse' :
        safetyStatus?.overallStatus === 'suspended' ? 'bg-gray-50 border-gray-400' :
        'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${
              safetyStatus?.overallStatus === 'healthy' ? 'bg-green-100' :
              safetyStatus?.overallStatus === 'warning' ? 'bg-yellow-100' :
              safetyStatus?.overallStatus === 'critical' ? 'bg-red-100' :
              'bg-gray-100'
            }`}>
              {safetyStatus?.overallStatus === 'healthy' && <CheckCircle className="h-6 w-6 text-green-600" />}
              {safetyStatus?.overallStatus === 'warning' && <AlertTriangle className="h-6 w-6 text-yellow-600" />}
              {safetyStatus?.overallStatus === 'critical' && <AlertCircle className="h-6 w-6 text-red-600" />}
              {safetyStatus?.overallStatus === 'suspended' && <XCircle className="h-6 w-6 text-gray-600" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold capitalize">
                Automation Status: {safetyStatus?.overallStatus || 'Unknown'}
              </h3>
              <p className="text-sm text-gray-600">
                Health Score: {safetyStatus?.score || 0}/100 | 
                Connection: {isConnected ? (
                  <span className="text-green-600 font-medium">
                    Live ({connectionLatency}ms)
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">Disconnected</span>
                )} |
                Last Updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          {/* Emergency Stop Button */}
          <Button
            variant={safetyStatus?.overallStatus === 'critical' ? 'destructive' : 'outline'}
            size="lg"
            onClick={handleEmergencyStop}
            disabled={isEmergencyStopPending || safetyStatus?.overallStatus === 'suspended'}
            className={`${
              safetyStatus?.overallStatus === 'critical' 
                ? 'animate-pulse bg-red-600 hover:bg-red-700' 
                : ''
            }`}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {isEmergencyStopPending ? 'Stopping...' : 'Emergency Stop'}
          </Button>
        </div>

        {/* Active Alerts Preview */}
        {safetyStatus?.activeAlerts && safetyStatus.activeAlerts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Active Alerts ({safetyStatus.activeAlerts.length})
              </span>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => setActiveTab('safety')}
                className="text-blue-600 hover:text-blue-800"
              >
                View All →
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {safetyStatus.activeAlerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    alert.severity === 'critical' ? 'bg-red-500' :
                    alert.severity === 'warning' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <span className="text-gray-700">{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Real-time Metrics Grid */}
      {realTimeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Health Score</p>
                <div className="flex items-center space-x-2 mt-2">
                  <div className="text-2xl font-bold">
                    {realTimeMetrics.healthScore}
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    realTimeMetrics.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                    realTimeMetrics.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {realTimeMetrics.riskLevel} risk
                  </div>
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <Progress 
              value={realTimeMetrics.healthScore} 
              className="mt-3"
              indicatorClassName={
                realTimeMetrics.healthScore >= 80 ? 'bg-green-500' :
                realTimeMetrics.healthScore >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Daily Connections</p>
                <div className="text-2xl font-bold mt-2">
                  {realTimeMetrics.dailyActivity.connections}/15
                </div>
                <p className="text-xs text-gray-500">
                  {realTimeMetrics.limits.connectionsRemaining} remaining
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <Progress 
              value={(realTimeMetrics.dailyActivity.connections / 15) * 100}
              className="mt-3"
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <div className="text-2xl font-bold mt-2">
                  {realTimeMetrics.connectionSuccessRate}%
                </div>
                <p className="text-xs text-gray-500">Connection success</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Engagement</p>
                <div className="text-2xl font-bold mt-2">
                  {realTimeMetrics.dailyActivity.likes + realTimeMetrics.dailyActivity.comments}
                </div>
                <p className="text-xs text-gray-500">
                  {realTimeMetrics.dailyActivity.likes} likes, {realTimeMetrics.dailyActivity.comments} comments
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Heart className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Card 
              key={index} 
              className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-200'
              } ${action.urgent ? 'border-red-200 bg-red-50' : ''}`}
              onClick={action.disabled ? undefined : action.onClick}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-full ${
                  action.urgent ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <action.icon className={`h-5 w-5 ${
                    action.urgent ? 'text-red-600' : 'text-gray-600'
                  }`} />
                </div>
                {action.badge && (
                  <Badge variant={action.urgent ? 'destructive' : 'secondary'}>
                    {action.badge}
                  </Badge>
                )}
              </div>
              <h4 className="font-medium text-sm">{action.title}</h4>
              <p className="text-xs text-gray-500 mt-1">{action.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live Updates' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="space-y-3">
          {overview?.recentActivity ? overview.recentActivity.slice(0, 5).map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 py-2 border-b border-gray-100 last:border-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                activity.type === 'connection' ? 'bg-blue-100 text-blue-600' :
                activity.type === 'engagement' ? 'bg-green-100 text-green-600' :
                activity.type === 'alert' ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                {activity.type === 'connection' && <Users className="h-4 w-4" />}
                {activity.type === 'engagement' && <Heart className="h-4 w-4" />}
                {activity.type === 'alert' && <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{activity.message}</p>
                <p className="text-xs text-gray-500">{activity.timestamp}</p>
              </div>
              <Badge variant={
                activity.status === 'success' ? 'default' :
                activity.status === 'warning' ? 'secondary' :
                activity.status === 'error' ? 'destructive' :
                'outline'
              }>
                {activity.status}
              </Badge>
            </div>
          )) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              safetyStatus?.overallStatus === 'healthy' ? 'bg-green-500' :
              safetyStatus?.overallStatus === 'warning' ? 'bg-yellow-500' :
              safetyStatus?.overallStatus === 'critical' ? 'bg-red-500' :
              'bg-gray-500'
            }`} />
            
            <div>
              <h3 className="font-semibold">
                Automation Status: {safetyStatus?.overallStatus?.toUpperCase() || 'UNKNOWN'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Safety Score: {safetyStatus?.score || 0}/100 | 
                Connection: {isConnected ? `Live (${connectionLatency}ms)` : 'Offline'} |
                Last Update: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Auto-refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            >
              {notificationsEnabled ? <Bell className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
              Alerts
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={emergencyStop}
              disabled={isLoading}
            >
              <Square className="h-4 w-4 mr-1" />
              Emergency Stop
            </Button>
          </div>
        </div>
      </div>

      {/* Daily Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Connections"
          current={safetyStatus?.metrics.dailyConnections || 0}
          limit={15}
          status={
            (safetyStatus?.metrics.dailyConnections || 0) >= 12 ? 'critical' :
            (safetyStatus?.metrics.dailyConnections || 0) >= 8 ? 'warning' : 'safe'
          }
        />
        
        <MetricCard
          title="Likes"
          current={safetyStatus?.metrics.dailyLikes || 0}
          limit={30}
          status={
            (safetyStatus?.metrics.dailyLikes || 0) >= 25 ? 'critical' :
            (safetyStatus?.metrics.dailyLikes || 0) >= 18 ? 'warning' : 'safe'
          }
        />
        
        <MetricCard
          title="Comments"
          current={safetyStatus?.metrics.dailyComments || 0}
          limit={8}
          status={
            (safetyStatus?.metrics.dailyComments || 0) >= 6 ? 'critical' :
            (safetyStatus?.metrics.dailyComments || 0) >= 4 ? 'warning' : 'safe'
          }
        />
        
        <MetricCard
          title="Profile Views"
          current={safetyStatus?.metrics.dailyProfileViews || 0}
          limit={25}
          status={
            (safetyStatus?.metrics.dailyProfileViews || 0) >= 20 ? 'critical' :
            (safetyStatus?.metrics.dailyProfileViews || 0) >= 15 ? 'warning' : 'safe'
          }
        />
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AutomationCard
          title="Connection Success Rate"
          value={`${overview?.connections.acceptanceRate?.toFixed(1) || 0}%`}
          description="LinkedIn connections accepted"
          icon={Users}
          trend={overview?.connections.acceptanceRate > 50 ? 'up' : overview?.connections.acceptanceRate < 30 ? 'down' : 'stable'}
          trendValue="vs last week"
          status={overview?.connections.acceptanceRate > 50 ? 'active' : 'warning'}
          progress={overview?.connections.acceptanceRate || 0}
        />
        
        <AutomationCard
          title="Engagement Rate"
          value={`${overview?.engagement.successRate?.toFixed(1) || 0}%`}
          description="Successful engagement actions"
          icon={Target}
          trend={overview?.engagement.successRate > 70 ? 'up' : overview?.engagement.successRate < 50 ? 'down' : 'stable'}
          trendValue="vs last week"
          status={overview?.engagement.successRate > 70 ? 'active' : 'warning'}
          progress={overview?.engagement.successRate || 0}
        />
        
        <AutomationCard
          title="Queue Status"
          value={overview?.automation.queueSize || 0}
          description="Pending automation tasks"
          icon={Clock}
          status={overview?.automation.enabled ? 'active' : 'paused'}
          actions={[
            {
              label: "Manage Queue",
              onClick: () => setActiveTab('queue'),
              icon: ChevronRight,
            }
          ]}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, index) => (
            <QuickActionCard
              key={index}
              title={action.title}
              description={action.description}
              icon={action.icon}
              onClick={action.onClick}
              badge={action.badge}
            />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest automation events and alerts</CardDescription>
        </CardHeader>
        <CardContent>
          {safetyStatus?.activeAlerts.length > 0 ? (
            <div className="space-y-3">
              {safetyStatus.activeAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-4 w-4 ${
                      alert.severity === 'critical' ? 'text-red-500' :
                      alert.severity === 'high' ? 'text-orange-500' :
                      alert.severity === 'medium' ? 'text-yellow-500' :
                      'text-blue-500'
                    }`} />
                    
                    <div>
                      <p className="font-medium text-sm">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">All Systems Normal</h3>
              <p className="text-muted-foreground">No recent alerts or issues detected</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">LinkedIn Automation</h1>
                  <p className="text-sm text-gray-500">Phase 3: Enterprise Automation Suite</p>
                </div>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">
                  {isConnected ? `Live (${connectionLatency}ms)` : 'Offline'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="safety" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Safety
              {safetyStatus?.activeAlerts.some(a => a.severity === 'critical') && (
                <Badge variant="destructive" className="ml-1 text-xs">!</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {renderOverviewTab()}
          </TabsContent>

          <TabsContent value="templates">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <LazyTemplateManager
                userId="user-id"
                templates={[]}
                onCreateTemplate={async () => {}}
                onUpdateTemplate={async () => {}}
                onDeleteTemplate={async () => {}}
                onAnalyzeTemplate={async () => ({})}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="queue">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <LazyQueueManager />
            </Suspense>
          </TabsContent>

          <TabsContent value="safety">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <LazySafetyMonitor />
            </Suspense>
          </TabsContent>

          <TabsContent value="settings">
            <AutomationSettings
              userId="user-id"
              settings={{
                connectionAutomation: {
                  enabled: true,
                  dailyLimit: 15,
                  minDelaySeconds: 45,
                  maxDelaySeconds: 180,
                  workingHours: { start: '09:00', end: '17:00' },
                  weekendsEnabled: false,
                  targetFilters: {
                    industries: [],
                    locations: [],
                    connectionDegree: ['2nd'],
                    hasProfilePicture: true,
                  },
                },
                engagementAutomation: {
                  enabled: true,
                  types: {
                    likes: { enabled: true, dailyLimit: 30 },
                    comments: { enabled: true, dailyLimit: 8 },
                    profileViews: { enabled: true, dailyLimit: 25 },
                    follows: { enabled: false, dailyLimit: 5 },
                  },
                  minDelaySeconds: 60,
                  maxDelaySeconds: 300,
                  workingHours: { start: '09:00', end: '17:00' },
                  weekendsEnabled: false,
                },
                safetySettings: {
                  emergencyStopThreshold: 40,
                  maxDailyActions: 100,
                  cooldownPeriodHours: 24,
                  alertEmail: true,
                },
              }}
              onUpdateSettings={async () => {}}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Main Dashboard Wrapper with Context Provider
export function AutomationDashboardV3({ userId, subscriptionTier }: AutomationDashboardV3Props) {
  return (
    <AutomationProvider userId={userId} subscriptionTier={subscriptionTier}>
      <AutomationDashboardContent />
    </AutomationProvider>
  );
}