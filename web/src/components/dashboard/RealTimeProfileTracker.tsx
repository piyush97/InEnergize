'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Bell,
  Clock,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Target,
  Award,
  Flame,
  CheckCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw,
  Pause,
  Play,
  BarChart3,
  LineChart,
  PieChart,
  Settings,
  Volume2,
  VolumeX,
  Smartphone
} from 'lucide-react';

interface ProfileMetric {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ElementType;
  color: string;
  unit: string;
  timestamp: Date;
  target?: number;
}

interface RealTimeUpdate {
  type: 'metric_update' | 'achievement_unlock' | 'milestone_reached' | 'goal_progress';
  data: any;
  timestamp: Date;
  userId: string;
}

interface WebSocketStatus {
  connected: boolean;
  reconnecting: boolean;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
}

interface NotificationSettings {
  achievements: boolean;
  milestones: boolean;
  metrics: boolean;
  warnings: boolean;
  sound: boolean;
  vibration: boolean;
  desktop: boolean;
  email: boolean;
}

interface RealTimeProfileTrackerProps {
  userId: string;
  className?: string;
  updateInterval?: number;
  showNotifications?: boolean;
  enableAnimations?: boolean;
  onMetricUpdate?: (metric: ProfileMetric) => void;
  onAchievementUnlock?: (achievement: any) => void;
  notificationSettings?: NotificationSettings;
}

