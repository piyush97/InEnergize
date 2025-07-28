// PublishingStatusWidget.tsx - Real-time publishing status monitoring
// Shows queue status, recent activity, and compliance monitoring

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Pause,
  Play,
  Shield,
  TrendingUp,
  Users,
  Calendar,
  RefreshCw,
  Bell,
  BellOff,
  Settings,
  X
} from 'lucide-react';

interface ScheduledEvent {
  id: string;
  contentId: string;
  title: string;
  contentType: 'POST' | 'ARTICLE' | 'CAROUSEL' | 'POLL';
  scheduledAt: Date;
  status: 'QUEUED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';
  priority: number;
  engagementPrediction?: number;
  optimalTimeScore?: number;
}

interface ConflictInfo {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  affectedEvents: string[];
  suggestions: string[];
}

interface PublishingActivity {
  id: string;
  type: 'published' | 'failed' | 'queued' | 'rescheduled';
  contentTitle: string;
  timestamp: Date;
  message: string;
  success: boolean;
}

interface ComplianceStatus {
  accountHealth: number;
  dailyPostCount: number;
  dailyLimit: number;
  rateLimitStatus: 'normal' | 'warning' | 'throttled';
  lastAPICall: Date;
  errorRate: number;
}

interface PublishingStatusWidgetProps {
  events: ScheduledEvent[];
  conflicts: ConflictInfo[];
  isAutomationActive: boolean;
  onToggleAutomation?: () => void;
  onRetryFailed?: (eventId: string) => void;
  onCancelEvent?: (eventId: string) => void;
}

