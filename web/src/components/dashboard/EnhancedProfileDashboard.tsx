'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Zap,
  Trophy,
  Smartphone,
  Monitor,
  Activity,
  Settings,
  Eye,
  EyeOff,
  LayoutDashboard,
  BarChart3,
  Target,
  Award,
  TrendingUp,
  Users,
  Bell,
  BellOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  Share2,
  Play,
  Pause
} from 'lucide-react';

// Import our new visualization components
import ProfileVisualization3D from './ProfileVisualization3D';
import AchievementSystem from './AchievementSystem';
import MobileProfileVisualizer from './MobileProfileVisualizer';
import RealTimeProfileTracker from './RealTimeProfileTracker';

// Import existing components to maintain compatibility
import ProfileCompletenessChart from './ProfileCompletenessChart';

interface DashboardPreferences {
  layout: 'grid' | 'stack' | 'sidebar';
  theme: 'light' | 'dark' | 'auto';
  showAnimations: boolean;
  enableNotifications: boolean;
  enableRealTime: boolean;
  mobileOptimized: boolean;
  compactMode: boolean;
}

interface UserStats {
  profileViews: number;
  connections: number;
  posts: number;
  engagementRate: number;
  streak: number;
  totalXp: number;
  level: number;
}

interface EnhancedProfileDashboardProps {
  userId: string;
  completenessData?: any;
  className?: string;
  initialPreferences?: Partial<DashboardPreferences>;
  onPreferencesChange?: (preferences: DashboardPreferences) => void;
}

