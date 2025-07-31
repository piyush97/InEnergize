// ProfileOptimizationDashboard.tsx - Enhanced Profile Optimization Interface
// Comprehensive dashboard for LinkedIn profile optimization with AI assistance

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Target, 
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Eye,
  FileText,
  Zap,
  Brain,
  RefreshCw,
  Play,
  Wand2,
  BarChart3,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  Search,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import the existing ProfileOptimizationSuggestions component
import ProfileOptimizationSuggestions from '../dashboard/ProfileOptimizationSuggestions';

interface OptimizationMetrics {
  totalSuggestions: number;
  completedSuggestions: number;
  highPrioritySuggestions: number;
  estimatedImpact: number;
  profileScore: number;
  improvementPotential: number;
  lastUpdated: Date;
}

interface OptimizationTask {
  id: string;
  title: string;
  description: string;
  category: 'headline' | 'summary' | 'experience' | 'skills' | 'photo' | 'banner';
  priority: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // in minutes
  impact: number; // 1-10 scale
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  aiSuggestion?: string;
  currentValue?: string;
  suggestedValue?: string;
  tips: string[];
  examples: string[];
}

interface ProfileOptimizationDashboardProps {
  className?: string;
}

const ProfileOptimizationDashboard: React.FC<ProfileOptimizationDashboardProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<OptimizationMetrics | null>(null);
  const [tasks, setTasks] = useState<OptimizationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Mock data for development
  const mockMetrics: OptimizationMetrics = useMemo(() => ({
    totalSuggestions: 12,
    completedSuggestions: 4,
    highPrioritySuggestions: 3,
    estimatedImpact: 78,
    profileScore: 72,
    improvementPotential: 28,
    lastUpdated: new Date()
  }), []);

  const mockTasks: OptimizationTask[] = useMemo(() => [
    {
      id: 'headline-1',
      title: 'Optimize Professional Headline',
      description: 'Create a compelling headline that showcases your expertise and value proposition',
      category: 'headline',
      priority: 'high',
      difficulty: 'easy',
      estimatedTime: 15,
      impact: 9,
      status: 'pending',
      currentValue: 'Software Engineer at TechCorp',
      suggestedValue: 'Full-Stack Developer | React & Node.js Expert | Building Scalable Web Applications',
      tips: [
        'Include your key skills and technologies',
        'Mention your industry or specialization',
        'Add a value proposition or unique selling point',
        'Keep it under 220 characters'
      ],
      examples: [
        'Senior Frontend Developer | React & TypeScript Expert | Creating Exceptional User Experiences',
        'Product Manager | SaaS Growth Specialist | Driving 40% User Engagement Increases',
        'Data Scientist | ML Engineer | Transforming Business Data into Strategic Insights'
      ]
    },
    {
      id: 'summary-1',
      title: 'Enhance About Section',
      description: 'Write a compelling summary that tells your professional story',
      category: 'summary',
      priority: 'high',
      difficulty: 'medium',
      estimatedTime: 45,
      impact: 8,
      status: 'in_progress',
      currentValue: 'I am a software engineer with 3 years of experience.',
      tips: [
        'Start with a strong opening statement',
        'Include quantifiable achievements',
        'Mention your skills and expertise',
        'End with a call to action'
      ],
      examples: [
        'Passionate software engineer with 3+ years of experience building scalable web applications...',
        'Results-driven professional with a proven track record of delivering high-impact solutions...'
      ]
    },
    {
      id: 'photo-1',
      title: 'Update Professional Photo',
      description: 'Add a high-quality, professional headshot',
      category: 'photo',
      priority: 'medium',
      difficulty: 'easy',
      estimatedTime: 30,
      impact: 7,
      status: 'completed',
      tips: [
        'Use a high-resolution image (400x400px minimum)',
        'Face should take up 60% of the frame',
        'Maintain eye contact with the camera',
        'Use professional attire appropriate for your industry'
      ],
      examples: []
    },
    {
      id: 'skills-1',
      title: 'Add Relevant Skills',
      description: 'Include industry-relevant skills and get endorsements',
      category: 'skills',
      priority: 'medium',
      difficulty: 'easy',
      estimatedTime: 20,
      impact: 6,
      status: 'pending',
      tips: [
        'Add up to 50 skills',
        'Prioritize the most relevant skills',
        'Include both technical and soft skills',
        'Ask colleagues for endorsements'
      ],
      examples: []
    }
  ], []);

  useEffect(() => {
    fetchOptimizationData();
  }, []);

  const fetchOptimizationData = useCallback(async () => {
    try {
      setLoading(true);
      
      // For development, use mock data
      setMetrics(mockMetrics);
      setTasks(mockTasks);
      
      // TODO: Replace with actual API calls
      // const [metricsResponse, tasksResponse] = await Promise.all([
      //   fetch('/api/v1/linkedin/profile/optimization-metrics'),
      //   fetch('/api/v1/linkedin/profile/optimization-tasks')
      // ]);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load optimization data');
    } finally {
      setLoading(false);
    }
  }, [mockMetrics, mockTasks]);

  const generateAISuggestion = async (task: OptimizationTask) => {
    setAiGenerating(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/linkedin/profile/ai-suggestions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: task.category,
          currentValue: task.currentValue,
          context: {
            industry: 'Technology',
            experience: 'Mid-level',
            goals: 'Career advancement'
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update task with AI suggestion
        setTasks(prev => prev.map(t => 
          t.id === task.id 
            ? { ...t, aiSuggestion: data.suggestion, suggestedValue: data.optimizedValue }
            : t
        ));
      }
    } catch (err) {
      console.error('Failed to generate AI suggestion:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  const updateTaskStatus = (taskId: string, status: OptimizationTask['status']) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status } : task
    ));
    
    // Update metrics
    if (metrics) {
      const completedCount = tasks.filter(t => 
        t.id === taskId ? status === 'completed' : t.status === 'completed'
      ).length;
      
      setMetrics(prev => prev ? {
        ...prev,
        completedSuggestions: completedCount
      } : null);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = filter === 'all' || task.status === filter;
    const searchMatch = searchTerm === '' || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return statusMatch && searchMatch;
  });

  const getCategoryIcon = (category: OptimizationTask['category']) => {
    const icons = {
      headline: Target,
      summary: FileText,
      experience: Briefcase,
      skills: Star,
      photo: Users,
      banner: Eye
    };
    return icons[category] || Target;
  };

  const getPriorityColor = (priority: OptimizationTask['priority']) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority];
  };

  const getStatusColor = (status: OptimizationTask['status']) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      skipped: 'bg-gray-100 text-gray-600'
    };
    return colors[status];
  };

  if (loading) {
    return (
      <div className={cn('w-full max-w-7xl mx-auto space-y-6', className)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-6 w-6" />
              <span>Profile Optimization Dashboard</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-7xl mx-auto space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-6 w-6 text-blue-600" />
              <span>Profile Optimization Dashboard</span>
              <Badge variant="secondary">Beta</Badge>
            </div>
            <Button
              onClick={fetchOptimizationData}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Profile Score</p>
                  <p className="text-3xl font-bold text-blue-600">{metrics.profileScore}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
              <div className="mt-4">
                <Progress value={metrics.profileScore} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tasks Completed</p>
                  <p className="text-3xl font-bold text-green-600">
                    {metrics.completedSuggestions}/{metrics.totalSuggestions}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="mt-4">
                <Progress 
                  value={(metrics.completedSuggestions / metrics.totalSuggestions) * 100} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">High Priority</p>
                  <p className="text-3xl font-bold text-orange-600">{metrics.highPrioritySuggestions}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Potential Impact</p>
                  <p className="text-3xl font-bold text-purple-600">+{metrics.improvementPotential}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full">
        <div className="flex space-x-2 mb-6 border-b">
          {['overview', 'tasks', 'ai-assistant', 'analytics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <ProfileOptimizationSuggestions 
              maxSuggestions={6}
              showFilters={true}
              enableAI={true}
            />
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Optimization Tasks</CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Select value={filter} onValueChange={(value) => setFilter(value as 'all' | 'pending' | 'in_progress' | 'completed')}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tasks</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTasks.map((task) => {
                    const IconComponent = getCategoryIcon(task.category);
                    const isExpanded = expandedTask === task.id;
                    
                    return (
                      <Card key={task.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <IconComponent className="h-5 w-5 text-blue-600 mt-1" />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h3 className="font-medium">{task.title}</h3>
                                  <Badge 
                                    variant="outline" 
                                    className={getPriorityColor(task.priority)}
                                  >
                                    {task.priority}
                                  </Badge>
                                  <Badge className={getStatusColor(task.status)}>
                                    {task.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                                
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {task.estimatedTime} min
                                  </span>
                                  <span className="flex items-center">
                                    <Star className="h-3 w-3 mr-1" />
                                    Impact: {task.impact}/10
                                  </span>
                                  <span className="capitalize">{task.difficulty}</span>
                                </div>

                                {isExpanded && (
                                  <div className="mt-4 space-y-4">
                                    {task.currentValue && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Current Value:</h4>
                                        <div className="p-3 bg-gray-50 rounded border text-sm">
                                          {task.currentValue}
                                        </div>
                                      </div>
                                    )}

                                    {task.suggestedValue && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Suggested Improvement:</h4>
                                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                                          {task.suggestedValue}
                                        </div>
                                      </div>
                                    )}

                                    {task.tips.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Tips:</h4>
                                        <ul className="space-y-1 text-sm text-gray-600">
                                          {task.tips.map((tip, index) => (
                                            <li key={index} className="flex items-start">
                                              <span className="text-blue-500 mr-2">•</span>
                                              {tip}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {task.examples.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Examples:</h4>
                                        <div className="space-y-2">
                                          {task.examples.map((example, index) => (
                                            <div key={index} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                              {example}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              
                              {task.status === 'pending' && (
                                <Button
                                  size="sm"
                                  onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  Start
                                </Button>
                              )}
                              
                              {task.status === 'in_progress' && (
                                <Button
                                  size="sm"
                                  onClick={() => updateTaskStatus(task.id, 'completed')}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateAISuggestion(task)}
                                disabled={aiGenerating}
                              >
                                {aiGenerating ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Brain className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Assistant Tab */}
        {activeTab === 'ai-assistant' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <span>AI Optimization Assistant</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Wand2 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    AI Assistant Coming Soon
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Get personalized optimization suggestions powered by advanced AI analysis.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <div className="p-4 border rounded-lg">
                      <Brain className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                      <h4 className="font-medium mb-1">Smart Analysis</h4>
                      <p className="text-sm text-gray-600">AI-powered profile analysis and recommendations</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <Zap className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                      <h4 className="font-medium mb-1">Instant Optimization</h4>
                      <p className="text-sm text-gray-600">Real-time suggestions as you edit your profile</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <Target className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <h4 className="font-medium mb-1">Goal-Oriented</h4>
                      <p className="text-sm text-gray-600">Personalized advice based on your career goals</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <span>Optimization Analytics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Advanced Analytics Coming Soon
                  </h3>
                  <p className="text-gray-600">
                    Track your profile optimization progress with detailed analytics and insights.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileOptimizationDashboard;