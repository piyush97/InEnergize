'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Star,
  Flame,
  Target,
  Users,
  TrendingUp,
  Award,
  Crown,
  Zap,
  Heart,
  Eye,
  MessageCircle,
  Share2,
  Calendar,
  CheckCircle,
  Clock,
  Gift,
  Sparkles,
  ArrowRight,
  Download,
  ExternalLink
} from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'profile' | 'networking' | 'engagement' | 'consistency' | 'growth';
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  unlockedAt?: Date;
  requirements: string[];
  tips?: string[];
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  icon: React.ElementType;
  reward: {
    xp: number;
    badge?: string;
    title?: string;
  };
  category: string;
  deadline?: Date;
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

interface AchievementSystemProps {
  userStats: UserStats;
  className?: string;
  showMilestones?: boolean;
  onAchievementUnlock?: (achievement: Achievement) => void;
}

const AchievementSystem: React.FC<AchievementSystemProps> = ({
  userStats,
  className,
  showMilestones = true,
  onAchievementUnlock
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [recentUnlocks, setRecentUnlocks] = useState<Achievement[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  // Define achievements with dynamic unlocking logic
  const achievementDefinitions: Achievement[] = [
    // Profile Completion Achievements
    {
      id: 'profile_starter',
      title: 'Getting Started',
      description: 'Complete your basic profile information',
      icon: Target,
      category: 'profile',
      unlocked: userStats.profileViews > 0,
      progress: Math.min(userStats.profileViews, 1),
      maxProgress: 1,
      rarity: 'common',
      xpReward: 50,
      requirements: ['Add profile picture', 'Complete headline', 'Add basic info'],
      tips: ['Use a professional headshot', 'Make your headline compelling']
    },
    {
      id: 'profile_optimizer',
      title: 'Profile Optimizer',
      description: 'Achieve 75% profile completion',
      icon: TrendingUp,
      category: 'profile',
      unlocked: false, // Would be calculated based on actual profile data
      progress: 65,
      maxProgress: 75,
      rarity: 'rare',
      xpReward: 200,
      requirements: ['Complete experience section', 'Add skills', 'Write summary'],
      tips: ['Use keywords in your summary', 'Get skill endorsements']
    },
    {
      id: 'profile_master',
      title: 'Profile Master',
      description: 'Achieve 95% profile completion',
      icon: Crown,
      category: 'profile',
      unlocked: false,
      progress: 65,
      maxProgress: 95,
      rarity: 'legendary',
      xpReward: 1000,
      requirements: ['Complete all sections', 'Get recommendations', 'Add projects'],
      tips: ['Request recommendations from colleagues', 'Showcase your best work']
    },

    // Networking Achievements
    {
      id: 'first_connection',
      title: 'Networker',
      description: 'Make your first connection',
      icon: Users,
      category: 'networking',
      unlocked: userStats.connections >= 1,
      progress: Math.min(userStats.connections, 1),
      maxProgress: 1,
      rarity: 'common',
      xpReward: 25,
      requirements: ['Send connection request', 'Get accepted'],
      unlockedAt: new Date(Date.now() - 86400000)
    },
    {
      id: 'social_butterfly',
      title: 'Social Butterfly',
      description: 'Reach 100 connections',
      icon: Heart,
      category: 'networking',
      unlocked: userStats.connections >= 100,
      progress: Math.min(userStats.connections, 100),
      maxProgress: 100,
      rarity: 'rare',
      xpReward: 300,
      requirements: ['Build professional network', 'Maintain relationships'],
      tips: ['Connect with colleagues and industry peers', 'Add a personal note to requests']
    },
    {
      id: 'network_master',
      title: 'Network Master',
      description: 'Reach 500 connections',
      icon: Trophy,
      category: 'networking',
      unlocked: userStats.connections >= 500,
      progress: Math.min(userStats.connections, 500),
      maxProgress: 500,
      rarity: 'epic',
      xpReward: 750,
      requirements: ['Extensive professional network', 'High acceptance rate'],
      tips: ['Quality over quantity', 'Engage with your network regularly']
    },

    // Engagement Achievements
    {
      id: 'content_creator',
      title: 'Content Creator',
      description: 'Publish your first post',
      icon: MessageCircle,
      category: 'engagement',
      unlocked: userStats.posts >= 1,
      progress: Math.min(userStats.posts, 1),
      maxProgress: 1,
      rarity: 'common',
      xpReward: 75,
      requirements: ['Create and publish content'],
      tips: ['Share industry insights', 'Tell your professional story']
    },
    {
      id: 'thought_leader',
      title: 'Thought Leader',
      description: 'Maintain 10% engagement rate',
      icon: Sparkles,
      category: 'engagement',
      unlocked: userStats.engagementRate >= 10,
      progress: Math.min(userStats.engagementRate, 10),
      maxProgress: 10,
      rarity: 'epic',
      xpReward: 500,
      requirements: ['High quality content', 'Audience engagement'],
      tips: ['Ask questions in your posts', 'Respond to comments promptly']
    },

    // Consistency Achievements
    {
      id: 'streak_starter',
      title: 'Consistency Counts',
      description: 'Maintain a 7-day activity streak',
      icon: Flame,
      category: 'consistency',
      unlocked: userStats.streak >= 7,
      progress: Math.min(userStats.streak, 7),
      maxProgress: 7,
      rarity: 'rare',
      xpReward: 200,
      requirements: ['Daily LinkedIn activity'],
      tips: ['Set daily reminders', 'Small actions count']
    },
    {
      id: 'dedication_master',
      title: 'Dedication Master',
      description: 'Maintain a 30-day activity streak',
      icon: Award,
      category: 'consistency',
      unlocked: userStats.streak >= 30,
      progress: Math.min(userStats.streak, 30),
      maxProgress: 30,
      rarity: 'legendary',
      xpReward: 1500,
      requirements: ['Consistent daily engagement'],
      tips: ['Build it into your routine', 'Track your progress']
    },

    // Growth Achievements
    {
      id: 'rising_star',
      title: 'Rising Star',
      description: 'Get 100 profile views in a week',
      icon: Eye,
      category: 'growth',
      unlocked: userStats.profileViews >= 100,
      progress: Math.min(userStats.profileViews, 100),
      maxProgress: 100,
      rarity: 'rare',
      xpReward: 250,
      requirements: ['Increased visibility', 'Profile optimization'],
      tips: ['Share valuable content', 'Engage with others\' posts']
    }
  ];

  // Define milestones
  const milestoneDefinitions: Milestone[] = [
    {
      id: 'views_milestone',
      title: 'Profile Views',
      description: 'Increase your professional visibility',
      targetValue: 500,
      currentValue: userStats.profileViews,
      unit: 'views',
      icon: Eye,
      reward: { xp: 300, badge: 'Visibility Expert' },
      category: 'Growth'
    },
    {
      id: 'connections_milestone',
      title: 'Network Growth',
      description: 'Expand your professional network',
      targetValue: 250,
      currentValue: userStats.connections,
      unit: 'connections',
      icon: Users,
      reward: { xp: 400, badge: 'Network Builder' },
      category: 'Networking'
    },
    {
      id: 'engagement_milestone',
      title: 'Engagement Rate',
      description: 'Build an engaged audience',
      targetValue: 15,
      currentValue: userStats.engagementRate,
      unit: '%',
      icon: Heart,
      reward: { xp: 600, badge: 'Engagement Master' },
      category: 'Content'
    },
    {
      id: 'streak_milestone',
      title: 'Activity Streak',
      description: 'Maintain consistent activity',
      targetValue: 60,
      currentValue: userStats.streak,
      unit: 'days',
      icon: Flame,
      reward: { xp: 800, badge: 'Consistency Champion' },
      category: 'Habits',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  ];

  useEffect(() => {
    setAchievements(achievementDefinitions);
    setMilestones(milestoneDefinitions);

    // Check for newly unlocked achievements
    const newUnlocks = achievementDefinitions.filter(
      achievement => achievement.unlocked && !achievement.unlockedAt
    );

    if (newUnlocks.length > 0) {
      setRecentUnlocks(newUnlocks);
      setShowCelebration(true);
      newUnlocks.forEach(achievement => {
        onAchievementUnlock?.(achievement);
      });

      // Hide celebration after 3 seconds
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }, [userStats, onAchievementUnlock]);

  const categories = [
    { id: 'all', name: 'All', icon: Star },
    { id: 'profile', name: 'Profile', icon: Target },
    { id: 'networking', name: 'Networking', icon: Users },
    { id: 'engagement', name: 'Engagement', icon: MessageCircle },
    { id: 'consistency', name: 'Consistency', icon: Flame },
    { id: 'growth', name: 'Growth', icon: TrendingUp }
  ];

  const filteredAchievements = activeCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === activeCategory);

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'from-gray-400 to-gray-600';
      case 'rare': return 'from-blue-400 to-blue-600';
      case 'epic': return 'from-purple-400 to-purple-600';
      case 'legendary': return 'from-yellow-400 to-yellow-600';
    }
  };

  const getRarityBadgeColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800';
      case 'rare': return 'bg-blue-100 text-blue-800';
      case 'epic': return 'bg-purple-100 text-purple-800';
      case 'legendary': return 'bg-yellow-100 text-yellow-800';
    }
  };

  const totalAchievements = achievements.length;
  const unlockedAchievements = achievements.filter(a => a.unlocked).length;
  const totalXpFromAchievements = achievements
    .filter(a => a.unlocked)
    .reduce((sum, a) => sum + a.xpReward, 0);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Celebration Animation */}
      {showCelebration && recentUnlocks.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in-0">
          <Card className="max-w-md mx-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-yellow-200" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Achievement Unlocked!</h3>
                  <p className="text-lg">{recentUnlocks[0].title}</p>
                  <p className="text-sm text-white/80 mt-1">
                    +{recentUnlocks[0].xpReward} XP
                  </p>
                </div>
                <div className="flex justify-center space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="h-4 w-4 text-yellow-200 animate-pulse" 
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Achievement Overview */}
      <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy className="h-6 w-6" />
              <span>Achievement Progress</span>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white">
              {unlockedAchievements}/{totalAchievements}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{unlockedAchievements}</div>
              <div className="text-sm text-white/80">Unlocked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalXpFromAchievements}</div>
              <div className="text-sm text-white/80">Total XP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Math.round((unlockedAchievements / totalAchievements) * 100)}%
              </div>
              <div className="text-sm text-white/80">Complete</div>
            </div>
          </div>
          
          <Progress 
            value={(unlockedAchievements / totalAchievements) * 100} 
            className="h-3 bg-white/20"
          />
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category.id)}
              className="flex items-center space-x-1"
            >
              <Icon className="h-4 w-4" />
              <span>{category.name}</span>
            </Button>
          );
        })}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => {
          const Icon = achievement.icon;
          const isUnlocked = achievement.unlocked;
          const progressPercent = (achievement.progress / achievement.maxProgress) * 100;
          
          return (
            <Card
              key={achievement.id}
              className={cn(
                'relative overflow-hidden transition-all duration-300 hover:shadow-lg',
                isUnlocked 
                  ? 'border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {/* Rarity Indicator */}
              <div className={cn(
                'absolute top-0 right-0 w-0 h-0 border-l-0 border-r-[40px] border-t-[40px] border-b-0',
                isUnlocked 
                  ? `border-r-transparent border-t-${achievement.rarity === 'legendary' ? 'yellow' : achievement.rarity === 'epic' ? 'purple' : achievement.rarity === 'rare' ? 'blue' : 'gray'}-500`
                  : 'border-r-transparent border-t-gray-300'
              )} />
              
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3 mb-4">
                  <div className={cn(
                    'p-3 rounded-full flex-shrink-0 bg-gradient-to-br',
                    isUnlocked ? getRarityColor(achievement.rarity) : 'from-gray-300 to-gray-400'
                  )}>
                    <Icon className={cn(
                      'h-6 w-6',
                      isUnlocked ? 'text-white' : 'text-gray-500'
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className={cn(
                        'font-semibold truncate',
                        isUnlocked ? 'text-gray-900' : 'text-gray-500'
                      )}>
                        {achievement.title}
                      </h3>
                      {isUnlocked && (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    <Badge 
                      size="sm" 
                      className={cn('mb-2', getRarityBadgeColor(achievement.rarity))}
                    >
                      {achievement.rarity}
                    </Badge>
                    
                    <p className={cn(
                      'text-sm mb-3',
                      isUnlocked ? 'text-gray-600' : 'text-gray-400'
                    )}>
                      {achievement.description}
                    </p>
                  </div>
                </div>
                
                {/* Progress */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className={cn(
                      isUnlocked ? 'text-gray-600' : 'text-gray-400'
                    )}>
                      Progress
                    </span>
                    <span className={cn(
                      'font-medium',
                      isUnlocked ? 'text-gray-900' : 'text-gray-500'
                    )}>
                      {achievement.progress}/{achievement.maxProgress}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
                
                {/* XP Reward */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Star className={cn(
                      'h-4 w-4',
                      isUnlocked ? 'text-yellow-500' : 'text-gray-400'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      isUnlocked ? 'text-yellow-600' : 'text-gray-400'
                    )}>
                      {achievement.xpReward} XP
                    </span>
                  </div>
                  
                  {achievement.unlockedAt && (
                    <div className="text-xs text-gray-500">
                      {achievement.unlockedAt.toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                {/* Requirements */}
                {!isUnlocked && achievement.requirements.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">Requirements:</div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {achievement.requirements.slice(0, 2).map((req, index) => (
                        <li key={index} className="flex items-center space-x-1">
                          <div className="w-1 h-1 bg-gray-400 rounded-full" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Tips */}
                {achievement.tips && achievement.tips.length > 0 && (
                  <div className="mt-2">
                    <Button variant="ghost" size="sm" className="text-xs p-0">
                      View Tips <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Milestones Section */}
      {showMilestones && milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-500" />
              <span>Current Milestones</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {milestones.map((milestone) => {
                const Icon = milestone.icon;
                const progressPercent = (milestone.currentValue / milestone.targetValue) * 100;
                const isCompleted = milestone.currentValue >= milestone.targetValue;
                
                return (
                  <div
                    key={milestone.id}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all duration-300',
                      isCompleted 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-blue-200 bg-blue-50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          'p-2 rounded-full',
                          isCompleted ? 'bg-green-500' : 'bg-blue-500'
                        )}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                          <p className="text-sm text-gray-600">{milestone.description}</p>
                        </div>
                      </div>
                      
                      {milestone.deadline && (
                        <div className="text-xs text-gray-500 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {Math.ceil((milestone.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Progress value={Math.min(progressPercent, 100)} className="h-3" />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          {milestone.currentValue.toLocaleString()} / {milestone.targetValue.toLocaleString()} {milestone.unit}
                        </span>
                        
                        <div className="flex items-center space-x-1 text-sm">
                          <Gift className="h-3 w-3 text-blue-500" />
                          <span className="text-blue-600 font-medium">
                            +{milestone.reward.xp} XP
                          </span>
                        </div>
                      </div>
                      
                      {milestone.reward.badge && (
                        <div className="text-xs text-gray-500">
                          Reward: {milestone.reward.badge} badge
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="flex items-center space-x-2">
          <Share2 className="h-4 w-4" />
          <span>Share Progress</span>
        </Button>
        
        <Button variant="outline" className="flex items-center space-x-2">
          <Download className="h-4 w-4" />
          <span>Export Achievements</span>
        </Button>
        
        <Button variant="outline" className="flex items-center space-x-2">
          <ExternalLink className="h-4 w-4" />
          <span>View Leaderboard</span>
        </Button>
      </div>
    </div>
  );
};

export default AchievementSystem;