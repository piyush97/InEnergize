import React, { useState, useEffect } from 'react';
import ProfileMetricsWidget from './ProfileMetricsWidget';
import AnalyticsChart from './AnalyticsChart';
import LiveActivityFeed from './LiveActivityFeed';
import GoalsWidget from './GoalsWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Settings, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  className?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ className }) => {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<any>(null);

  useEffect(() => {
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(() => {
      handleRefresh();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

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
    <div className={cn('min-h-screen bg-gray-50', className)}>
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">LinkedIn Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Track your LinkedIn profile performance and growth
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
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
        {/* Top Row - Metrics Overview */}
        <div className="mb-6">
          <ProfileMetricsWidget className="w-full" />
        </div>

        {/* Second Row - Analytics Chart */}
        <div className="mb-6">
          <AnalyticsChart className="w-full" />
        </div>

        {/* Third Row - Activity Feed and Goals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <LiveActivityFeed className="w-full" />
          <GoalsWidget 
            className="w-full" 
            currentMetrics={currentMetrics?.snapshot}
          />
        </div>

        {/* Bottom Row - Additional Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Optimization Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Optimization Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Add more skills to your profile
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Profiles with 5+ skills get 17x more views
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      Post content regularly
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Weekly posts increase profile visibility by 40%
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-orange-900">
                      Update your headline
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      A compelling headline gets 3x more clicks
                    </p>
                  </div>
                </div>
              </div>
              
              <Button className="w-full mt-4" variant="outline" size="sm">
                View All Suggestions
              </Button>
            </CardContent>
          </Card>

          {/* Industry Benchmarks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Industry Benchmarks</CardTitle>
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
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  📝 Generate Content Ideas
                </Button>
                
                <Button variant="outline" className="w-full justify-start" size="sm">
                  🎨 Create Banner Design
                </Button>
                
                <Button variant="outline" className="w-full justify-start" size="sm">
                  📊 Schedule Weekly Report
                </Button>
                
                <Button variant="outline" className="w-full justify-start" size="sm">
                  🤝 Find Connection Opportunities
                </Button>
                
                <Button variant="outline" className="w-full justify-start" size="sm">
                  📈 Analyze Competitor Profiles
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;