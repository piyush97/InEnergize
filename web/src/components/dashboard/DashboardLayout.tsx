import React, { useState, useEffect } from 'react';
import ProfileMetricsWidget from './ProfileMetricsWidget';
import ProfileCompletenessChart from './ProfileCompletenessChart';
import ProfileOptimizationSuggestions from './ProfileOptimizationSuggestions';
import PredictionsWidget from './PredictionsWidget';
import ContentPredictionsWidget from './ContentPredictionsWidget';
import RealTimeMetricsProvider from './RealTimeMetricsProvider';
import AnalyticsChart from './AnalyticsChart';
import LiveActivityFeed from './LiveActivityFeed';
import GoalsWidget from './GoalsWidget';
import { AutomationDashboard } from '../automation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ProfileCompletnessSkeleton, MetricsWidgetSkeleton, AnalyticsChartSkeleton } from '@/components/ui/skeleton';
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
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  className?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ className }) => {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<{
    snapshot: {
      profileViews: number;
      connections: number;
      completenessScore: number;
      engagementRate: number;
    };
  } | null>(null);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(true);
  const [showOptimizationSuggestions, setShowOptimizationSuggestions] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [servicesHealth, setServicesHealth] = useState<{
    linkedin: boolean;
    analytics: boolean;
    automation: boolean;
    checkedAt?: Date;
  }>({ linkedin: false, analytics: false, automation: false });

  useEffect(() => {
    // Initial health check
    checkServicesHealth();
    
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(() => {
      handleRefresh();
    }, 5 * 60 * 1000);

    // Health check every 2 minutes
    const healthInterval = setInterval(() => {
      checkServicesHealth();
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
    };
  }, []);

  const checkServicesHealth = async () => {
    try {
      const [linkedinHealth, analyticsHealth, automationHealth] = await Promise.allSettled([
        fetch('http://localhost:3003/health').then(r => r.ok),
        fetch('http://localhost:3004/health').then(r => r.ok),
        fetch('http://localhost:3003/api/automation/health').then(r => r.ok)
      ]);

      setServicesHealth({
        linkedin: linkedinHealth.status === 'fulfilled' && linkedinHealth.value,
        analytics: analyticsHealth.status === 'fulfilled' && analyticsHealth.value,
        automation: automationHealth.status === 'fulfilled' && automationHealth.value,
        checkedAt: new Date()
      });
    } catch (error) {
      console.warn('Failed to check services health:', error);
      setServicesHealth(prev => ({ ...prev, checkedAt: new Date() }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger refresh of all dashboard components
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
  };

  const handleExportData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30); // Last 30 days

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        format: 'csv'
      });

      const response = await fetch(`/api/v1/metrics/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linkedin-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  return (
    <RealTimeMetricsProvider 
      enableWebSocket={true} 
      enableFallbackPolling={true}
      pollingInterval={30000}
    >
      <div className={cn('min-h-screen bg-gray-50', className)}>
        {/* Dashboard Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">LinkedIn Analytics Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Track your LinkedIn profile performance and growth with real-time insights
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Service Status Indicators */}
              <div className="flex items-center space-x-2 text-xs">
                <div className="flex items-center space-x-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    servicesHealth.linkedin ? 'bg-green-500' : 'bg-red-500'
                  )}></div>
                  <span className="text-gray-600">LinkedIn</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    servicesHealth.analytics ? 'bg-green-500' : 'bg-red-500'
                  )}></div>
                  <span className="text-gray-600">Analytics</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    servicesHealth.automation ? 'bg-green-500' : 'bg-red-500'
                  )}></div>
                  <span className="text-gray-600">Automation</span>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6">
          {/* Main Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="flex items-center space-x-2">
                <Home className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="predictions" className="flex items-center space-x-2">
                <Brain className="h-4 w-4" />
                <span>AI Insights</span>
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
              {/* Top Row - Enhanced Metrics Overview */}
              <ErrorBoundary fallback={<MetricsWidgetSkeleton />}>
                <ProfileMetricsWidget className="w-full" />
              </ErrorBoundary>

              {/* Profile Completeness Analysis */}
              <ErrorBoundary fallback={<ProfileCompletnessSkeleton />}>
                <ProfileCompletenessChart 
                  className="w-full"
                  showDetailed={showDetailedBreakdown}
                  enableRecommendations={true}
                />
              </ErrorBoundary>

              {/* Second Row - Analytics Chart */}
              <ErrorBoundary fallback={<AnalyticsChartSkeleton />}>
                <AnalyticsChart className="w-full" />
              </ErrorBoundary>

              {/* Profile Optimization Suggestions */}
              {showOptimizationSuggestions && (
                <ErrorBoundary>
                  <ProfileOptimizationSuggestions 
                    className="w-full"
                    maxSuggestions={8}
                    showFilters={true}
                    enableAI={true}
                  />
                </ErrorBoundary>
              )}

              {/* Third Row - Activity Feed and Goals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ErrorBoundary>
                  <LiveActivityFeed className="w-full" />
                </ErrorBoundary>
                <ErrorBoundary>
                  <GoalsWidget 
                    className="w-full" 
                    currentMetrics={currentMetrics?.snapshot}
                  />
                </ErrorBoundary>
              </div>

              {/* Fourth Row - Quick AI Insights Preview */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ErrorBoundary>
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Brain className="h-5 w-5" />
                        <span>Quick AI Insights</span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setActiveTab('predictions')}
                        >
                          View All →
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PredictionsWidget className="w-full" />
                    </CardContent>
                  </Card>
                </ErrorBoundary>
                
                <ErrorBoundary>
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5" />
                        <span>Content Strategy</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ContentPredictionsWidget className="w-full" />
                    </CardContent>
                  </Card>
                </ErrorBoundary>
              </div>

              {/* Bottom Row - Enhanced Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <span className="text-sm text-gray-600">Rate Limits</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-600">Healthy</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Usage</span>
                    <span className="text-sm font-medium">45% of daily limit</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Account Status</span>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Good Standing</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Safety Check</span>
                    <span className="text-sm text-gray-500">2 hours ago</span>
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
                    <span className="text-sm text-gray-600">Profile Views</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">Above Average</div>
                      <div className="text-xs text-green-600">+23% vs industry</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Connection Growth</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">Average</div>
                      <div className="text-xs text-gray-600">Industry median</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Engagement Rate</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">Below Average</div>
                      <div className="text-xs text-red-600">-15% vs industry</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Profile Score</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">Excellent</div>
                      <div className="text-xs text-green-600">Top 10%</div>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-orange-600" />
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Star className="h-4 w-4 mr-2" />
                    Generate AI Headlines
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Find New Connections
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Create Content
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Camera className="h-4 w-4 mr-2" />
                    Update Profile Photo
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Engage with Network
                  </Button>
                </div>
              </CardContent>
            </Card>
              </div>

              {/* Dashboard Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dashboard Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="detailed-breakdown"
                        checked={showDetailedBreakdown}
                        onChange={(e) => setShowDetailedBreakdown(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="detailed-breakdown" className="text-sm font-medium">
                        Show Detailed Completeness Breakdown
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="optimization-suggestions"
                        checked={showOptimizationSuggestions}
                        onChange={(e) => setShowOptimizationSuggestions(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="optimization-suggestions" className="text-sm font-medium">
                        Show Optimization Suggestions
                      </label>
                    </div>
                    
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      More Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI Insights Tab */}
            <TabsContent value="predictions" className="space-y-6">
              {/* Growth Predictions and Recommendations */}
              <ErrorBoundary>
                <PredictionsWidget className="w-full" />
              </ErrorBoundary>

              {/* Content Performance and Network Insights */}
              <ErrorBoundary>
                <ContentPredictionsWidget className="w-full" />
              </ErrorBoundary>

              {/* Enhanced Profile Optimization with AI */}
              <ErrorBoundary>
                <ProfileOptimizationSuggestions 
                  className="w-full"
                  maxSuggestions={12}
                  showFilters={true}
                  enableAI={true}
                />
              </ErrorBoundary>
            </TabsContent>

            {/* Automation Tab */}
            <TabsContent value="automation">
              <ErrorBoundary>
                <AutomationDashboard 
                  userId="current-user" // TODO: Get from auth context
                  subscriptionTier="premium" // TODO: Get from user context
                />
              </ErrorBoundary>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <ErrorBoundary fallback={<AnalyticsChartSkeleton />}>
                <AnalyticsChart className="w-full" />
              </ErrorBoundary>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ErrorBoundary>
                  <LiveActivityFeed className="w-full" />
                </ErrorBoundary>
                <ErrorBoundary>
                  <GoalsWidget 
                    className="w-full" 
                    currentMetrics={currentMetrics?.snapshot}
                  />
                </ErrorBoundary>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </RealTimeMetricsProvider>
  );
}

export default DashboardLayout;