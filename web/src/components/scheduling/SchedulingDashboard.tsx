// SchedulingDashboard.tsx - Main container for the post scheduling system
// Integrates calendar interface, content queue, and timing optimization

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  TrendingUp,
  BarChart3,
  Settings,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { CalendarInterface } from './CalendarInterface';
import { ContentQueuePanel } from './ContentQueuePanel';
import { TimingOptimizer } from './TimingOptimizer';
import { BulkSchedulingModal } from './BulkSchedulingModal';
import { PublishingStatusWidget } from './PublishingStatusWidget';

// Types for scheduling system
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
  linkedinProfileId?: string;
}

interface ContentQueueItem {
  id: string;
  title: string;
  contentType: 'POST' | 'ARTICLE' | 'CAROUSEL' | 'POLL';
  content: string;
  priority: number;
  createdAt: Date;
  estimatedEngagement?: number;
  isDraft: boolean;
  bannerId?: string;
}

interface ConflictInfo {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  affectedEvents: string[];
  suggestions: string[];
}

interface SchedulingDashboardProps {
  userId: string;
  linkedinProfileId?: string;
  onContentScheduled?: (eventId: string) => void;
  onBulkSchedule?: (events: ScheduledEvent[]) => void;
}

export const SchedulingDashboard: React.FC<SchedulingDashboardProps> = ({
  userId,
  linkedinProfileId,
  onContentScheduled,
  onBulkSchedule
}) => {
  // State management
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [queueItems, setQueueItems] = useState<ContentQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAutomationActive, setIsAutomationActive] = useState(true);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  // Dashboard statistics
  const [stats, setStats] = useState({
    totalScheduled: 0,
    publishedToday: 0,
    queuedItems: 0,
    engagementRate: 0,
    nextPublish: null as Date | null
  });

  // Load scheduling data
  useEffect(() => {
    loadSchedulingData();
    setupWebSocketConnection();
  }, [userId, linkedinProfileId]);

  const loadSchedulingData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [eventsRes, queueRes, statsRes] = await Promise.all([
        fetch(`/api/v1/schedule/calendar/${new Date().getFullYear()}/${new Date().getMonth() + 1}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        fetch(`/api/v1/content/queue?status=DRAFT`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        }),
        fetch(`/api/v1/schedule/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        })
      ]);

      if (!eventsRes.ok || !queueRes.ok || !statsRes.ok) {
        throw new Error('Failed to load scheduling data');
      }

      const eventsData = await eventsRes.json();
      const queueData = await queueRes.json();
      const statsData = await statsRes.json();

      setScheduledEvents(eventsData.events || mockScheduledEvents);
      setQueueItems(queueData.items || mockQueueItems);
      setConflicts(eventsData.conflicts || []);
      setStats(statsData || mockStats);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      // Use mock data for development
      setScheduledEvents(mockScheduledEvents);
      setQueueItems(mockQueueItems);
      setStats(mockStats);
    } finally {
      setIsLoading(false);
    }
  };

  const setupWebSocketConnection = () => {
    // WebSocket for real-time updates
    try {
      const token = localStorage.getItem('authToken');
      const ws = new WebSocket(`ws://localhost:3004/schedule-updates?token=${token}`);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'schedule:updated':
            handleScheduleUpdate(data.payload);
            break;
          case 'schedule:published':
            handlePublishSuccess(data.payload);
            break;
          case 'schedule:failed':
            handlePublishFailure(data.payload);
            break;
          case 'calendar:refresh':
            loadSchedulingData();
            break;
        }
      };

      return () => ws.close();
    } catch (err) {
      console.warn('WebSocket connection failed, using polling fallback');
      // Fallback to polling every 30 seconds
      const interval = setInterval(loadSchedulingData, 30000);
      return () => clearInterval(interval);
    }
  };

  const handleScheduleUpdate = (payload: any) => {
    setScheduledEvents(prev => 
      prev.map(event => 
        event.id === payload.queueId 
          ? { ...event, status: payload.status }
          : event
      )
    );
  };

  const handlePublishSuccess = (payload: any) => {
    setScheduledEvents(prev => 
      prev.map(event => 
        event.id === payload.queueId 
          ? { ...event, status: 'PUBLISHED' }
          : event
      )
    );
    loadSchedulingData(); // Refresh stats
  };

  const handlePublishFailure = (payload: any) => {
    setScheduledEvents(prev => 
      prev.map(event => 
        event.id === payload.queueId 
          ? { ...event, status: 'FAILED' }
          : event
      )
    );
  };

  const handleEventDrop = async (eventId: string, newDate: Date) => {
    try {
      const response = await fetch(`/api/v1/schedule/${eventId}/reschedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          newScheduledAt: newDate.toISOString(),
          reason: 'User drag-and-drop' 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reschedule event');
      }

      // Update local state optimistically
      setScheduledEvents(prev => 
        prev.map(event => 
          event.id === eventId 
            ? { ...event, scheduledAt: newDate }
            : event
        )
      );

      onContentScheduled?.(eventId);
    } catch (err) {
      setError('Failed to reschedule content');
    }
  };

  const handleScheduleFromQueue = async (queueItem: ContentQueueItem, timing: Date) => {
    try {
      const response = await fetch('/api/v1/schedule/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          contentId: queueItem.id,
          scheduledAt: timing.toISOString(),
          priority: queueItem.priority,
          useOptimalTiming: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to schedule content');
      }

      const scheduledEvent = await response.json();
      
      // Update local state
      setScheduledEvents(prev => [...prev, scheduledEvent]);
      setQueueItems(prev => prev.filter(item => item.id !== queueItem.id));
      
      onContentScheduled?.(scheduledEvent.id);
    } catch (err) {
      setError('Failed to schedule content');
    }
  };

  const toggleAutomation = async () => {
    try {
      const response = await fetch('/api/v1/schedule/automation/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ active: !isAutomationActive })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle automation');
      }

      setIsAutomationActive(!isAutomationActive);
    } catch (err) {
      setError('Failed to toggle automation');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading scheduling dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            Content Scheduler
          </h1>
          <p className="text-gray-600 mt-1">
            AI-powered scheduling for maximum LinkedIn engagement
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant={isAutomationActive ? "default" : "outline"}
            onClick={toggleAutomation}
            className="gap-2"
          >
            {isAutomationActive ? (
              <>
                <Pause className="h-4 w-4" />
                Pause Automation
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Automation
              </>
            )}
          </Button>
          
          <Button onClick={() => setShowBulkModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Bulk Schedule
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold">{stats.totalScheduled}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Published Today</p>
                <p className="text-2xl font-bold">{stats.publishedToday}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Queue</p>
                <p className="text-2xl font-bold">{stats.queuedItems}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-bold">{stats.engagementRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Next Publish</p>
                <p className="text-lg font-semibold">
                  {stats.nextPublish 
                    ? new Date(stats.nextPublish).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })
                    : 'None'
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="queue">Content Queue</TabsTrigger>
          <TabsTrigger value="optimizer">Timing Optimizer</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Calendar Interface */}
            <div className="lg:col-span-3">
              <CalendarInterface
                events={scheduledEvents}
                onEventDrop={handleEventDrop}
                onDateSelect={setSelectedDate}
                view={activeView}
                conflicts={conflicts}
                selectedDate={selectedDate}
              />
            </div>
            
            {/* Publishing Status Sidebar */}
            <div className="lg:col-span-1">
              <PublishingStatusWidget
                events={scheduledEvents}
                conflicts={conflicts}
                isAutomationActive={isAutomationActive}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <ContentQueuePanel
            queueItems={queueItems}
            onScheduleItem={handleScheduleFromQueue}
            onRefresh={loadSchedulingData}
          />
        </TabsContent>

        <TabsContent value="optimizer" className="space-y-4">
          <TimingOptimizer
            selectedDate={selectedDate}
            scheduledEvents={scheduledEvents}
            userId={userId}
            linkedinProfileId={linkedinProfileId}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Publishing Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Performance metrics for scheduled content
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Success Rate</span>
                    <span className="font-semibold">95.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. Engagement</span>
                    <span className="font-semibold">4.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Optimal Timing Accuracy</span>
                    <span className="font-semibold">87.3%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Best Posting Times
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  AI-optimized posting schedule based on your audience
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Tuesday, 9:00 AM</span>
                    <Badge variant="outline">High Engagement</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Thursday, 2:00 PM</span>
                    <Badge variant="outline">High Engagement</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Friday, 11:00 AM</span>
                    <Badge variant="outline">Medium Engagement</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bulk Scheduling Modal */}
      <BulkSchedulingModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        queueItems={queueItems}
        onBulkSchedule={(events) => {
          setScheduledEvents(prev => [...prev, ...events]);
          onBulkSchedule?.(events);
          setShowBulkModal(false);
        }}
      />
    </div>
  );
};

// Mock data for development
const mockScheduledEvents: ScheduledEvent[] = [
  {
    id: 'event-1',
    contentId: 'content-1',
    title: 'AI in Marketing: The Future is Now',
    contentType: 'POST',
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    status: 'QUEUED',
    priority: 5,
    engagementPrediction: 0.78,
    optimalTimeScore: 0.92
  },
  {
    id: 'event-2',
    contentId: 'content-2',
    title: 'Building Better Teams Through Technology',
    contentType: 'ARTICLE',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    status: 'QUEUED',
    priority: 7,
    engagementPrediction: 0.85,
    optimalTimeScore: 0.88
  }
];

const mockQueueItems: ContentQueueItem[] = [
  {
    id: 'queue-1',
    title: 'The Rise of Remote Work Culture',
    contentType: 'POST',
    content: 'Remote work has transformed how we collaborate...',
    priority: 6,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    estimatedEngagement: 0.72,
    isDraft: true
  },
  {
    id: 'queue-2',
    title: 'Innovation in Fintech',
    contentType: 'CAROUSEL',
    content: 'Exploring the latest trends in financial technology...',
    priority: 8,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    estimatedEngagement: 0.89,
    isDraft: true,
    bannerId: 'banner-123'
  }
];

const mockStats = {
  totalScheduled: 12,
  publishedToday: 3,
  queuedItems: 8,
  engagementRate: 4.2,
  nextPublish: new Date(Date.now() + 2 * 60 * 60 * 1000)
};

export default SchedulingDashboard;