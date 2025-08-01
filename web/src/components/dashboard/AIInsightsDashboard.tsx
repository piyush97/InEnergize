'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Brain,
  TrendingUp,
  Target,
  Lightbulb,
  BarChart3,
  Users,
  Award,
  Zap,
  Eye,
  MessageSquare,
  FileText,
  RefreshCw,
  Download,
  Share2,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Star,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Activity,
  PieChart,
  TrendingDown,
  Calendar,
  BookOpen,
  Briefcase
} from 'lucide-react';

// AI Insights Types
interface AIInsight {
  id: string;
  type: 'prediction' | 'recommendation' | 'opportunity' | 'warning' | 'trend';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  category: 'profile' | 'content' | 'networking' | 'engagement' | 'career';
  actionable: boolean;
  estimatedTimeToImplement: string;
  potentialImprovement: number;
  data?: any;
  createdAt: Date;
  expiresAt?: Date;
}

interface IndustryBenchmark {
  metric: string;
  userValue: number;
  industryAverage: number;
  topPercentile: number;
  percentileRank: number;
  trend: 'improving' | 'declining' | 'stable';
  recommendation: string;
  icon: React.ElementType;
}

interface PredictionModel {
  id: string;
  name: string;
  description: string;
  accuracy: number;
  lastUpdated: Date;
  predictions: {
    metric: string;
    currentValue: number;
    predictedValue: number;
    timeframe: string;
    confidence: number;
    factors: string[];
  }[];
}

interface AIInsightsDashboardProps {
  userId: string;
  profileData: any;
  className?: string;
  enableRealTimeUpdates?: boolean;
  showAdvancedMetrics?: boolean;
  onInsightAction?: (insightId: string, action: string) => void;
}