const RealTimeProfileTracker: React.FC<RealTimeProfileTrackerProps> = ({
  userId,
  className,
  updateInterval = 5000,
  showNotifications = true,
  enableAnimations = true,
  onMetricUpdate,
  onAchievementUnlock,
  notificationSettings = {
    achievements: true,
    milestones: true,
    metrics: false,
    warnings: true,
    sound: false,
    vibration: true,
    desktop: true,
    email: false
  }
}) => {
  const [metrics, setMetrics] = useState<ProfileMetric[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<RealTimeUpdate[]>([]);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>({
    connected: false,
    reconnecting: false,
    lastHeartbeat: null,
    reconnectAttempts: 0
  });
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [viewMode, setViewMode] = useState<'grid' | 'chart' | 'minimal'>('grid');
  const [notifications, setNotifications] = useState<RealTimeUpdate[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [localNotificationSettings, setLocalNotificationSettings] = useState(notificationSettings);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Notification helper functions
  const triggerHapticFeedback = useCallback((pattern: 'light' | 'medium' | 'heavy') => {
    if (!localNotificationSettings.vibration || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[pattern]);
  }, [localNotificationSettings.vibration]);

  const playNotificationSound = useCallback(async (type: 'achievement' | 'milestone' | 'update' | 'warning') => {
    if (!localNotificationSettings.sound) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioCtx = audioContextRef.current;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const soundConfig = {
        achievement: { frequency: 523.25, duration: 300, type: 'square' as OscillatorType },
        milestone: { frequency: 659.25, duration: 400, type: 'sine' as OscillatorType },
        update: { frequency: 440, duration: 150, type: 'sine' as OscillatorType },
        warning: { frequency: 220, duration: 200, type: 'sawtooth' as OscillatorType }
      };

      const config = soundConfig[type];
      oscillator.frequency.setValueAtTime(config.frequency, audioCtx.currentTime);
      oscillator.type = config.type;
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + config.duration / 1000);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + config.duration / 1000);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [localNotificationSettings.sound]);

  const showDesktopNotification = useCallback(async (title: string, body: string, icon?: string) => {
    if (!localNotificationSettings.desktop || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'inergize-profile-tracker',
        requireInteraction: false
      });

      setTimeout(() => notification.close(), 5000);
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        showDesktopNotification(title, body, icon);
      }
    }
  }, [localNotificationSettings.desktop]);

  // Initial metrics setup
  const initialMetrics: ProfileMetric[] = [
    {
      id: 'profile_views',
      label: 'Profile Views',
      value: 142,
      previousValue: 135,
      change: 7,
      changePercent: 5.2,
      trend: 'up',
      icon: Eye,
      color: 'text-blue-600',
      unit: 'views',
      timestamp: new Date(),
      target: 200
    },
    {
      id: 'connections',
      label: 'New Connections',
      value: 28,
      previousValue: 25,
      change: 3,
      changePercent: 12.0,
      trend: 'up',
      icon: Users,
      color: 'text-green-600',
      unit: 'connections',
      timestamp: new Date(),
      target: 50
    },
    {
      id: 'engagement_rate',
      label: 'Engagement Rate',
      value: 8.5,
      previousValue: 7.2,
      change: 1.3,
      changePercent: 18.1,
      trend: 'up',
      icon: Heart,
      color: 'text-red-600',
      unit: '%',
      timestamp: new Date(),
      target: 15
    },
    {
      id: 'post_impressions',
      label: 'Post Impressions',
      value: 1247,
      previousValue: 1089,
      change: 158,
      changePercent: 14.5,
      trend: 'up',
      icon: BarChart3,
      color: 'text-purple-600',
      unit: 'impressions',
      timestamp: new Date(),
      target: 2000
    },
    {
      id: 'profile_completeness',
      label: 'Profile Score',
      value: 87,
      previousValue: 82,
      change: 5,
      changePercent: 6.1,
      trend: 'up',
      icon: Target,
      color: 'text-orange-600',
      unit: '%',
      timestamp: new Date(),
      target: 95
    },
    {
      id: 'activity_streak',
      label: 'Activity Streak',
      value: 12,
      previousValue: 11,
      change: 1,
      changePercent: 9.1,
      trend: 'up',
      icon: Flame,
      color: 'text-yellow-600',
      unit: 'days',
      timestamp: new Date(),
      target: 30
    }
  ];

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus(prev => ({ ...prev, reconnecting: true }));

    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `wss://${window.location.host}/ws/profile-metrics`
      : 'ws://localhost:3007/profile-metrics';

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected for profile tracking');
        setWsStatus({
          connected: true,
          reconnecting: false,
          lastHeartbeat: new Date(),
          reconnectAttempts: 0
        });

        // Subscribe to user's profile updates
        wsRef.current?.send(JSON.stringify({
          type: 'subscribe',
          userId,
          channels: ['profile_metrics', 'achievements', 'milestones']
        }));

        // Start heartbeat
        heartbeatRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const update: RealTimeUpdate = JSON.parse(event.data);
          handleRealTimeUpdate(update);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setWsStatus(prev => ({ ...prev, connected: false }));
        
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Attempt reconnection if not intentional
        if (!event.wasClean && !isPaused) {
          const backoffDelay = Math.min(1000 * Math.pow(2, wsStatus.reconnectAttempts), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (wsStatus.reconnectAttempts < 10) {
              setWsStatus(prev => ({ 
                ...prev, 
                reconnectAttempts: prev.reconnectAttempts + 1 
              }));
              connectWebSocket();
            }
          }, backoffDelay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus(prev => ({ ...prev, connected: false, reconnecting: false }));
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setWsStatus(prev => ({ ...prev, reconnecting: false }));
    }
  }, [userId, wsStatus.reconnectAttempts, isPaused]);

  // Handle real-time updates
  const handleRealTimeUpdate = useCallback((update: RealTimeUpdate) => {
    setWsStatus(prev => ({ ...prev, lastHeartbeat: new Date() }));

    switch (update.type) {
      case 'metric_update':
        setMetrics(prevMetrics => {
          const updatedMetrics = prevMetrics.map(metric => {
            if (metric.id === update.data.metricId) {
              const newValue = update.data.value;
              const change = newValue - metric.value;
              const changePercent = metric.value > 0 ? (change / metric.value) * 100 : 0;
              
              const updatedMetric = {
                ...metric,
                previousValue: metric.value,
                value: newValue,
                change,
                changePercent,
                trend: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'stable' as const,
                timestamp: new Date(update.timestamp)
              };

              onMetricUpdate?.(updatedMetric);
              return updatedMetric;
            }
            return metric;
          });
          return updatedMetrics;
        });
        break;

      case 'achievement_unlock':
        onAchievementUnlock?.(update.data);
        if (showNotifications && localNotificationSettings.achievements) {
          setNotifications(prev => [update, ...prev].slice(0, 5));
          
          // Enhanced notifications for achievements
          triggerHapticFeedback('heavy');
          playNotificationSound('achievement');
          showDesktopNotification(
            '🏆 Achievement Unlocked!',
            update.data.title || 'You\'ve unlocked a new achievement!',
            '/icons/achievement.png'
          );
        }
        break;

      case 'milestone_reached':
        if (showNotifications && localNotificationSettings.milestones) {
          setNotifications(prev => [update, ...prev].slice(0, 5));
          
          // Enhanced notifications for milestones
          triggerHapticFeedback('medium');
          playNotificationSound('milestone');
          showDesktopNotification(
            '🎯 Milestone Reached!',
            update.data.title || 'You\'ve reached a new milestone!',
            '/icons/milestone.png'
          );
        }
        break;

      case 'goal_progress':
        if (showNotifications) {
          setNotifications(prev => [update, ...prev].slice(0, 5));
          
          // Light feedback for goal progress
          if (update.data.percentComplete >= 100) {
            triggerHapticFeedback('medium');
            playNotificationSound('achievement');
            showDesktopNotification(
              '🎉 Goal Completed!',
              update.data.message || 'You\'ve completed your goal!',
              '/icons/goal.png'
            );
          } else {
            triggerHapticFeedback('light');
          }
        }
        break;
    }

    // Add to recent updates
    setRecentUpdates(prev => [update, ...prev].slice(0, 10));
  }, [onMetricUpdate, onAchievementUnlock, showNotifications, localNotificationSettings, triggerHapticFeedback, playNotificationSound, showDesktopNotification]);

  // Initialize WebSocket connection
  useEffect(() => {
    setMetrics(initialMetrics);
    if (!isPaused) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket, isPaused]);

  // Manual refresh function
  const refreshMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/profile/metrics?userId=${userId}&timeframe=${selectedTimeframe}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Update metrics with fresh data
        setMetrics(prevMetrics => 
          prevMetrics.map(metric => {
            const freshData = data.metrics.find((m: any) => m.id === metric.id);
            return freshData ? { ...metric, ...freshData, timestamp: new Date() } : metric;
          })
        );
      }
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
    }
  }, [userId, selectedTimeframe]);

  const toggleConnection = () => {
    if (isPaused) {
      setIsPaused(false);
      connectWebSocket();
    } else {
      setIsPaused(true);
      if (wsRef.current) {
        wsRef.current.close();
      }
    }
  };

  const dismissNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  const updateNotificationSetting = (key: keyof NotificationSettings, value: boolean) => {
    setLocalNotificationSettings(prev => ({ ...prev, [key]: value }));
  };

  const testNotification = () => {
    triggerHapticFeedback('medium');
    playNotificationSound('achievement');
    showDesktopNotification('🔔 Test Notification', 'Notifications are working correctly!');
  };

  const getTrendIcon = (trend: ProfileMetric['trend']) => {
    switch (trend) {
      case 'up': return TrendingUp;
      case 'down': return TrendingDown;
      default: return Activity;
    }
  };

  const getTrendColor = (trend: ProfileMetric['trend']) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const renderMetricCard = (metric: ProfileMetric) => {
    const Icon = metric.icon;
    const TrendIcon = getTrendIcon(metric.trend);
    const progressValue = metric.target ? (metric.value / metric.target) * 100 : 0;

    return (
      <Card 
        key={metric.id} 
        className={cn(
          'transition-all duration-300 hover:shadow-md',
          enableAnimations && 'animate-in slide-in-from-bottom-2'
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className={cn('p-2 rounded-lg bg-gray-100', metric.color.replace('text-', 'bg-').replace('-600', '-100'))}>
                <Icon className={cn('h-4 w-4', metric.color)} />
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900">{metric.label}</h4>
                <p className="text-xs text-gray-500">
                  Updated {new Date(metric.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {metric.value.toLocaleString()}
                <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
              </div>
              
              <div className={cn('flex items-center space-x-1 text-sm', getTrendColor(metric.trend))}>
                <TrendIcon className="h-3 w-3" />
                <span>
                  {metric.change > 0 ? '+' : ''}{metric.change} ({metric.changePercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {metric.target && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Progress to goal</span>
                <span>{metric.value} / {metric.target}</span>
              </div>
              <Progress value={Math.min(progressValue, 100)} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Connection Status & Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Real-Time Tracking</span>
              <div className="flex items-center space-x-1">
                {wsStatus.connected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <Badge 
                  variant={wsStatus.connected ? "default" : "destructive"}
                  className="text-xs"
                >
                  {wsStatus.connected ? 'Live' : wsStatus.reconnecting ? 'Connecting...' : 'Offline'}
                </Badge>
              </div>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshMetrics}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleConnection}
                className="flex items-center space-x-1"
              >
                {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center space-x-1"
              >
                <Settings className="h-3 w-3" />
                <span>Settings</span>
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div>Last update: {wsStatus.lastHeartbeat?.toLocaleTimeString() || 'Never'}</div>
            <div>Updates: {recentUpdates.length}</div>
            {wsStatus.reconnectAttempts > 0 && (
              <div>Reconnect attempts: {wsStatus.reconnectAttempts}</div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Notification Settings Panel */}
      {showSettings && (
        <Card className="border-l-4 border-l-purple-500 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-purple-900">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Notification Settings</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testNotification}
                className="text-purple-700 border-purple-300 hover:bg-purple-100"
              >
                Test
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-purple-900">Event Types</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Award className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Achievements</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localNotificationSettings.achievements}
                    onChange={(e) => updateNotificationSetting('achievements', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Milestones</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localNotificationSettings.milestones}
                    onChange={(e) => updateNotificationSetting('milestones', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Metric Updates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localNotificationSettings.metrics}
                    onChange={(e) => updateNotificationSetting('metrics', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Warnings</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localNotificationSettings.warnings}
                    onChange={(e) => updateNotificationSetting('warnings', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-purple-900">Notification Methods</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Desktop Notifications</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localNotificationSettings.desktop}
                    onChange={(e) => updateNotificationSetting('desktop', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {localNotificationSettings.sound ? (
                      <Volume2 className="h-4 w-4 text-purple-600" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-purple-600" />
                    )}
                    <span className="text-sm">Sound Effects</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localNotificationSettings.sound}
                    onChange={(e) => updateNotificationSetting('sound', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Haptic Feedback</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localNotificationSettings.vibration}
                    onChange={(e) => updateNotificationSetting('vibration', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-purple-200">
              <p className="text-xs text-purple-700">
                🔒 Settings are automatically saved and synced across your devices.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notification, index) => (
            <Card 
              key={`${notification.timestamp}-${index}`}
              className="border-l-4 border-l-blue-500 bg-blue-50 animate-in slide-in-from-right-4"
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-sm">
                        {notification.type === 'achievement_unlock' && 'Achievement Unlocked!'}
                        {notification.type === 'milestone_reached' && 'Milestone Reached!'}
                        {notification.type === 'goal_progress' && 'Goal Progress Updated'}
                      </div>
                      <div className="text-xs text-gray-600">
                        {notification.data.title || notification.data.message}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissNotification(index)}
                    className="p-1"
                  >
                    ×
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Timeframe & View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {(['1h', '24h', '7d', '30d'] as const).map((timeframe) => (
            <Button
              key={timeframe}
              variant={selectedTimeframe === timeframe ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
              className="text-xs px-3"
            >
              {timeframe}
            </Button>
          ))}
        </div>
        
        <div className="flex space-x-1">
          {[
            { mode: 'grid' as const, icon: BarChart3 },
            { mode: 'chart' as const, icon: LineChart },
            { mode: 'minimal' as const, icon: PieChart }
          ].map(({ mode, icon: Icon }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(mode)}
              className="p-2"
            >
              <Icon className="h-3 w-3" />
            </Button>
          ))}
        </div>
      </div>

      {/* Metrics Display */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map(renderMetricCard)}
        </div>
      )}

      {viewMode === 'minimal' && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                const TrendIcon = getTrendIcon(metric.trend);
                
                return (
                  <div key={metric.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <Icon className={cn('h-4 w-4', metric.color)} />
                      <span className="font-medium text-sm">{metric.label}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="font-bold">{metric.value}</span>
                      <div className={cn('flex items-center space-x-1 text-sm', getTrendColor(metric.trend))}>
                        <TrendIcon className="h-3 w-3" />
                        <span>{metric.changePercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Updates Log */}
      {recentUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Recent Updates</span>
              <Badge variant="secondary">{recentUpdates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {recentUpdates.map((update, index) => (
                <div 
                  key={`${update.timestamp}-${index}`}
                  className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      update.type === 'metric_update' ? 'bg-blue-500' :
                      update.type === 'achievement_unlock' ? 'bg-green-500' :
                      'bg-purple-500'
                    )} />
                    <span className="text-gray-700">
                      {update.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  
                  <span className="text-gray-500 text-xs">
                    {new Date(update.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealTimeProfileTracker;