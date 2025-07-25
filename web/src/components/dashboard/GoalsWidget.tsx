import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Target, Plus, Edit3, Check, X, Trophy, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Goal {
  id: string;
  type: 'profileViews' | 'connections' | 'completeness' | 'engagement';
  title: string;
  targetValue: number;
  currentValue: number;
  deadline?: string;
  achieved: boolean;
  createdAt: string;
}

interface GoalsWidgetProps {
  className?: string;
  currentMetrics?: {
    profileViews: number;
    connections: number;
    completenessScore: number;
    engagementRate: number;
  };
}

const GoalsWidget: React.FC<GoalsWidgetProps> = ({ className, currentMetrics }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form state for creating/editing goals
  const [goalType, setGoalType] = useState<Goal['type']>('profileViews');
  const [targetValue, setTargetValue] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    fetchGoals();
  }, []);

  useEffect(() => {
    // Update current values when metrics change
    if (currentMetrics) {
      setGoals(prev => prev.map(goal => ({
        ...goal,
        currentValue: getCurrentValue(goal.type, currentMetrics),
        achieved: getCurrentValue(goal.type, currentMetrics) >= goal.targetValue
      })));
    }
  }, [currentMetrics]);

  const fetchGoals = async () => {
    try {
      // For now, we'll use mock data
      // In a real implementation, this would fetch from the analytics service
      const mockGoals: Goal[] = [
        {
          id: '1',
          type: 'profileViews',
          title: 'Profile Views Goal',
          targetValue: 1000,
          currentValue: currentMetrics?.profileViews || 750,
          deadline: '2024-12-31',
          achieved: false,
          createdAt: '2024-01-01'
        },
        {
          id: '2',
          type: 'connections',
          title: 'Network Growth',
          targetValue: 500,
          currentValue: currentMetrics?.connections || 425,
          deadline: '2024-12-31',
          achieved: false,
          createdAt: '2024-01-01'
        },
        {
          id: '3',
          type: 'completeness',
          title: 'Perfect Profile',
          targetValue: 100,
          currentValue: currentMetrics?.completenessScore || 95,
          deadline: '2024-08-31',
          achieved: false,
          createdAt: '2024-01-01'
        }
      ];
      
      setGoals(mockGoals);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      setLoading(false);
    }
  };

  const getCurrentValue = (type: Goal['type'], metrics: any): number => {
    switch (type) {
      case 'profileViews':
        return metrics.profileViews || 0;
      case 'connections':
        return metrics.connections || 0;
      case 'completeness':
        return metrics.completenessScore || 0;
      case 'engagement':
        return metrics.engagementRate || 0;
      default:
        return 0;
    }
  };

  const getGoalIcon = (type: Goal['type']) => {
    switch (type) {
      case 'profileViews':
        return '👁️';
      case 'connections':
        return '🤝';
      case 'completeness':
        return '✅';
      case 'engagement':
        return '❤️';
      default:
        return '🎯';
    }
  };

  const getGoalColor = (progress: number) => {
    if (progress >= 100) return 'text-green-600';
    if (progress >= 75) return 'text-blue-600';
    if (progress >= 50) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const calculateProgress = (current: number, target: number): number => {
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const calculateDaysRemaining = (deadline?: string): number | null => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleCreateGoal = async () => {
    if (!targetValue) return;

    const newGoal: Goal = {
      id: Date.now().toString(),
      type: goalType,
      title: getGoalTitle(goalType),
      targetValue: parseInt(targetValue),
      currentValue: getCurrentValue(goalType, currentMetrics || {}),
      deadline: deadline || undefined,
      achieved: false,
      createdAt: new Date().toISOString()
    };

    setGoals(prev => [...prev, newGoal]);
    resetForm();
    setShowCreateDialog(false);
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal || !targetValue) return;

    setGoals(prev => prev.map(goal => 
      goal.id === editingGoal.id 
        ? {
            ...goal,
            targetValue: parseInt(targetValue),
            deadline: deadline || undefined
          }
        : goal
    ));
    
    resetForm();
    setEditingGoal(null);
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals(prev => prev.filter(goal => goal.id !== goalId));
  };

  const resetForm = () => {
    setGoalType('profileViews');
    setTargetValue('');
    setDeadline('');
  };

  const getGoalTitle = (type: Goal['type']): string => {
    const titles = {
      profileViews: 'Profile Views Goal',
      connections: 'Network Growth Goal',
      completeness: 'Profile Completion Goal',
      engagement: 'Engagement Goal'
    };
    return titles[type];
  };

  const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
    const progress = calculateProgress(goal.currentValue, goal.targetValue);
    const daysRemaining = calculateDaysRemaining(goal.deadline);
    const isOverdue = daysRemaining !== null && daysRemaining < 0;
    const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

    return (
      <div className={cn(
        'p-4 rounded-lg border-2 transition-all duration-200',
        goal.achieved 
          ? 'border-green-200 bg-green-50'
          : isOverdue
          ? 'border-red-200 bg-red-50'
          : isExpiringSoon
          ? 'border-yellow-200 bg-yellow-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getGoalIcon(goal.type)}</span>
            <div>
              <h4 className="font-medium text-gray-900">{goal.title}</h4>
              {goal.deadline && (
                <div className="flex items-center space-x-1 mt-1">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  <span className={cn(
                    'text-xs',
                    isOverdue ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-gray-500'
                  )}>
                    {isOverdue 
                      ? `Overdue by ${Math.abs(daysRemaining!)} days`
                      : daysRemaining === 0
                      ? 'Due today'
                      : daysRemaining === 1
                      ? 'Due tomorrow'
                      : `${daysRemaining} days left`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {goal.achieved && (
              <div className="bg-green-100 p-1 rounded-full">
                <Check className="h-4 w-4 text-green-600" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingGoal(goal);
                setGoalType(goal.type);
                setTargetValue(goal.targetValue.toString());
                setDeadline(goal.deadline || '');
              }}
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteGoal(goal.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className={cn('font-medium', getGoalColor(progress))}>
              {progress}%
            </span>
          </div>
          
          <Progress 
            value={progress} 
            className="h-2"
          />
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>{goal.currentValue.toLocaleString()}</span>
            <span>{goal.targetValue.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 bg-gray-100 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-2 bg-gray-300 rounded mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Goals</span>
          </CardTitle>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-1" />
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="goal-type">Goal Type</Label>
                  <select
                    id="goal-type"
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as Goal['type'])}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="profileViews">Profile Views</option>
                    <option value="connections">Connections</option>
                    <option value="completeness">Profile Completeness</option>
                    <option value="engagement">Engagement Rate</option>
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="target-value">Target Value</Label>
                  <Input
                    id="target-value"
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="Enter target value"
                  />
                </div>
                
                <div>
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateGoal}>
                    Create Goal
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {goals.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No goals set yet</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Goal
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map(goal => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}

        {/* Edit Goal Dialog */}
        <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-target-value">Target Value</Label>
                <Input
                  id="edit-target-value"
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="Enter target value"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-deadline">Deadline (Optional)</Label>
                <Input
                  id="edit-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingGoal(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateGoal}>
                  Update Goal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default GoalsWidget;