const AIInsightsDashboard: React.FC<AIInsightsDashboardProps> = ({
  userId,
  profileData,
  className,
  enableRealTimeUpdates = true,
  showAdvancedMetrics = false,
  onInsightAction
}) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [benchmarks, setBenchmarks] = useState<IndustryBenchmark[]>([]);
  const [predictions, setPredictions] = useState<PredictionModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  // Sample AI insights with realistic data
  const sampleInsights: AIInsight[] = [
    {
      id: 'insight-1',
      type: 'prediction',
      title: 'Profile Views Will Increase by 35%',
      description: 'Based on your recent activity and content engagement patterns, your profile views are predicted to increase significantly over the next 30 days.',
      confidence: 87,
      impact: 'high',
      category: 'profile',
      actionable: true,
      estimatedTimeToImplement: '15 minutes',
      potentialImprovement: 35,
      data: {
        currentViews: 142,
        predictedViews: 192,
        factors: ['Recent post engagement', 'Skill endorsements', 'Network growth']
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'insight-2',
      type: 'recommendation',
      title: 'Optimize Headline for Better Visibility',
      description: 'Your current headline could be improved to include industry keywords that are trending in your field. This could increase your searchability by up to 40%.',
      confidence: 92,
      impact: 'high',
      category: 'profile',
      actionable: true,
      estimatedTimeToImplement: '10 minutes',
      potentialImprovement: 40,
      data: {
        currentHeadline: 'Software Developer',
        suggestedKeywords: ['Full-Stack', 'React', 'Node.js', 'TypeScript'],
        searchVolumeIncrease: 40
      },
      createdAt: new Date(),
    },
    {
      id: 'insight-3',
      type: 'opportunity',
      title: 'Connect with Industry Leaders',
      description: 'There are 12 influential professionals in your industry who frequently engage with content similar to yours. Connecting with them could expand your reach.',
      confidence: 78,
      impact: 'medium',
      category: 'networking',
      actionable: true,
      estimatedTimeToImplement: '30 minutes',
      potentialImprovement: 25,
      data: {
        suggestedConnections: 12,
        averageFollowers: 5000,
        commonInterests: ['AI', 'Software Development', 'Startups']
      },
      createdAt: new Date(),
    },
    {
      id: 'insight-4',
      type: 'warning',
      title: 'Content Activity Below Optimal',
      description: 'Your posting frequency has decreased by 60% this month. Maintaining consistent content sharing is crucial for engagement.',
      confidence: 95,
      impact: 'medium',
      category: 'content',
      actionable: true,
      estimatedTimeToImplement: '20 minutes/day',
      potentialImprovement: 30,
      data: {
        currentFrequency: '2 posts/month',
        optimalFrequency: '2-3 posts/week',
        engagementDrop: 25
      },
      createdAt: new Date(),
    },
    {
      id: 'insight-5',
      type: 'trend',
      title: 'Your Skills Are in High Demand',
      description: 'Job postings requiring your skill set have increased by 45% in the last quarter. Consider highlighting these skills more prominently.',
      confidence: 89,
      impact: 'high',
      category: 'career',
      actionable: true,
      estimatedTimeToImplement: '25 minutes',
      potentialImprovement: 50,
      data: {
        trendingSkills: ['React', 'TypeScript', 'AWS', 'Machine Learning'],
        jobGrowth: 45,
        salaryIncrease: 12
      },
      createdAt: new Date(),
    }
  ];

  // Sample industry benchmarks
  const sampleBenchmarks: IndustryBenchmark[] = [
    {
      metric: 'Profile Completeness',
      userValue: 75,
      industryAverage: 68,
      topPercentile: 95,
      percentileRank: 72,
      trend: 'improving',
      recommendation: 'Add 2-3 more skills and get recommendations to reach top 10%',
      icon: Target
    },
    {
      metric: 'Network Size',
      userValue: 234,
      industryAverage: 310,
      topPercentile: 800,
      percentileRank: 45,
      trend: 'stable',
      recommendation: 'Connect with 5-10 professionals weekly to improve network reach',
      icon: Users
    },
    {
      metric: 'Content Engagement',
      userValue: 8.5,
      industryAverage: 6.2,
      topPercentile: 15.8,
      percentileRank: 78,
      trend: 'improving',
      recommendation: 'Great engagement! Consider posting more frequently to maximize reach',
      icon: MessageSquare
    },
    {
      metric: 'Profile Views',
      userValue: 142,
      industryAverage: 98,
      topPercentile: 350,
      percentileRank: 81,
      trend: 'improving',
      recommendation: 'Above average! Optimize keywords to reach top performers',
      icon: Eye
    }
  ];

  // Sample prediction models
  const samplePredictions: PredictionModel[] = [
    {
      id: 'model-1',
      name: 'Profile Growth Predictor',
      description: 'Predicts profile performance based on activity patterns and industry trends',
      accuracy: 87,
      lastUpdated: new Date(),
      predictions: [
        {
          metric: 'Profile Views',
          currentValue: 142,
          predictedValue: 192,
          timeframe: '30 days',
          confidence: 87,
          factors: ['Recent activity increase', 'Industry trend alignment', 'Network growth']
        },
        {
          metric: 'Connection Requests',
          currentValue: 8,
          predictedValue: 15,
          timeframe: '30 days',
          confidence: 82,
          factors: ['Profile optimization', 'Content engagement', 'Industry visibility']
        }
      ]
    },
    {
      id: 'model-2',
      name: 'Career Opportunity Analyzer',
      description: 'Identifies career opportunities based on skills and market demand',
      accuracy: 91,
      lastUpdated: new Date(),
      predictions: [
        {
          metric: 'Job Match Score',
          currentValue: 78,
          predictedValue: 89,
          timeframe: '60 days',
          confidence: 91,
          factors: ['Skill development', 'Industry growth', 'Network expansion']
        }
      ]
    }
  ];

  // Initialize data
  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setInsights(sampleInsights);
      setBenchmarks(sampleBenchmarks);
      setPredictions(samplePredictions);
      setLoading(false);
    };

    loadInsights();
  }, [userId]);

  // Refresh insights
  const refreshInsights = useCallback(async () => {
    setRefreshing(true);
    // Simulate API refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update timestamps and add variation
    const updatedInsights = sampleInsights.map(insight => ({
      ...insight,
      confidence: Math.max(70, Math.min(95, insight.confidence + Math.random() * 10 - 5)),
      createdAt: new Date()
    }));
    
    setInsights(updatedInsights);
    setRefreshing(false);
  }, []);

  // Filter insights by category
  const filteredInsights = useMemo(() => {
    if (selectedCategory === 'all') return insights;
    return insights.filter(insight => insight.category === selectedCategory);
  }, [insights, selectedCategory]);

  // Get insight type icon and color
  const getInsightTypeInfo = (type: AIInsight['type']) => {
    switch (type) {
      case 'prediction':
        return { icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50' };
      case 'recommendation':
        return { icon: Lightbulb, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      case 'opportunity':
        return { icon: Sparkles, color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'warning':
        return { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'trend':
        return { icon: Activity, color: 'text-purple-600', bgColor: 'bg-purple-50' };
      default:
        return { icon: Brain, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  // Get impact color
  const getImpactColor = (impact: AIInsight['impact']) => {
    switch (impact) {
      case 'critical': return 'text-red-700 bg-red-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-green-700 bg-green-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const categories = [
    { id: 'all', name: 'All Insights', icon: Brain },
    { id: 'profile', name: 'Profile', icon: Target },
    { id: 'content', name: 'Content', icon: FileText },
    { id: 'networking', name: 'Networking', icon: Users },
    { id: 'engagement', name: 'Engagement', icon: MessageSquare },
    { id: 'career', name: 'Career', icon: Briefcase }
  ];

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 mx-auto"
            >
              <Brain className="w-12 h-12 text-indigo-600" />
            </motion.div>
            <div className="text-lg font-medium text-gray-900">
              Analyzing your profile...
            </div>
            <div className="text-sm text-gray-600">
              Our AI is generating personalized insights
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Insights Dashboard</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Personalized recommendations powered by machine learning
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshInsights}
                disabled={refreshing}
                className="relative"
              >
                <RefreshCw className={cn(
                  "h-4 w-4 mr-2",
                  refreshing && "animate-spin"
                )} />
                Refresh
              </Button>
              
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center space-x-1"
            >
              <Icon className="h-4 w-4" />
              <span>{category.name}</span>
            </Button>
          );
        })}
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Insights</p>
                <p className="text-2xl font-bold text-gray-900">{insights.length}</p>
              </div>
              <Brain className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Impact</p>
                <p className="text-2xl font-bold text-orange-600">
                  {insights.filter(i => i.impact === 'high' || i.impact === 'critical').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round(insights.reduce((acc, i) => acc + i.confidence, 0) / insights.length)}%
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Quick Actions</p>
                <p className="text-2xl font-bold text-blue-600">
                  {insights.filter(i => i.actionable && i.estimatedTimeToImplement.includes('minute')).length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <span>AI-Powered Insights</span>
            <Badge variant="secondary">{filteredInsights.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence>
            {filteredInsights.map((insight, index) => {
              const typeInfo = getInsightTypeInfo(insight.type);
              const TypeIcon = typeInfo.icon;
              const isExpanded = expandedInsight === insight.id;
              
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "border rounded-lg p-4 cursor-pointer transition-all duration-200",
                    "hover:shadow-md hover:border-indigo-200",
                    isExpanded && "ring-2 ring-indigo-500 ring-opacity-50"
                  )}
                  onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        typeInfo.bgColor
                      )}>
                        <TypeIcon className={cn("h-5 w-5", typeInfo.color)} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {insight.title}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={cn("text-xs", getImpactColor(insight.impact))}
                          >
                            {insight.impact}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          {insight.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3" />
                            <span>{insight.confidence}% confidence</span>
                          </div>
                          
                          {insight.actionable && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{insight.estimatedTimeToImplement}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>+{insight.potentialImprovement}% potential</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Confidence</div>
                        <div className="w-16">
                          <Progress value={insight.confidence} className="h-2" />
                        </div>
                      </div>
                      
                      <ChevronRight className={cn(
                        "h-4 w-4 text-gray-400 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )} />
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 pt-4 border-t border-gray-200"
                      >
                        <div className="space-y-4">
                          {/* Additional Data */}
                          {insight.data && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <h4 className="font-medium text-gray-900 mb-2">Details</h4>
                              <div className="space-y-2 text-sm">
                                {Object.entries(insight.data).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-gray-600 capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      {Array.isArray(value) ? value.join(', ') : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Actions */}
                          {insight.actionable && (
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInsightAction?.(insight.id, 'implement');
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Implement
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInsightAction?.(insight.id, 'dismiss');
                                }}
                              >
                                Dismiss
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInsightAction?.(insight.id, 'share');
                                }}
                              >
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Industry Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span>Industry Benchmarks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {benchmarks.map((benchmark, index) => {
              const Icon = benchmark.icon;
              const isAboveAverage = benchmark.userValue > benchmark.industryAverage;
              
              return (
                <motion.div
                  key={benchmark.metric}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <h3 className="font-medium text-gray-900">{benchmark.metric}</h3>
                        <p className="text-sm text-gray-600">
                          {benchmark.percentileRank}th percentile
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {benchmark.trend === 'improving' ? (
                        <ArrowUp className="h-4 w-4 text-green-500" />
                      ) : benchmark.trend === 'declining' ? (
                        <ArrowDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      
                      <Badge
                        variant={isAboveAverage ? "default" : "secondary"}
                        className={cn(
                          isAboveAverage 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        )}
                      >
                        {isAboveAverage ? "Above Average" : "Below Average"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Your Value: {benchmark.userValue}</span>
                      <span>Industry Avg: {benchmark.industryAverage}</span>
                      <span>Top 10%: {benchmark.topPercentile}</span>
                    </div>
                    
                    <div className="relative">
                      <Progress value={benchmark.percentileRank} className="h-3" />
                      <div
                        className="absolute top-0 h-3 w-1 bg-red-500 rounded"
                        style={{ left: `${(benchmark.industryAverage / benchmark.topPercentile) * 100}%` }}
                      />
                    </div>
                    
                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                      <Lightbulb className="h-4 w-4 inline mr-1 text-blue-600" />
                      {benchmark.recommendation}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ML Predictions */}
      {showAdvancedMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-purple-500" />
              <span>ML Predictions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {predictions.map((model, index) => (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{model.name}</h3>
                      <p className="text-sm text-gray-600">{model.description}</p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Accuracy</div>
                      <div className="text-lg font-bold text-green-600">{model.accuracy}%</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {model.predictions.map((prediction, predIndex) => (
                      <div key={predIndex} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{prediction.metric}</h4>
                          <Badge variant="outline">
                            {prediction.confidence}% confidence
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Current:</span>
                            <div className="font-semibold">{prediction.currentValue}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Predicted:</span>
                            <div className="font-semibold text-blue-600">{prediction.predictedValue}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Timeframe:</span>
                            <div className="font-semibold">{prediction.timeframe}</div>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <div className="text-xs text-gray-600 mb-1">Key Factors:</div>
                          <div className="flex flex-wrap gap-1">
                            {prediction.factors.map((factor, factorIndex) => (
                              <Badge key={factorIndex} variant="secondary" className="text-xs">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIInsightsDashboard;