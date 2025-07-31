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
  BarChart3,
  Settings,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Download,
  Loader2,
  ChevronRight,
  Heart
} from "lucide-react";

// Import enhanced components
import { AutomationProvider, useAutomation } from "@/contexts/AutomationContext";
// import { AutomationCard, MetricCard, QuickActionCard } from "@/design-system/components/AutomationCard";
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


// Overview Tab Component
const OverviewTab: React.FC<{ setActiveTab: (tab: 'overview' | 'templates' | 'queue' | 'safety' | 'settings') => void }> = ({ setActiveTab }) => {
  const { overview, safetyStatus, queueItems, scheduleConnection, scheduleEngagement } = useAutomation();
  
  const quickActions = [
    {
      title: "Schedule Connection",
      description: "Add new connection request to queue",
      icon: Users,
      onClick: () => scheduleConnection({
        targetProfileId: 'https://linkedin.com/in/example',
        message: 'Hi, I would like to connect!',
        priority: 'medium'
      }),
      badge: { label: "Active", variant: "default" as const }
    },
    {
      title: "Schedule Engagement",
      description: "Queue engagement actions",
      icon: Heart,
      onClick: () => scheduleEngagement({
        targetId: 'https://linkedin.com/in/example',
        type: 'like',
        priority: 'medium'
      }),
      badge: { label: "Active", variant: "default" as const }
    },
    {
      title: "Manage Templates",
      description: "Create and edit message templates",
      icon: MessageSquare,
      onClick: () => setActiveTab('templates'),
      badge: null
    },
    {
      title: "View Analytics",
      description: "Performance metrics and insights",
      icon: BarChart3,
      onClick: () => {},
      badge: null
    }
  ];
  
  return (
    <div className="space-y-6">
      {/* Daily Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safetyStatus?.metrics.dailyConnections || 0}</div>
            <div className="text-xs text-muted-foreground">/ 15 daily limit</div>
          </CardContent>
        </Card>
        
        <Card className="p-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Likes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safetyStatus?.metrics.dailyLikes || 0}</div>
            <div className="text-xs text-muted-foreground">/ 30 daily limit</div>
          </CardContent>
        </Card>
        
        <Card className="p-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safetyStatus?.metrics.dailyComments || 0}</div>
            <div className="text-xs text-muted-foreground">/ 8 daily limit</div>
          </CardContent>
        </Card>
        
        <Card className="p-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safetyStatus?.metrics.dailyProfileViews || 0}</div>
            <div className="text-xs text-muted-foreground">/ 25 daily limit</div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Success Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.connections.acceptanceRate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">LinkedIn connections accepted</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.engagement.successRate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">Successful engagement actions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueItems?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Pending automation tasks</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => setActiveTab('queue')}
            >
              Manage Queue
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, index) => (
            <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  <action.icon className="h-5 w-5" />
                  <CardTitle className="text-sm font-medium">{action.title}</CardTitle>
                </div>
                {action.badge && <Badge variant="secondary">{action.badge.label}</Badge>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{action.description}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={action.onClick}
                >
                  {action.title}
                </Button>
              </CardContent>
            </Card>
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
          {safetyStatus?.activeAlerts && safetyStatus.activeAlerts.length > 0 ? (
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
};

// Main Dashboard Component  
function AutomationDashboardContent() {
  const { 
    safetyStatus, 
    isConnected, 
    connectionLatency, 
    error
  } = useAutomation();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'queue' | 'safety' | 'settings'>('overview');
  const [autoRefresh] = useState(true);

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Refresh data here
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'templates' | 'queue' | 'safety' | 'settings')}>
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
            <OverviewTab setActiveTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="templates">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <LazyTemplateManager
                userId="user-id"
                subscriptionTier="premium"
                templates={[]}
                onCreateTemplate={async () => {}}
                onUpdateTemplate={async () => {}}
                onDeleteTemplate={async () => {}}
                onAnalyzeTemplate={async () => ({ success: true })}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="queue">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <LazyQueueManager
                queueItems={[]}
                onUpdatePriority={async () => {}}
                onCancelItem={async () => {}}
                onRetryItem={async () => {}}
                onBulkAction={async () => {}}
                subscriptionTier="premium"
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="safety">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <LazySafetyMonitor
                userId="user-id"
                status={{ 
                  overallStatus: 'healthy', 
                  score: 85, 
                  activeAlerts: [], 
                  lastHealthCheck: new Date(), 
                  riskFactors: [],
                  metrics: {
                    dailyConnections: 0,
                    dailyLikes: 0,
                    dailyComments: 0,
                    dailyProfileViews: 0,
                    dailyFollows: 0,
                    connectionAcceptanceRate: 0,
                    engagementSuccessRate: 0,
                    averageResponseTime: 0
                  }
                }}
                onEmergencyStop={async () => {}}
                onResumeAutomation={async () => {}}
                subscriptionTier="premium"
                onAcknowledgeAlert={async () => {}}
              />
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