export const PublishingStatusWidget: React.FC<PublishingStatusWidgetProps> = ({
  events,
  conflicts,
  isAutomationActive,
  onToggleAutomation,
  onRetryFailed,
  onCancelEvent
}) => {
  const [recentActivity, setRecentActivity] = useState<PublishingActivity[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus>(mockComplianceStatus);
  const [notifications, setNotifications] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    queue: true,
    activity: true,
    compliance: true,
    conflicts: true
  });

  // Calculate status statistics
  const statusCounts = events.reduce((acc, event) => {
    acc[event.status] = (acc[event.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const nextEvent = events
    .filter(e => e.status === 'QUEUED' && e.scheduledAt > new Date())
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

  const failedEvents = events.filter(e => e.status === 'FAILED');

  useEffect(() => {
    loadRecentActivity();
    loadComplianceStatus();
    
    // Set up real-time updates
    const interval = setInterval(() => {
      loadRecentActivity();
      loadComplianceStatus();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadRecentActivity = async () => {
    try {
      const response = await fetch('/api/v1/schedule/activity/recent', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.activities || mockRecentActivity);
      }
    } catch (err) {
      console.warn('Failed to load recent activity:', err);
      setRecentActivity(mockRecentActivity);
    }
  };

  const loadComplianceStatus = async () => {
    try {
      const response = await fetch('/api/v1/schedule/compliance/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setComplianceStatus(data.status || mockComplianceStatus);
      }
    } catch (err) {
      console.warn('Failed to load compliance status:', err);
      setComplianceStatus(mockComplianceStatus);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadRecentActivity(),
      loadComplianceStatus()
    ]);
    setIsRefreshing(false);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'QUEUED': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'PROCESSING': return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'PUBLISHED': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'FAILED': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'published': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'failed': return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'queued': return <Clock className="h-3 w-3 text-blue-500" />;
      case 'rescheduled': return <Calendar className="h-3 w-3 text-orange-500" />;
      default: return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const getComplianceColor = (health: number) => {
    if (health >= 80) return 'text-green-600';
    if (health >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRateLimitBadge = (status: string) => {
    switch (status) {
      case 'normal': return <Badge variant="outline" className="text-green-600">Normal</Badge>;
      case 'warning': return <Badge variant="outline" className="text-yellow-600">Warning</Badge>;
      case 'throttled': return <Badge variant="destructive">Throttled</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Publishing Status
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNotifications(!notifications)}
              >
                {notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isAutomationActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                Automation {isAutomationActive ? 'Active' : 'Paused'}
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAutomation}
              className="gap-1"
            >
              {isAutomationActive ? (
                <>
                  <Pause className="h-3 w-3" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Resume
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queue Status */}
      <Card>
        <CardHeader 
          className="cursor-pointer pb-2" 
          onClick={() => toggleSection('queue')}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Queue Status
            </span>
            <span className="text-sm font-normal">
              {expandedSections.queue ? '−' : '+'}
            </span>
          </CardTitle>
        </CardHeader>
        
        {expandedSections.queue && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Queued</span>
                <span className="font-medium">{statusCounts.QUEUED || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Published</span>
                <span className="font-medium">{statusCounts.PUBLISHED || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Processing</span>
                <span className="font-medium">{statusCounts.PROCESSING || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Failed</span>
                <span className="font-medium text-red-600">{statusCounts.FAILED || 0}</span>
              </div>
            </div>

            {nextEvent && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Next Publishing</span>
                </div>
                <div className="text-sm text-gray-600">
                  {nextEvent.title}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {nextEvent.scheduledAt.toLocaleDateString()} at{' '}
                  {nextEvent.scheduledAt.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            )}

            {failedEvents.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium text-red-600 mb-2">
                  Failed Events ({failedEvents.length})
                </div>
                <div className="space-y-2">
                  {failedEvents.slice(0, 3).map(event => (
                    <div key={event.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <span className="text-sm truncate">{event.title}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRetryFailed?.(event.id)}
                          className="h-6 px-2 text-xs"
                        >
                          Retry
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancelEvent?.(event.id)}
                          className="h-6 px-2 text-xs text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* LinkedIn Compliance */}
      <Card>
        <CardHeader 
          className="cursor-pointer pb-2" 
          onClick={() => toggleSection('compliance')}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              LinkedIn Compliance
            </span>
            <span className="text-sm font-normal">
              {expandedSections.compliance ? '−' : '+'}
            </span>
          </CardTitle>
        </CardHeader>
        
        {expandedSections.compliance && (
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Account Health</span>
                  <span className={`font-medium ${getComplianceColor(complianceStatus.accountHealth)}`}>
                    {complianceStatus.accountHealth}%
                  </span>
                </div>
                <Progress value={complianceStatus.accountHealth} className="h-2" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Daily Posts</span>
                <span className="font-medium">
                  {complianceStatus.dailyPostCount}/{complianceStatus.dailyLimit}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Rate Limit Status</span>
                {getRateLimitBadge(complianceStatus.rateLimitStatus)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Error Rate</span>
                <span className={`font-medium ${complianceStatus.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                  {(complianceStatus.errorRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card>
          <CardHeader 
            className="cursor-pointer pb-2" 
            onClick={() => toggleSection('conflicts')}
          >
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Conflicts ({conflicts.length})
              </span>
              <span className="text-sm font-normal">
                {expandedSections.conflicts ? '−' : '+'}
              </span>
            </CardTitle>
          </CardHeader>
          
          {expandedSections.conflicts && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {conflicts.slice(0, 3).map(conflict => (
                  <Alert key={conflict.id} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {conflict.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader 
          className="cursor-pointer pb-2" 
          onClick={() => toggleSection('activity')}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </span>
            <span className="text-sm font-normal">
              {expandedSections.activity ? '−' : '+'}
            </span>
          </CardTitle>
        </CardHeader>
        
        {expandedSections.activity && (
          <CardContent className="pt-0">
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recent activity
                </p>
              ) : (
                recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-start gap-2">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {activity.contentTitle}
                      </div>
                      <div className="text-xs text-gray-500">
                        {activity.message}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {activity.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

// Mock data for development
const mockRecentActivity: PublishingActivity[] = [
  {
    id: 'activity-1',
    type: 'published',
    contentTitle: 'AI in Marketing: The Future is Now',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    message: 'Successfully published to LinkedIn',
    success: true
  },
  {
    id: 'activity-2',
    type: 'failed',
    contentTitle: 'Building Better Teams',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    message: 'Rate limit exceeded, will retry in 45 minutes',
    success: false
  },
  {
    id: 'activity-3',
    type: 'queued',
    contentTitle: 'Remote Work Trends 2024',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    message: 'Added to publishing queue',
    success: true
  },
  {
    id: 'activity-4',
    type: 'rescheduled',
    contentTitle: 'Innovation in Fintech',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    message: 'Rescheduled to optimal time slot',
    success: true
  }
];

const mockComplianceStatus: ComplianceStatus = {
  accountHealth: 92,
  dailyPostCount: 2,
  dailyLimit: 3,
  rateLimitStatus: 'normal',
  lastAPICall: new Date(Date.now() - 15 * 60 * 1000),
  errorRate: 0.02
};

export default PublishingStatusWidget;