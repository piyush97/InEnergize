// ProfileCompletenessChart.tsx - Detailed LinkedIn Profile Completeness Visualization
// Displays comprehensive breakdown of profile completeness scores with recommendations
// Integrates with backend completeness service for real-time scoring

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  User,
  Briefcase,
  GraduationCap,
  Award,
  Users,
  FileText,
  Camera,
  Globe,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Target,
  Lightbulb,
  ExternalLink
} from 'lucide-react';

// Types matching backend completeness service
interface ProfileCompleteness {
  score: number;
  breakdown: {
    basicInfo: number;
    headline: number;
    summary: number;
    experience: number;
    education: number;
    skills: number;
    profilePicture: number;
    connections: number;
    certifications: number;
    languages: number;
    projects: number;
    volunteerWork: number;
    recommendations: number;
    customUrl: number;
  };
  suggestions: string[];
  missingFields: string[];
  priorityImprovements: Array<{
    field: string;
    impact: number;
    difficulty: 'easy' | 'medium' | 'hard';
    timeEstimate: string;
    suggestion: string;
  }>;
}

interface IndustryBenchmarks {
  averageScore: number;
  topPercentileScore: number;
  commonWeaknesses: string[];
  industrySpecificTips: string[];
}

interface ProfileCompletenessChartProps {
  className?: string;
  showDetailed?: boolean;
  enableRecommendations?: boolean;
}

const ProfileCompletenessChart: React.FC<ProfileCompletenessChartProps> = ({
  className,
  showDetailed = true,
  enableRecommendations = true
}) => {
  const [completeness, setCompleteness] = useState<ProfileCompleteness | null>(null);
  const [benchmarks, setBenchmarks] = useState<IndustryBenchmarks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Section configuration with icons, weights, and display info
  const sectionConfig = {
    basicInfo: { 
      icon: User, 
      label: 'Basic Info', 
      weight: 12, 
      color: 'bg-blue-500',
      description: 'Name, location, industry'
    },
    headline: { 
      icon: FileText, 
      label: 'Headline', 
      weight: 12, 
      color: 'bg-green-500',
      description: 'Professional headline'
    },
    summary: { 
      icon: MessageSquare, 
      label: 'Summary', 
      weight: 18, 
      color: 'bg-purple-500',
      description: 'About section'
    },
    experience: { 
      icon: Briefcase, 
      label: 'Experience', 
      weight: 18, 
      color: 'bg-orange-500',
      description: 'Work history'
    },
    education: { 
      icon: GraduationCap, 
      label: 'Education', 
      weight: 8, 
      color: 'bg-indigo-500',
      description: 'Educational background'
    },
    skills: { 
      icon: Target, 
      label: 'Skills', 
      weight: 8, 
      color: 'bg-cyan-500',
      description: 'Skills and endorsements'
    },
    profilePicture: { 
      icon: Camera, 
      label: 'Profile Picture', 
      weight: 4, 
      color: 'bg-pink-500',
      description: 'Professional photo'
    },
    connections: { 
      icon: Users, 
      label: 'Connections', 
      weight: 4, 
      color: 'bg-yellow-500',
      description: 'Network size'
    },
    certifications: { 
      icon: Award, 
      label: 'Certifications', 
      weight: 5, 
      color: 'bg-emerald-500',
      description: 'Professional certifications'
    },
    languages: { 
      icon: Globe, 
      label: 'Languages', 
      weight: 3, 
      color: 'bg-teal-500',
      description: 'Languages spoken'
    },
    projects: { 
      icon: Lightbulb, 
      label: 'Projects', 
      weight: 4, 
      color: 'bg-violet-500',
      description: 'Portfolio projects'
    },
    volunteerWork: { 
      icon: Users, 
      label: 'Volunteer Work', 
      weight: 2, 
      color: 'bg-rose-500',
      description: 'Volunteer experience'
    },
    recommendations: { 
      icon: MessageSquare, 
      label: 'Recommendations', 
      weight: 3, 
      color: 'bg-lime-500',
      description: 'Given/received recommendations'
    },
    customUrl: { 
      icon: ExternalLink, 
      label: 'Custom URL', 
      weight: 3, 
      color: 'bg-slate-500',
      description: 'Custom LinkedIn URL'
    }
  };

  useEffect(() => {
    fetchCompletenessData();
    // Refresh data every 2 minutes
    const interval = setInterval(fetchCompletenessData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchCompletenessData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      // Fetch completeness score
      const completenessResponse = await fetch('/api/v1/linkedin/profile/completeness', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!completenessResponse.ok) {
        throw new Error('Failed to fetch completeness data');
      }

      const completenessData = await completenessResponse.json();
      setCompleteness(completenessData.data);

      // Fetch industry benchmarks
      const benchmarksResponse = await fetch('/api/v1/linkedin/profile/benchmarks', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (benchmarksResponse.ok) {
        const benchmarksData = await benchmarksResponse.json();
        setBenchmarks(benchmarksData.data);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Needs Work';
    return 'Poor';
  };

  const getDifficultyBadge = (difficulty: 'easy' | 'medium' | 'hard') => {
    const variants = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    };
    return (
      <Badge variant="secondary" className={variants[difficulty]}>
        {difficulty}
      </Badge>
    );
  };

  const handleSectionClick = (sectionKey: string) => {
    setSelectedCategory(selectedCategory === sectionKey ? null : sectionKey);
  };

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Profile Completeness</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !completeness) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span>Profile Completeness</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {error || 'Unable to load completeness data'}
            </p>
            <Button onClick={fetchCompletenessData} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallScore = completeness.score;
  const breakdown = completeness.breakdown;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Overall Score Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Profile Completeness</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={cn('text-2xl font-bold', getScoreColor(overallScore))}>
                {overallScore}%
              </span>
              <Badge variant="secondary" className={getScoreColor(overallScore)}>
                {getScoreLabel(overallScore)}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={overallScore} className="w-full h-3" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Industry Comparison */}
            {benchmarks && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-600">Your Score</div>
                  <div className={cn('text-lg font-bold', getScoreColor(overallScore))}>
                    {overallScore}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Industry Average</div>
                  <div className="text-lg font-bold text-gray-700">
                    {benchmarks.averageScore}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Top 10%</div>
                  <div className="text-lg font-bold text-blue-600">
                    {benchmarks.topPercentileScore}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      {showDetailed && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Detailed Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(sectionConfig).map(([key, config]) => {
                const score = breakdown[key as keyof typeof breakdown] || 0;
                const maxScore = config.weight;
                const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
                const Icon = config.icon;

                return (
                  <div
                    key={key}
                    className={cn(
                      'p-4 border rounded-lg cursor-pointer transition-all duration-200',
                      selectedCategory === key 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                    onClick={() => handleSectionClick(key)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={cn('p-1 rounded text-white', config.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{config.label}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          {score}/{maxScore}
                        </div>
                        <div className={cn('text-xs', getScoreColor(percentage))}>
                          {Math.round(percentage)}%
                        </div>
                      </div>
                    </div>
                    
                    <Progress value={percentage} className="h-2 mb-2" />
                    
                    <div className="text-xs text-gray-600">
                      {config.description}
                    </div>

                    {selectedCategory === key && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-700">
                          Impact Weight: {config.weight}% of total score
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority Improvements */}
      {enableRecommendations && completeness.priorityImprovements.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Priority Improvements</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completeness.priorityImprovements.slice(0, 5).map((improvement, index) => {
                const config = sectionConfig[improvement.field as keyof typeof sectionConfig];
                const Icon = config?.icon || Target;

                return (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={cn('p-2 rounded-full text-white', config?.color || 'bg-gray-500')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          {config?.label || improvement.field}
                        </h4>
                        <div className="flex items-center space-x-2">
                          {getDifficultyBadge(improvement.difficulty)}
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>{improvement.timeEstimate}</span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600">
                        {improvement.suggestion}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-green-600 font-medium">
                          +{improvement.impact}% impact
                        </div>
                        <Button size="sm" variant="outline">
                          Start Improvement
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {completeness.priorityImprovements.length > 5 && (
              <div className="mt-4 text-center">
                <Button variant="outline">
                  View All {completeness.priorityImprovements.length} Recommendations
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Tips */}
      {benchmarks && benchmarks.industrySpecificTips.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5" />
              <span>Industry-Specific Tips</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {benchmarks.industrySpecificTips.map((tip, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg"
                >
                  <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-blue-800">{tip}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfileCompletenessChart;