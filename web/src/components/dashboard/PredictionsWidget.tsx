import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Brain, 
  Calendar,
  Users,
  Eye,
  Search,
  MessageCircle,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PredictionResult {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidenceScore: number;
  timeframe: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
}

interface GrowthPrediction {
  userId: string;
  timeframe: '7d' | '30d' | '90d';
  predictions: {
    profileViews: PredictionResult;
    connections: PredictionResult;
    searchAppearances: PredictionResult;
    engagementRate: PredictionResult;
  };
  generatedAt: string;
}

interface OptimizationRecommendation {
  category: 'profile' | 'content' | 'engagement' | 'networking';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: 'immediate' | 'short_term' | 'long_term';
  metrics: string[];
}

interface BenchmarkPrediction {
  metric: string;
  currentValue: number;
  industryBenchmark: number;
  daysToReachBenchmark: number | null;
  probabilityOfReaching: number;
  requiredGrowthRate: number;
}

interface PredictionsWidgetProps {
  className?: string;
}

const PredictionsWidget: React.FC<PredictionsWidgetProps> = ({ className }) => {
  const [predictions, setPredictions] = useState<GrowthPrediction | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchPredictions();
  }, [timeframe]);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Fetch predictions in parallel
      const [predictionsRes, recommendationsRes, benchmarksRes] = await Promise.all([
        fetch(`/api/v1/predictions/growth?timeframe=${timeframe}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/v1/predictions/recommendations', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/v1/predictions/benchmarks', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [predictionsData, recommendationsData, benchmarksData] = await Promise.all([
        predictionsRes.json(),
        recommendationsRes.json(),
        benchmarksRes.json()
      ]);

      if (predictionsData.success) setPredictions(predictionsData.data);
      if (recommendationsData.success) setRecommendations(recommendationsData.data);
      if (benchmarksData.success) setBenchmarks(benchmarksData.data);

      setError(null);
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
      setError('Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'profile': return <Users className="h-4 w-4" />;
      case 'content': return <MessageCircle className="h-4 w-4" />;
      case 'engagement': return <Star className="h-4 w-4" />;
      case 'networking': return <Users className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'profileViews': return <Eye className="h-4 w-4" />;
      case 'connections': return <Users className="h-4 w-4" />;
      case 'searchAppearances': return <Search className="h-4 w-4" />;
      case 'engagementRate': return <MessageCircle className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const formatMetricName = (metric: string): string => {
    switch (metric) {
      case 'profile_views': return 'Profile Views';
      case 'connections_count': return 'Connections';
      case 'search_appearances': return 'Search Appearances';
      case 'engagement_rate': return 'Engagement Rate';
      default: return metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const PredictionCard: React.FC<{ 
    title: string; 
    prediction: PredictionResult; 
    icon: React.ReactNode;
  }> = ({ title, prediction, icon }) => (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {icon}
            <span className="font-medium text-sm">{title}</span>
          </div>
          <Badge 
            variant="outline"
            className={cn(
              prediction.trend === 'increasing' ? 'text-green-700 border-green-300' :
              prediction.trend === 'decreasing' ? 'text-red-700 border-red-300' :
              'text-gray-700 border-gray-300'
            )}
          >
            {prediction.trend === 'increasing' && <TrendingUp className="h-3 w-3 mr-1" />}
            {prediction.trend === 'decreasing' && <TrendingDown className="h-3 w-3 mr-1" />}
            {prediction.changePercent > 0 ? '+' : ''}{prediction.changePercent.toFixed(1)}%
          </Badge>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {prediction.predictedValue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">
              Current: {prediction.currentValue.toLocaleString()}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Confidence</span>
              <span>{(prediction.confidenceScore * 100).toFixed(0)}%</span>
            </div>
            <Progress value={prediction.confidenceScore * 100} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Predictions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg p-6 h-32"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Predictions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchPredictions}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
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
            <Brain className="h-5 w-5" />
            <span>AI Predictions</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as '7d' | '30d' | '90d')}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="predictions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="predictions">Growth</TabsTrigger>
            <TabsTrigger value="recommendations">Tips</TabsTrigger>
            <TabsTrigger value="benchmarks">Goals</TabsTrigger>
          </TabsList>
          
          <TabsContent value="predictions" className="space-y-4">
            {predictions && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PredictionCard
                  title="Profile Views"
                  prediction={predictions.predictions.profileViews}
                  icon={<Eye className="h-4 w-4 text-blue-500" />}
                />
                <PredictionCard
                  title="Connections"
                  prediction={predictions.predictions.connections}
                  icon={<Users className="h-4 w-4 text-purple-500" />}
                />
                <PredictionCard
                  title="Search Appearances"
                  prediction={predictions.predictions.searchAppearances}
                  icon={<Search className="h-4 w-4 text-green-500" />}
                />
                <PredictionCard
                  title="Engagement Rate"
                  prediction={predictions.predictions.engagementRate}
                  icon={<MessageCircle className="h-4 w-4 text-orange-500" />}
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="recommendations" className="space-y-4">
            {recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((rec, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getCategoryIcon(rec.category)}
                          <h4 className="font-medium">{rec.title}</h4>
                        </div>
                        <Badge className={getPriorityColor(rec.priority)}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-600 font-medium">{rec.expectedImpact}</span>
                        <div className="flex items-center space-x-1 text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{rec.implementation.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                <p>Great job! No immediate optimizations needed.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="benchmarks" className="space-y-4">
            {benchmarks.length > 0 ? (
              <div className="space-y-4">
                {benchmarks.map((benchmark, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getMetricIcon(benchmark.metric)}
                          <span className="font-medium">{formatMetricName(benchmark.metric)}</span>
                        </div>
                        <Badge variant="outline">
                          {(benchmark.probabilityOfReaching * 100).toFixed(0)}% likely
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Current: <strong>{benchmark.currentValue.toLocaleString()}</strong></span>
                          <span>Target: <strong>{benchmark.industryBenchmark.toLocaleString()}</strong></span>
                        </div>
                        
                        <Progress 
                          value={(benchmark.currentValue / benchmark.industryBenchmark) * 100} 
                          className="h-2" 
                        />
                        
                        <div className="flex justify-between text-xs text-gray-500">
                          {benchmark.daysToReachBenchmark ? (
                            <span>{benchmark.daysToReachBenchmark} days to reach</span>
                          ) : (
                            <span>Already reached!</span>
                          )}
                          <span>{benchmark.requiredGrowthRate.toFixed(1)}% daily growth needed</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-4" />
                <p>Benchmark data loading...</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PredictionsWidget;