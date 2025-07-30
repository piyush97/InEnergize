"use client";

import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  Suspense,
  useRef,
  memo 
} from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Globe,
  Cpu,
  Network,
  Wifi,
  WifiOff
} from "lucide-react";

import { useAutomation } from "@/contexts/AutomationContext";
import { useWebSocket, useWebSocketEvent, useWebSocketPerformance } from "@/contexts/WebSocketProvider";
import { AutomationOverview, SafetyStatus, QueueItem } from "@/types/automation";

// Lazy load heavy components for performance
const LazyTemplateManager = React.lazy(() => 
  import("./EnhancedTemplateManager").then(module => ({ default: module.EnhancedTemplateManager }))
);

const LazyQueueManager = React.lazy(() => 
  import("./EnhancedQueueManager").then(module => ({ default: module.EnhancedQueueManager }))
);

const LazySafetyMonitor = React.lazy(() => 
  import("./ProductionSafetyMonitor").then(module => ({ default: module.default }))
);

const LazyEmergencyStop = React.lazy(() => 
  import("./EmergencyStopComponent").then(module => ({ default: module.default }))
);

interface ProductionAutomationDashboardProps {
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  onSettingsOpen?: () => void;
  className?: string;
}

// Memoized metric card component for performance
const MetricCard = memo(({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend,
  subtitle,
  variant = "default",
  ariaLabel
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  ariaLabel?: string;
}) => {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';
  const variantStyles = {
    default: 'border-gray-200',
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    danger: 'border-red-200 bg-red-50'
  };

  return (
    <Card className={`${variantStyles[variant]} transition-all duration-200 hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-5 w-5 text-gray-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p 
                className="text-2xl font-bold text-gray-900"
                aria-label={ariaLabel || `${title}: ${value}`}
              >
                {value}
              </p>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {change !== undefined && (
            <div className={`flex items-center ${trendColor}`}>
              <TrendingUp className={`h-4 w-4 ${trend === 'down' ? 'rotate-180' : ''}`} />
              <span className="text-sm font-medium ml-1">
                {change > 0 ? '+' : ''}{change}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

MetricCard.displayName = 'MetricCard';

// Connection health indicator component
const ConnectionHealthIndicator = memo(() => {
  const { isConnected, connectionState, healthScore } = useWebSocket();
  const { latency, averageLatency, throughput } = useWebSocketPerformance();
  
  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getHealthStatus = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-600 mr-2" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-600 mr-2" />
          )}
          Real-time Connection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Health Score</span>
            <span className={`font-bold ${getHealthColor(healthScore)}`}>
              {healthScore}/100 ({getHealthStatus(healthScore)})
            </span>
          </div>
          
          <Progress value={healthScore} className="h-2" />
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Latency</span>
              <p className="font-medium">{latency}ms</p>
            </div>
            <div>
              <span className="text-gray-500">Avg. Latency</span>
              <p className="font-medium">{Math.round(averageLatency)}ms</p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p className="font-medium capitalize">{connectionState}</p>
            </div>
            <div>
              <span className="text-gray-500">Throughput</span>
              <p className="font-medium">{throughput} msgs</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ConnectionHealthIndicator.displayName = 'ConnectionHealthIndicator';

export default function ProductionAutomationDashboard({ 
  userId, 
  subscriptionTier, 
  onSettingsOpen,
  className 
}: ProductionAutomationDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isEmergencyStopVisible, setIsEmergencyStopVisible] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderTime: 0,
    lastUpdate: Date.now(),
  });
  
  // Performance monitoring
  const renderStartTime = useRef(Date.now());
  
  // Automation context
  const {
    overview,
    safetyStatus,
    queueItems,
    templates,
    settings,
    isLoading,
    error,
    connectionHealth,
    emergencyStop,
    resumeAutomation,
  } = useAutomation();

  // WebSocket connection status
  const { isConnected, healthScore } = useWebSocket();
  
  // Real-time event handlers
  useWebSocketEvent('automation_status', useCallback((data) => {
    console.log('📊 Automation status update:', data);
  }, []));
  
  useWebSocketEvent('safety_alert', useCallback((data) => {
    console.warn('🚨 Safety alert received:', data);
    // Could trigger toast notifications here
  }, []));

  // Performance tracking
  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    setPerformanceMetrics(prev => ({
      ...prev,
      renderTime,
      lastUpdate: Date.now(),
    }));
  }, [overview, safetyStatus, queueItems]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape key to close emergency stop modal
      if (event.key === 'Escape' && isEmergencyStopVisible) {
        setIsEmergencyStopVisible(false);
      }
      
      // Alt + E for emergency stop (accessibility)
      if (event.altKey && event.key === 'e') {
        event.preventDefault();
        setIsEmergencyStopVisible(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEmergencyStopVisible]);

  // Enhanced metrics calculation
  const dashboardMetrics = useMemo(() => {
    if (!overview || !safetyStatus) return null;

    const todayConnections = safetyStatus.metrics.dailyConnections;
    const todayLikes = safetyStatus.metrics.dailyLikes;
    const todayComments = safetyStatus.metrics.dailyComments;
    const todayViews = safetyStatus.metrics.dailyProfileViews;
    
    // LinkedIn's conservative limits (15% of actual limits)
    const limits = {
      connections: 15, // LinkedIn allows ~100/day
      likes: 30,       // LinkedIn allows ~200/day
      comments: 8,     // LinkedIn allows ~50/day  
      views: 25,       // LinkedIn allows ~150/day
    };

    return {
      connectionsUsed: `${todayConnections}/${limits.connections}`,
      connectionsPercentage: (todayConnections / limits.connections) * 100,
      likesUsed: `${todayLikes}/${limits.likes}`,
      likesPercentage: (todayLikes / limits.likes) * 100,
      commentsUsed: `${todayComments}/${limits.comments}`,
      commentsPercentage: (todayComments / limits.comments) * 100,
      viewsUsed: `${todayViews}/${limits.views}`,
      viewsPercentage: (todayViews / limits.views) * 100,
      
      acceptanceRate: safetyStatus.metrics.connectionAcceptanceRate,
      engagementRate: safetyStatus.metrics.engagementSuccessRate,
      responseTime: safetyStatus.metrics.averageResponseTime,
      
      queueLength: queueItems?.length || 0,
      activeTemplates: templates?.filter(t => t.isActive).length || 0,
    };
  }, [overview, safetyStatus, queueItems, templates]);

  // Loading state with accessibility
  if (isLoading || !dashboardMetrics) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading dashboard">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="sr-only">Loading automation dashboard...</span>
      </div>
    );
  }

  // Error state with accessibility
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load automation dashboard: {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} role="main" aria-label="Automation Dashboard">
      {/* Header with emergency stop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Ultra-conservative LinkedIn automation with 15% safety limits
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsEmergencyStopVisible(true)}
            className="bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500"
            aria-label="Emergency stop all automation (Alt+E)"
          >
            <Square className="h-4 w-4 mr-2" />
            Emergency Stop
          </Button>
          
          {onSettingsOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSettingsOpen}
              aria-label="Open automation settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Connection Health Indicator */}
      <ConnectionHealthIndicator />

      {/* Daily Usage Metrics - Mobile First Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Connections"
          value={dashboardMetrics.connectionsUsed}
          icon={Users}
          trend={dashboardMetrics.connectionsPercentage < 80 ? 'stable' : 'up'}
          subtitle={`${dashboardMetrics.connectionsPercentage.toFixed(1)}% of daily limit`}
          variant={dashboardMetrics.connectionsPercentage > 90 ? 'danger' : 
                  dashboardMetrics.connectionsPercentage > 75 ? 'warning' : 'default'}
          ariaLabel={`Daily connections: ${dashboardMetrics.connectionsUsed}, ${dashboardMetrics.connectionsPercentage.toFixed(1)}% of limit used`}
        />
        
        <MetricCard
          title="Likes"
          value={dashboardMetrics.likesUsed}
          icon={MessageSquare}
          trend={dashboardMetrics.likesPercentage < 80 ? 'stable' : 'up'}
          subtitle={`${dashboardMetrics.likesPercentage.toFixed(1)}% of daily limit`}
          variant={dashboardMetrics.likesPercentage > 90 ? 'danger' : 
                  dashboardMetrics.likesPercentage > 75 ? 'warning' : 'default'}
          ariaLabel={`Daily likes: ${dashboardMetrics.likesUsed}, ${dashboardMetrics.likesPercentage.toFixed(1)}% of limit used`}
        />
        
        <MetricCard
          title="Comments"
          value={dashboardMetrics.commentsUsed}
          icon={MessageSquare}
          trend={dashboardMetrics.commentsPercentage < 80 ? 'stable' : 'up'}
          subtitle={`${dashboardMetrics.commentsPercentage.toFixed(1)}% of daily limit`}
          variant={dashboardMetrics.commentsPercentage > 90 ? 'danger' : 
                  dashboardMetrics.commentsPercentage > 75 ? 'warning' : 'default'}
          ariaLabel={`Daily comments: ${dashboardMetrics.commentsUsed}, ${dashboardMetrics.commentsPercentage.toFixed(1)}% of limit used`}
        />
        
        <MetricCard
          title="Profile Views"
          value={dashboardMetrics.viewsUsed}
          icon={Eye}
          trend={dashboardMetrics.viewsPercentage < 80 ? 'stable' : 'up'}
          subtitle={`${dashboardMetrics.viewsPercentage.toFixed(1)}% of daily limit`}
          variant={dashboardMetrics.viewsPercentage > 90 ? 'danger' : 
                  dashboardMetrics.viewsPercentage > 75 ? 'warning' : 'default'}
          ariaLabel={`Daily profile views: ${dashboardMetrics.viewsUsed}, ${dashboardMetrics.viewsPercentage.toFixed(1)}% of limit used`}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Acceptance Rate"
          value={`${dashboardMetrics.acceptanceRate.toFixed(1)}%`}
          icon={Target}
          trend={dashboardMetrics.acceptanceRate > 25 ? 'up' : 'stable'}
          variant={dashboardMetrics.acceptanceRate > 30 ? 'success' : 'default'}
          ariaLabel={`Connection acceptance rate: ${dashboardMetrics.acceptanceRate.toFixed(1)}%`}
        />
        
        <MetricCard
          title="Queue Length"
          value={dashboardMetrics.queueLength}
          icon={Clock}
          trend="stable"
          subtitle="Pending actions"
          ariaLabel={`Queue length: ${dashboardMetrics.queueLength} pending actions`}
        />
        
        <MetricCard
          title="Active Templates"
          value={dashboardMetrics.activeTemplates}
          icon={FileText}
          trend="stable"
          subtitle="Message templates"
          ariaLabel={`Active templates: ${dashboardMetrics.activeTemplates} message templates`}
        />
      </div>

      {/* Tabbed Interface with Lazy Loading */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="safety" className="flex items-center">
            <Shield className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Safety</span>
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Queue</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4" role="tabpanel">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Real-time Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Automation Status</span>
                    <Badge variant={overview?.isActive ? "success" : "secondary"}>
                      {overview?.isActive ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Safety Score</span>
                    <span className={`font-bold ${
                      safetyStatus?.score >= 85 ? 'text-green-600' : 
                      safetyStatus?.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {safetyStatus?.score}/100
                    </span>
                  </div>
                  
                  <Progress value={safetyStatus?.score} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="h-5 w-5 mr-2" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Render Time</span>
                    <span className="font-medium">{performanceMetrics.renderTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Health Score</span>
                    <span className="font-medium">{healthScore}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Connection</span>
                    <Badge variant={isConnected ? "success" : "destructive"}>
                      {isConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="safety" role="tabpanel">
          <Suspense fallback={
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="sr-only">Loading safety monitor...</span>
            </div>
          }>
            <LazySafetyMonitor 
              userId={userId}
              subscriptionTier={subscriptionTier}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="queue" role="tabpanel">
          <Suspense fallback={
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="sr-only">Loading queue manager...</span>
            </div>
          }>
            <LazyQueueManager 
              userId={userId}
              subscriptionTier={subscriptionTier}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates" role="tabpanel">
          <Suspense fallback={
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="sr-only">Loading template manager...</span>
            </div>
          }>
            <LazyTemplateManager 
              userId={userId}
              subscriptionTier={subscriptionTier}
            />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Emergency Stop Modal */}
      {isEmergencyStopVisible && (
        <Suspense fallback={null}>
          <LazyEmergencyStop
            isOpen={isEmergencyStopVisible}
            onClose={() => setIsEmergencyStopVisible(false)}
            onConfirm={emergencyStop}
            currentStatus={overview?.isActive ? 'active' : 'paused'}
          />
        </Suspense>
      )}

      {/* Performance Debug Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-8 p-4 bg-gray-50 rounded-lg">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            🔧 Debug Performance Metrics
          </summary>
          <pre className="mt-2 text-xs text-gray-600 overflow-auto">
            {JSON.stringify({
              renderTime: performanceMetrics.renderTime,
              healthScore,
              isConnected,
              queueLength: dashboardMetrics.queueLength,
              activeTab,
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}