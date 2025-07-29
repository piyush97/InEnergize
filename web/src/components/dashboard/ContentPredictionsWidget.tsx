import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText,
  Video,
  Image,
  MessageSquare,
  Clock,
  TrendingUp,
  Calendar,
  Tag,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentPerformancePrediction {
  contentType: 'article' | 'post' | 'video' | 'carousel';
  predictedEngagement: number;
  bestTimeToPost: string;
  recommendedTopics: string[];
  confidenceScore: number;
}

interface NetworkGrowthForecast {
  optimalConnectionTimes: Array<{
    dayOfWeek: string;
    hour: number;
    engagementMultiplier: number;
  }>;
  recommendedTargets: Array<{
    industry: string;
    connectionPotential: number;
    reasoning: string;
  }>;
  networkHealthScore: number;
}

interface ContentPredictionsWidgetProps {
  className?: string;
}

const ContentPredictionsWidget: React.FC<ContentPredictionsWidgetProps> = ({ className }) => {
  const [contentPredictions, setContentPredictions] = useState<ContentPerformancePrediction[]>([]);
  const [networkForecast, setNetworkForecast] = useState<NetworkGrowthForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContentPredictions();
  }, []);

  const fetchContentPredictions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const [contentRes, networkRes] = await Promise.all([
        fetch('/api/v1/predictions/content', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/v1/predictions/network', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [contentData, networkData] = await Promise.all([
        contentRes.json(),
        networkRes.json()
      ]);

      if (contentData.success) setContentPredictions(contentData.data);
      if (networkData.success) setNetworkForecast(networkData.data);

      setError(null);
    } catch (err) {
      console.error('Failed to fetch content predictions:', err);
      setError('Failed to load content predictions');
    } finally {
      setLoading(false);
    }
  };

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'article': return <FileText className="h-5 w-5 text-blue-500" />;
      case 'post': return <MessageSquare className="h-5 w-5 text-green-500" />;
      case 'video': return <Video className="h-5 w-5 text-red-500" />;
      case 'carousel': return <Image className="h-5 w-5 text-purple-500" />;
      default: return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'article': return 'bg-blue-50 border-blue-200';
      case 'post': return 'bg-green-50 border-green-200';
      case 'video': return 'bg-red-50 border-red-200';
      case 'carousel': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const formatContentType = (contentType: string): string => {
    return contentType.charAt(0).toUpperCase() + contentType.slice(1);
  };

  const getHealthScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreBg = (score: number): string => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Content & Network Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg p-4 h-40"></div>
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
            <TrendingUp className="h-5 w-5" />
            <span>Content & Network Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchContentPredictions}
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
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Content & Network Insights</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Content Performance Predictions */}
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
            <Star className="h-4 w-4" />
            <span>Content Performance Predictions</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contentPredictions.map((prediction, index) => (
              <Card key={index} className={cn("border-2", getContentTypeColor(prediction.contentType))}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getContentTypeIcon(prediction.contentType)}
                      <span className="font-medium">{formatContentType(prediction.contentType)}</span>
                    </div>
                    <Badge variant="outline">
                      {(prediction.confidenceScore * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Predicted Engagement</span>
                        <span className="font-bold text-lg">{prediction.predictedEngagement}</span>
                      </div>
                      <Progress value={prediction.confidenceScore * 100} className="h-2" />
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Best time: <strong>{prediction.bestTimeToPost}</strong></span>
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                        <Tag className="h-4 w-4" />
                        <span>Recommended topics:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {prediction.recommendedTopics.slice(0, 3).map((topic, topicIndex) => (
                          <Badge key={topicIndex} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Network Growth Forecast */}
        {networkForecast && (
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Network Growth Insights</span>
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Network Health Score */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">Network Health Score</span>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-sm font-bold",
                      getHealthScoreBg(networkForecast.networkHealthScore),
                      getHealthScoreColor(networkForecast.networkHealthScore)
                    )}>
                      {networkForecast.networkHealthScore}/100
                    </div>
                  </div>
                  <Progress value={networkForecast.networkHealthScore} className="h-3" />
                  <p className="text-xs text-gray-500 mt-2">
                    {networkForecast.networkHealthScore >= 80 ? 'Excellent network health' :
                     networkForecast.networkHealthScore >= 60 ? 'Good network health' :
                     'Network needs attention'}
                  </p>
                </CardContent>
              </Card>

              {/* Optimal Connection Times */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3">Best Times to Connect</h4>
                  <div className="space-y-2">
                    {networkForecast.optimalConnectionTimes.slice(0, 3).map((time, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{time.dayOfWeek} at {time.hour}:00</span>
                        <Badge variant="outline" className="text-xs">
                          {time.engagementMultiplier.toFixed(1)}x better
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recommended Industries */}
            <Card className="mt-4">
              <CardContent className="p-4">
                <h4 className="font-medium mb-3">Recommended Industries to Target</h4>
                <div className="space-y-3">
                  {networkForecast.recommendedTargets.map((target, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{target.industry}</span>
                          <Badge className="bg-blue-100 text-blue-800">
                            {target.connectionPotential}% potential
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{target.reasoning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContentPredictionsWidget;