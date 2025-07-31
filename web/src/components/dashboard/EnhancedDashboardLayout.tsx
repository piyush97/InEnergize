/**
 * Enhanced Dashboard Layout with Enterprise-level Features
 * Comprehensive dashboard with accessibility, responsive design, and real-time capabilities
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { useRealTimeMetrics } from './RealTimeMetricsProvider';
import { 
  EnhancedErrorBoundary, 
  AsyncErrorBoundary 
} from '@/components/ui/enhanced-error-boundary';
import { 
  ContextualLoading, 
  ConnectionStatus,
  LoadingButton,
  InlineLoading
} from '@/components/ui/loading-states';
import {
  DashboardSkeleton,
  MetricsWidgetSkeleton,
  AnalyticsChartSkeleton,
  ProfileCompletenessSkeletonProps as ProfileCompletenessSkeleton
} from '@/components/ui/enhanced-skeleton';

// Import existing components
import ProfileMetricsWidget from './ProfileMetricsWidget';
import ProfileCompletenessChart from './ProfileCompletenessChart';
import AnalyticsChart from './AnalyticsChart';
import ProfileOptimizationSuggestions from './ProfileOptimizationSuggestions';
import LiveActivityFeed from './LiveActivityFeed';
import GoalsWidget from './GoalsWidget';
import { AutomationDashboard } from '../automation';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

// Icons
import { 
  RefreshCw, 
  Download, 
  Settings, 
  Bell, 
  Shield, 
  TrendingUp, 
  Zap, 
  Star, 
  Users, 
  FileText, 
  Camera, 
  MessageSquare, 
  Eye, 
  Target, 
  CheckCircle,
  Bot,
  BarChart3,
  Home,
  Monitor,
  Moon,
  Sun,
  Menu,
  X,
  HelpCircle,
  ExternalLink,
  Maximize2,
  Minimize2,
  Filter,
  SortAsc,
  Grid,
  List,
  ChevronDown,
  Activity,
  AlertTriangle,
  Info
} from 'lucide-react';

// Types
import type { 
  BaseComponentProps,
  TimeRange,
  UserPreferences
} from '@/types/common';

// ===== INTERFACES =====

interface DashboardMetrics {
  snapshot: {
    profileViews: number;
    connections: number;
    completenessScore: number;
    engagementRate: number;
  };
  trend: {
    profileViews: number;
    connections: number;
    completenessScore: number;
    engagementRate: number;
  };
  benchmarks: {
    profileViews: number;
    connections: number;
    engagementRate: number;
  };
}

interface ServiceHealth {
  linkedin: boolean;
  analytics: boolean;
  automation: boolean;
  ai: boolean;
  checkedAt?: Date;
}

interface DashboardSettings {
  showDetailedBreakdown: boolean;
  showOptimizationSuggestions: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  compactView: boolean;
  showAdvancedMetrics: boolean;
  theme: 'light' | 'dark' | 'system';
  layout: 'grid' | 'list';
  selectedMetrics: string[];
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
}

interface EnhancedDashboardLayoutProps extends BaseComponentProps {
  userId?: string;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  initialTab?: string;
  preferences?: Partial<UserPreferences>;
  onPreferencesChange?: (preferences: Partial<UserPreferences>) => void;
}

// ===== MAIN COMPONENT =====

export function EnhancedDashboardLayout({
  className,
  userId,
  subscriptionTier = 'pro',
  initialTab = 'overview',
  preferences = {},
  onPreferencesChange,
  'data-testid': testId = 'enhanced-dashboard',
}: EnhancedDashboardLayoutProps) {
  // ===== STATE MANAGEMENT =====
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<DashboardMetrics | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [servicesHealth, setServicesHealth] = useState<ServiceHealth>({ 
    linkedin: false, 
    analytics: false, 
    automation: false,
    ai: false
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settings, setSettings] = useState<DashboardSettings>({
    showDetailedBreakdown: true,
    showOptimizationSuggestions: true,
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    compactView: false,
    showAdvancedMetrics: false,
    theme: 'light',
    layout: 'grid',
    selectedMetrics: ['profileViews', 'connections', 'engagementRate'],
    notifications: {
      email: true,
      push: false,
      inApp: true,
    },
    ...preferences,
  });

  // Real-time metrics hook
  const { 
    metrics, 
    isConnected: wsConnected, 
    lastError: wsError 
  } = useRealTimeMetrics();

  // ===== COMPUTED VALUES =====
  const overallHealthScore = useMemo(() => {
    const services = Object.values(servicesHealth).filter(Boolean);
    return Math.round((services.length / Object.keys(servicesHealth).length) * 100);
  }, [servicesHealth]);

  const isHealthy = overallHealthScore >= 75;
  const needsAttention = overallHealthScore < 50;

  // ===== EFFECTS =====
  
  // Service health monitoring
  useEffect(() => {
    const checkServicesHealth = async () => {
      try {
        const healthChecks = await Promise.allSettled([
          fetch('/api/v1/health/linkedin').then(r => r.ok),
          fetch('/api/v1/health/analytics').then(r => r.ok),
          fetch('/api/v1/health/automation').then(r => r.ok),
          fetch('/api/v1/health/ai').then(r => r.ok),
        ]);

        setServicesHealth({
          linkedin: healthChecks[0].status === 'fulfilled' && healthChecks[0].value,
          analytics: healthChecks[1].status === 'fulfilled' && healthChecks[1].value,
          automation: healthChecks[2].status === 'fulfilled' && healthChecks[2].value,
          ai: healthChecks[3].status === 'fulfilled' && healthChecks[3].value,
          checkedAt: new Date(),
        });
      } catch (error) {
        console.warn('Failed to check services health:', error);
      }
    };

    // Initial check
    checkServicesHealth();
    
    // Regular health checks
    const healthInterval = setInterval(checkServicesHealth, 2 * 60 * 1000);
    
    return () => clearInterval(healthInterval);
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!settings.autoRefresh) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, settings.refreshInterval);

    return () => clearInterval(interval);
  }, [settings.autoRefresh, settings.refreshInterval]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            handleRefresh();
            break;
          case '1':
            event.preventDefault();
            setActiveTab('overview');
            break;
          case '2':
            event.preventDefault();
            setActiveTab('automation');
            break;
          case '3':
            event.preventDefault();
            setActiveTab('analytics');
            break;
          case 'f':
            event.preventDefault();
            toggleFullscreen();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ===== HANDLERS =====

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/metrics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentMetrics(data.data);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        format: 'csv',
        includeMetrics: settings.selectedMetrics.join(','),
      });

      const response = await fetch(`/api/v1/metrics/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inergize-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  }, [settings.selectedMetrics]);

  const handleSettingsChange = useCallback((newSettings: Partial<DashboardSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    if (onPreferencesChange) {
      onPreferencesChange(updatedSettings);
    }
  }, [settings, onPreferencesChange]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // ===== RENDER HELPERS =====

  const renderServiceStatus = () => (
    <div className="flex items-center space-x-4 text-xs">
      <div className="flex items-center space-x-2">
        <Badge 
          variant={isHealthy ? 'default' : needsAttention ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          {overallHealthScore}% Health
        </Badge>
      </div>
      
      <div className="hidden sm:flex items-center space-x-3">
        {Object.entries(servicesHealth).map(([service, healthy]) => (
          <div key={service} className="flex items-center space-x-1">
            <div className={cn(
              'w-2 h-2 rounded-full',
              healthy ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span className="text-muted-foreground capitalize">{service}</span>
          </div>
        ))}
      </div>

      <ConnectionStatus
        connected={wsConnected}
        reconnecting={false}
        size="xs"
        showLabel={false}
      />
    </div>
  );

  const renderQuickActions = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center space-x-2">
          <Zap className="h-5 w-5 text-orange-600" />
          <span>Quick Actions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="outline" className="justify-start" size="sm">
            <Star className="h-4 w-4 mr-2" />
            Generate AI Headlines
          </Button>
          
          <Button variant="outline" className="justify-start" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Find New Connections
          </Button>
          
          <Button variant="outline" className="justify-start" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Create Content
          </Button>
          
          <Button variant="outline" className="justify-start" size="sm">
            <Camera className="h-4 w-4 mr-2" />
            Update Profile Photo
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderDashboardControls = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dashboard Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="detailed-breakdown" className="text-sm">
              Detailed Breakdown
            </Label>
            <Switch
              id="detailed-breakdown"
              checked={settings.showDetailedBreakdown}
              onCheckedChange={(checked) => 
                handleSettingsChange({ showDetailedBreakdown: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="optimization-suggestions" className="text-sm">
              Optimization Tips
            </Label>
            <Switch
              id="optimization-suggestions"
              checked={settings.showOptimizationSuggestions}
              onCheckedChange={(checked) => 
                handleSettingsChange({ showOptimizationSuggestions: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto Refresh
            </Label>
            <Switch
              id="auto-refresh"
              checked={settings.autoRefresh}
              onCheckedChange={(checked) => 
                handleSettingsChange({ autoRefresh: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="compact-view" className="text-sm">
              Compact View
            </Label>
            <Switch
              id="compact-view"
              checked={settings.compactView}
              onCheckedChange={(checked) => 
                handleSettingsChange({ compactView: checked })
              }
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  More Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Display Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={settings.showAdvancedMetrics}
                  onCheckedChange={(checked) => 
                    handleSettingsChange({ showAdvancedMetrics: checked })
                  }
                >
                  Advanced Metrics
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={settings.layout === 'grid'}
                  onCheckedChange={(checked) => 
                    handleSettingsChange({ layout: checked ? 'grid' : 'list' })
                  }
                >
                  Grid Layout
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('/help/dashboard', '_blank')}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Help
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ===== MAIN RENDER =====

  return (
    <div 
      className={cn(
        'min-h-screen bg-background transition-all duration-300',
        settings.compactView && 'text-sm',
        className
      )}
      data-testid={testId}
    >
      {/* Dashboard Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                LinkedIn Analytics Dashboard
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Track your LinkedIn profile performance with real-time insights
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="sm:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Desktop controls */}
            <div className="hidden sm:flex items-center space-x-3">
              {renderServiceStatus()}
              
              <div className="text-xs text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              
              <LoadingButton
                variant="outline"
                size="sm"
                loading={refreshing}
                loadingText="Refreshing..."
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </LoadingButton>
              
              <Button variant="outline" size="sm" onClick={handleExportData}>
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden lg:inline">Export</span>
              </Button>
              
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden mt-4 pt-4 border-t border-border">
            <div className="space-y-3">
              {renderServiceStatus()}
              <div className="flex flex-wrap gap-2">
                <LoadingButton
                  variant="outline"
                  size="sm"
                  loading={refreshing}
                  loadingText="Refreshing..."
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </LoadingButton>
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* System Status Alerts */}
      {needsAttention && (
        <Alert className="m-4 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>System Health Warning</AlertTitle>
          <AlertDescription>
            Some services are experiencing issues. Dashboard functionality may be limited.
          </AlertDescription>
        </Alert>
      )}

      {wsError && (
        <Alert className="m-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Real-time Connection Error</AlertTitle>
          <AlertDescription>
            Unable to connect to real-time updates. Data may not be current.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Dashboard Content */}
      <main className="p-4 sm:p-6">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Home className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center space-x-2">
              <Bot className="h-4 w-4" />
              <span>Automation</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <EnhancedErrorBoundary level="section" title="Dashboard Overview">
              <Suspense fallback={<DashboardSkeleton />}>
                <div className="space-y-6">
                  {/* Top Row - Enhanced Metrics Overview */}
                  <AsyncErrorBoundary
                    suspenseFallback={<MetricsWidgetSkeleton />}
                    level="component"
                  >
                    <ProfileMetricsWidget 
                      className="w-full" 
                    />
                  </AsyncErrorBoundary>

                  {/* Profile Completeness Analysis */}
                  <AsyncErrorBoundary
                    suspenseFallback={<ProfileCompletenessSkeleton />}
                    level="component"
                  >
                    <ProfileCompletenessChart 
                      className="w-full"
                      showDetailed={settings.showDetailedBreakdown}
                      enableRecommendations={true}
                    />
                  </AsyncErrorBoundary>

                  {/* Analytics Chart */}
                  <AsyncErrorBoundary
                    suspenseFallback={<AnalyticsChartSkeleton />}
                    level="component"
                  >
                    <AnalyticsChart 
                      className="w-full" 
                    />
                  </AsyncErrorBoundary>

                  {/* Optimization Suggestions */}
                  {settings.showOptimizationSuggestions && (
                    <AsyncErrorBoundary level="component">
                      <ProfileOptimizationSuggestions 
                        className="w-full"
                        maxSuggestions={settings.compactView ? 4 : 8}
                        showFilters={true}
                        enableAI={subscriptionTier !== 'free'}
                      />
                    </AsyncErrorBoundary>
                  )}

                  {/* Activity and Goals Row */}
                  <div className={cn(
                    'grid gap-6',
                    settings.layout === 'grid' 
                      ? 'grid-cols-1 lg:grid-cols-2' 
                      : 'grid-cols-1'
                  )}>
                    <AsyncErrorBoundary level="component">
                      <LiveActivityFeed className="w-full" />
                    </AsyncErrorBoundary>
                    
                    <AsyncErrorBoundary level="component">
                      <GoalsWidget 
                        className="w-full" 
                        currentMetrics={currentMetrics?.snapshot}
                      />
                    </AsyncErrorBoundary>
                  </div>

                  {/* Bottom Row - Enhanced Widgets */}
                  <div className={cn(
                    'grid gap-6',
                    settings.layout === 'grid'
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-1'
                  )}>
                    {/* LinkedIn Compliance Status */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <Shield className="h-5 w-5 text-green-600" />
                          <span>LinkedIn Compliance</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Rate Limits</span>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="text-sm font-medium text-green-600">Healthy</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">API Usage</span>
                            <span className="text-sm font-medium">45% of daily limit</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Account Status</span>
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium text-green-600">Good Standing</span>
                            </div>
                          </div>
                        </div>
                        
                        <Button className="w-full mt-4" variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Compliance Report
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Industry Benchmarks */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                          <span>Industry Benchmarks</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Profile Views</span>
                            <div className="text-right">
                              <div className="text-sm font-medium">Above Average</div>
                              <div className="text-xs text-green-600">+23% vs industry</div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Connection Growth</span>
                            <div className="text-right">
                              <div className="text-sm font-medium">Average</div>
                              <div className="text-xs text-muted-foreground">Industry median</div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Engagement Rate</span>
                            <div className="text-right">
                              <div className="text-sm font-medium">Below Average</div>
                              <div className="text-xs text-red-600">-15% vs industry</div>
                            </div>
                          </div>
                        </div>

                        <Button className="w-full mt-4" variant="outline" size="sm">
                          <Target className="h-4 w-4 mr-2" />
                          View Detailed Benchmarks
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    {renderQuickActions()}
                  </div>

                  {/* Dashboard Controls */}
                  {renderDashboardControls()}
                </div>
              </Suspense>
            </EnhancedErrorBoundary>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation">
            <EnhancedErrorBoundary level="section" title="Automation Dashboard">
              <Suspense fallback={<InlineLoading loading={true} context="processing" />}>
                <AutomationDashboard
                  userId={userId || 'default'}
                  subscriptionTier={subscriptionTier === 'pro' ? 'premium' : subscriptionTier}
                />
              </Suspense>
            </EnhancedErrorBoundary>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <EnhancedErrorBoundary level="section" title="Advanced Analytics">
              <div className="space-y-6">
                <AsyncErrorBoundary
                  suspenseFallback={<AnalyticsChartSkeleton />}
                  level="component"
                >
                  <AnalyticsChart 
                    className="w-full" 
                  />
                </AsyncErrorBoundary>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AsyncErrorBoundary level="component">
                    <LiveActivityFeed className="w-full" />
                  </AsyncErrorBoundary>
                  
                  <AsyncErrorBoundary level="component">
                    <GoalsWidget 
                      className="w-full" 
                      currentMetrics={currentMetrics?.snapshot}
                    />
                  </AsyncErrorBoundary>
                </div>
              </div>
            </EnhancedErrorBoundary>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default EnhancedDashboardLayout;