const EnhancedProfileDashboard: React.FC<EnhancedProfileDashboardProps> = ({
  userId,
  completenessData,
  className,
  initialPreferences = {},
  onPreferencesChange
}) => {
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    layout: 'grid',
    theme: 'light',
    showAnimations: true,
    enableNotifications: true,
    enableRealTime: true,
    mobileOptimized: false,
    compactMode: false,
    ...initialPreferences
  });

  const [activeComponent, setActiveComponent] = useState<'3d' | 'achievements' | 'mobile' | 'realtime' | 'classic'>('3d');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
    profileViews: 142,
    connections: 28,
    posts: 15,
    engagementRate: 8.5,
    streak: 12,
    totalXp: 2847,
    level: 7
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect mobile device
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  // Update preferences
  const updatePreferences = (updates: Partial<DashboardPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    onPreferencesChange?.(newPreferences);
    
    // Save to localStorage
    localStorage.setItem('profile-dashboard-preferences', JSON.stringify(newPreferences));
  };

  // Load saved preferences
  useEffect(() => {
    const saved = localStorage.getItem('profile-dashboard-preferences');
    if (saved) {
      try {
        const savedPreferences = JSON.parse(saved);
        setPreferences(prev => ({ ...prev, ...savedPreferences }));
      } catch (error) {
        console.error('Failed to load saved preferences:', error);
      }
    }

    // Auto-enable mobile optimization on mobile devices
    if (isMobileDevice && !preferences.mobileOptimized) {
      updatePreferences({ mobileOptimized: true });
      setActiveComponent('mobile');
    }
  }, [isMobileDevice]);

  // Handle achievement unlocks
  const handleAchievementUnlock = (achievement: any) => {
    if (preferences.enableNotifications) {
      // Show toast notification
      console.log('Achievement unlocked:', achievement);
      
      // Update user stats
      setUserStats(prev => ({
        ...prev,
        totalXp: prev.totalXp + achievement.xpReward,
        level: Math.floor((prev.totalXp + achievement.xpReward) / 500) + 1
      }));
    }
  };

  // Handle metric updates
  const handleMetricUpdate = (metric: any) => {
    console.log('Metric updated:', metric);
    // Could trigger UI updates, notifications, etc.
  };

  // Handle section interactions
  const handleSectionInteraction = (sectionId: string, interactionType: string) => {
    console.log('Section interaction:', sectionId, interactionType);
    // Could trigger analytics, tooltips, etc.
  };

  // Component selection
  const components = [
    {
      id: '3d' as const,
      name: '3D Visualization',
      icon: Zap,
      description: 'Interactive 3D profile progress',
      recommended: !isMobileDevice
    },
    {
      id: 'achievements' as const,
      name: 'Achievements',
      icon: Trophy,
      description: 'Gamification & rewards',
      recommended: true
    },
    {
      id: 'mobile' as const,
      name: 'Mobile Touch',
      icon: Smartphone,
      description: 'Touch-optimized interface',
      recommended: isMobileDevice
    },
    {
      id: 'realtime' as const,
      name: 'Real-Time Tracking',
      icon: Activity,
      description: 'Live metrics & updates',
      recommended: preferences.enableRealTime
    },
    {
      id: 'classic' as const,
      name: 'Classic View',
      icon: BarChart3,
      description: 'Traditional dashboard',
      recommended: false
    }
  ];

  const renderActiveComponent = () => {
    const commonProps = {
      completenessData,
      className: cn(
        'transition-all duration-300',
        preferences.showAnimations && 'animate-in fade-in-0 slide-in-from-bottom-4'
      ),
      enableAnimations: preferences.showAnimations,
      onAchievementUnlock: handleAchievementUnlock,
      onSectionClick: handleSectionInteraction
    };

    switch (activeComponent) {
      case '3d':
        return (
          <ProfileVisualization3D
            {...commonProps}
            showAchievements={true}
          />
        );

      case 'achievements':
        return (
          <AchievementSystem
            userStats={userStats}
            {...commonProps}
            showMilestones={true}
          />
        );

      case 'mobile':
        return (
          <MobileProfileVisualizer
            {...commonProps}
            enableHapticFeedback={true}
            enableAudioFeedback={false}
            onSectionInteraction={handleSectionInteraction}
          />
        );

      case 'realtime':
        return (
          <RealTimeProfileTracker
            userId={userId}
            {...commonProps}
            showNotifications={preferences.enableNotifications}
            onMetricUpdate={handleMetricUpdate}
            onAchievementUnlock={handleAchievementUnlock}
          />
        );

      case 'classic':
        return (
          <ProfileCompletenessChart
            {...commonProps}
            showDetailed={true}
            enableRecommendations={true}
          />
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-red-200 bg-red-50', className)}>
        <CardContent className="p-6 text-center">
          <div className="text-red-600 mb-4">
            <Activity className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-semibold">Dashboard Error</h3>
            <p className="text-sm">{error}</p>
          </div>
          <Button onClick={() => setError(null)} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Dashboard Header */}
      <Card className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-white text-xl">
                  Enhanced Profile Dashboard
                </CardTitle>
                <p className="text-white/80 text-sm">
                  AI-powered LinkedIn optimization with gamification
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Component Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Visualization Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {components.map((component) => {
              const Icon = component.icon;
              const isActive = activeComponent === component.id;
              const isRecommended = component.recommended;
              
              return (
                <Button
                  key={component.id}
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setActiveComponent(component.id)}
                  className={cn(
                    'h-auto p-4 flex flex-col items-center space-y-2 relative',
                    isActive && 'ring-2 ring-blue-500',
                    isRecommended && !isActive && 'border-green-200 bg-green-50'
                  )}
                >
                  {isRecommended && (
                    <Badge 
                      size="sm" 
                      className="absolute -top-2 -right-2 bg-green-500 text-white text-xs"
                    >
                      ✓
                    </Badge>
                  )}
                  
                  <Icon className={cn(
                    'h-6 w-6',
                    isActive ? 'text-white' : 'text-gray-600'
                  )} />
                  
                  <div className="text-center">
                    <div className={cn(
                      'font-medium text-sm',
                      isActive ? 'text-white' : 'text-gray-900'
                    )}>
                      {component.name}
                    </div>
                    <div className={cn(
                      'text-xs',
                      isActive ? 'text-white/80' : 'text-gray-500'
                    )}>
                      {component.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Settings Panel */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Animations</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updatePreferences({ showAnimations: !preferences.showAnimations })}
                  className="p-1"
                >
                  {preferences.showAnimations ? 
                    <Play className="h-4 w-4 text-green-500" /> : 
                    <Pause className="h-4 w-4 text-gray-400" />
                  }
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Notifications</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updatePreferences({ enableNotifications: !preferences.enableNotifications })}
                  className="p-1"
                >
                  {preferences.enableNotifications ? 
                    <Bell className="h-4 w-4 text-blue-500" /> : 
                    <BellOff className="h-4 w-4 text-gray-400" />
                  }
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Real-time</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updatePreferences({ enableRealTime: !preferences.enableRealTime })}
                  className="p-1"
                >
                  {preferences.enableRealTime ? 
                    <Activity className="h-4 w-4 text-green-500" /> : 
                    <Activity className="h-4 w-4 text-gray-400" />
                  }
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Component Display */}
      <div className={cn(
        'transition-all duration-300',
        isFullscreen && 'fixed inset-4 z-50 bg-white rounded-lg shadow-2xl overflow-auto'
      )}>
        {renderActiveComponent()}
      </div>

      {/* Quick Stats Footer */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{completenessData?.score || 0}%</div>
              <div className="text-xs text-gray-600">Profile Complete</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{userStats.level}</div>
              <div className="text-xs text-gray-600">Level</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{userStats.totalXp.toLocaleString()}</div>
              <div className="text-xs text-gray-600">Total XP</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{userStats.streak}</div>
              <div className="text-xs text-gray-600">Day Streak</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{userStats.profileViews}</div>
              <div className="text-xs text-gray-600">Profile Views</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-600">{userStats.connections}</div>
              <div className="text-xs text-gray-600">Connections</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedProfileDashboard;