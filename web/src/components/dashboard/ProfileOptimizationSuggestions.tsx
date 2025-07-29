// ProfileOptimizationSuggestions.tsx - AI-Powered LinkedIn Profile Optimization
// Provides actionable suggestions based on completeness analysis and industry benchmarks
// Integrates with backend completeness service and follows LinkedIn compliance

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Lightbulb,
  Target,
  Clock,
  TrendingUp,
  CheckCircle2,
  Circle,
  AlertCircle,
  Star,
  RefreshCw,
  Filter,
  Eye,
  ThumbsUp,
  Users,
  FileText,
  ExternalLink
} from 'lucide-react';

// Types for optimization suggestions
interface OptimizationSuggestion {
  id: string;
  field: string;
  priority: 'high' | 'medium' | 'low';
  impact: number;
  timeEstimate: string;
  difficulty: 'easy' | 'medium' | 'hard';
  suggestion: string;
  category: 'content' | 'engagement' | 'visibility' | 'networking';
  completed: boolean;
  aiGenerated?: boolean;
  complianceNotes?: string;
}

interface ProfileOptimizationData {
  suggestions: OptimizationSuggestion[];
  completionRate: number;
  potentialImpact: number;
  timeToComplete: string;
  industryComparison: {
    yourScore: number;
    industryAverage: number;
    topPercentile: number;
  };
}

interface ProfileOptimizationSuggestionsProps {
  className?: string;
  maxSuggestions?: number;
  showFilters?: boolean;
  enableAI?: boolean;
}

const ProfileOptimizationSuggestions: React.FC<ProfileOptimizationSuggestionsProps> = ({
  className,
  maxSuggestions = 10,
  showFilters = true,
  enableAI = true
}) => {
  const [data, setData] = useState<ProfileOptimizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [category, setCategory] = useState<'all' | 'content' | 'engagement' | 'visibility' | 'networking'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Icon mapping for different categories
  const categoryIcons = {
    content: FileText,
    engagement: ThumbsUp,
    visibility: Eye,
    networking: Users
  };

  // Priority colors
  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  };

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800'
  };

  useEffect(() => {
    fetchOptimizationData();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchOptimizationData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchOptimizationData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('authToken');
      
      // Fetch both traditional suggestions and AI-powered recommendations
      const [suggestionsResponse, predictionsResponse] = await Promise.all([
        fetch('/api/v1/linkedin/profile/optimization-suggestions', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/v1/predictions/recommendations', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const suggestionsResult = await suggestionsResponse.json();
      
      // Handle predictions response gracefully (may not be available for all users)
      let predictiveRecommendations = [];
      if (predictionsResponse.ok) {
        const predictionsResult = await predictionsResponse.json();
        if (predictionsResult.success) {
          predictiveRecommendations = predictionsResult.data || [];
        }
      }

      // Merge traditional suggestions with AI predictions
      const mergedSuggestions = [
        ...(suggestionsResult.data?.suggestions || []),
        ...predictiveRecommendations.map((rec: any, index: number) => ({
          id: `ai-${index}`,
          field: rec.category,
          priority: rec.priority,
          impact: 25, // Default impact for AI suggestions
          timeEstimate: rec.implementation === 'immediate' ? '5-10 min' : 
                       rec.implementation === 'short_term' ? '1-2 hours' : '1-2 days',
          difficulty: rec.implementation === 'immediate' ? 'easy' : 
                     rec.implementation === 'short_term' ? 'medium' : 'hard',
          suggestion: rec.description,
          category: rec.category,
          completed: false,
          aiGenerated: true,
          expectedImpact: rec.expectedImpact
        }))
      ];

      setData({
        ...suggestionsResult.data,
        suggestions: mergedSuggestions
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markSuggestionComplete = async (suggestionId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      
      await fetch(`/api/v1/linkedin/profile/optimization-suggestions/${suggestionId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Update local state
      setData(prev => prev ? {
        ...prev,
        suggestions: prev.suggestions.map(s => 
          s.id === suggestionId ? { ...s, completed: true } : s
        )
      } : null);
    } catch (err) {
      console.error('Failed to mark suggestion as complete:', err);
    }
  };

  const generateAISuggestion = async (field: string) => {
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('/api/v1/linkedin/profile/ai-suggestions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ field, enableAI })
      });

      if (response.ok) {
        await response.json();
        // Refresh data to show new AI suggestions
        fetchOptimizationData();
      }
    } catch (err) {
      console.error('Failed to generate AI suggestion:', err);
    }
  };

  const filteredSuggestions = data?.suggestions.filter(suggestion => {
    const priorityMatch = filter === 'all' || suggestion.priority === filter;
    const categoryMatch = category === 'all' || suggestion.category === category;
    return priorityMatch && categoryMatch;
  }).slice(0, maxSuggestions) || [];

  const completedSuggestions = data?.suggestions.filter(s => s.completed).length || 0;
  const totalSuggestions = data?.suggestions.length || 0;
  const progressPercentage = totalSuggestions > 0 ? (completedSuggestions / totalSuggestions) * 100 : 0;

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5" />
            <span>Profile Optimization</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span>Profile Optimization</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {error || 'Unable to load optimization suggestions'}
            </p>
            <Button onClick={fetchOptimizationData} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Overview Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5" />
              <span>Profile Optimization</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOptimizationData}
              disabled={refreshing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Progress Overview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="text-2xl font-bold text-blue-600">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-xs text-gray-600">
                {completedSuggestions} of {totalSuggestions} suggestions completed
              </div>
            </div>

            {/* Potential Impact */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Potential Impact</span>
                <span className="text-2xl font-bold text-green-600">
                  +{data.potentialImpact}%
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Estimated profile score improvement
              </div>
            </div>

            {/* Time to Complete */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Time to Complete</span>
                <span className="text-2xl font-bold text-orange-600">
                  {data.timeToComplete}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Estimated time for all suggestions
              </div>
            </div>
          </div>

          {/* Industry Comparison */}
          {data.industryComparison && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">Industry Comparison</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600">Your Score</div>
                  <div className="text-lg font-bold text-blue-600">
                    {data.industryComparison.yourScore}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Industry Average</div>
                  <div className="text-lg font-bold text-gray-700">
                    {data.industryComparison.industryAverage}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Top 10%</div>
                  <div className="text-lg font-bold text-green-600">
                    {data.industryComparison.topPercentile}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      {showFilters && (
        <Card className="w-full">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Priority:</span>
                {(['all', 'high', 'medium', 'low'] as const).map(p => (
                  <Button
                    key={p}
                    variant={filter === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Category:</span>
                {(['all', 'content', 'engagement', 'visibility', 'networking'] as const).map(c => (
                  <Button
                    key={c}
                    variant={category === c ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategory(c)}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestions List */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Actionable Suggestions</span>
            <Badge variant="secondary">{filteredSuggestions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSuggestions.map((suggestion) => {
              const CategoryIcon = categoryIcons[suggestion.category];
              
              return (
                <div
                  key={suggestion.id}
                  className={cn(
                    'p-4 border rounded-lg transition-all duration-200',
                    suggestion.completed 
                      ? 'bg-green-50 border-green-200' 
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start space-x-3">
                    {/* Status Icon */}
                    <div className="mt-1">
                      {suggestion.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>

                    {/* Category Icon */}
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CategoryIcon className="h-4 w-4 text-blue-600" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className={cn(
                            'font-medium',
                            suggestion.completed ? 'text-green-800' : 'text-gray-900'
                          )}>
                            {suggestion.field.charAt(0).toUpperCase() + suggestion.field.slice(1)} Optimization
                          </h4>
                          <p className={cn(
                            'text-sm',
                            suggestion.completed ? 'text-green-700' : 'text-gray-600'
                          )}>
                            {suggestion.suggestion}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant="outline" 
                            className={priorityColors[suggestion.priority]}
                          >
                            {suggestion.priority}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={difficultyColors[suggestion.difficulty]}
                          >
                            {suggestion.difficulty}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>+{suggestion.impact}% impact</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{suggestion.timeEstimate}</span>
                          </div>
                          {suggestion.aiGenerated && (
                            <>
                              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                <Star className="h-3 w-3 mr-1" />
                                AI Generated
                              </Badge>
                              {(suggestion as any).expectedImpact && (
                                <div className="text-xs text-green-600 font-medium">
                                  Expected: {(suggestion as any).expectedImpact}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {!suggestion.completed && (
                            <>
                              {enableAI && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => generateAISuggestion(suggestion.field)}
                                >
                                  <Star className="h-3 w-3 mr-1" />
                                  AI Help
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markSuggestionComplete(suggestion.id)}
                              >
                                Mark Complete
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Learn More
                          </Button>
                        </div>
                      </div>

                      {/* Compliance Notes */}
                      {suggestion.complianceNotes && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                          <div className="flex items-start space-x-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>LinkedIn Compliance: {suggestion.complianceNotes}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSuggestions.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  All suggestions completed!
                </h3>
                <p className="text-gray-600 mb-4">
                  Great job! You've completed all optimization suggestions for this category.
                </p>
                <Button onClick={fetchOptimizationData} variant="outline">
                  Check for New Suggestions
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileOptimizationSuggestions;