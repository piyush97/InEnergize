// ContentGenerationStudio.tsx - AI-Powered LinkedIn Content Creation Interface
// Comprehensive content generation studio with multiple AI models and optimization features

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { 
  Sparkles, 
  FileText, 
  Calendar,
  Wand2,
  RefreshCw,
  Copy,
  ThumbsUp,
  MessageSquare,
  Eye,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  Save,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Content generation types
interface ContentTemplate {
  id: string;
  name: string;
  category: 'post' | 'article' | 'carousel' | 'video_script' | 'newsletter';
  description: string;
  prompt: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedLength: string;
  engagement: 'high' | 'medium' | 'low';
}

interface GenerationSettings {
  model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude' | 'custom';
  tone: 'professional' | 'casual' | 'authoritative' | 'friendly' | 'humorous' | 'inspirational';
  length: 'short' | 'medium' | 'long';
  audience: 'executives' | 'professionals' | 'students' | 'entrepreneurs' | 'general';
  industry: string;
  keywords: string[];
  includeHashtags: boolean;
  includeEmojis: boolean;
  includeCallToAction: boolean;
}

interface GeneratedContent {
  id: string;
  type: string;
  content: string;
  title?: string;
  hashtags: string[];
  estimatedEngagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  optimizationScore: number;
  suggestions: string[];
  createdAt: Date;
  model: string;
  settings: GenerationSettings;
}

interface ContentGenerationStudioProps {
  className?: string;
}

const ContentGenerationStudio: React.FC<ContentGenerationStudioProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [currentContent, setCurrentContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  const [settings, setSettings] = useState<GenerationSettings>({
    model: 'gpt-4',
    tone: 'professional',
    length: 'medium',
    audience: 'professionals',
    industry: 'Technology',
    keywords: [],
    includeHashtags: true,
    includeEmojis: false,
    includeCallToAction: true
  });

  const contentTemplates: ContentTemplate[] = [
    {
      id: 'thought-leadership',
      name: 'Thought Leadership Post',
      category: 'post',
      description: 'Share industry insights and establish authority',
      prompt: 'Write a thought-provoking LinkedIn post about current industry trends, challenges, and opportunities.',
      tags: ['leadership', 'insights', 'trends'],
      difficulty: 'advanced',
      estimatedLength: '150-300 words',
      engagement: 'high'
    },
    {
      id: 'company-update',
      name: 'Company Update',
      category: 'post',
      description: 'Share company news, achievements, or milestones',
      prompt: 'Create an engaging LinkedIn post about company news or achievements.',
      tags: ['company', 'news', 'achievements'],
      difficulty: 'beginner',
      estimatedLength: '100-200 words',
      engagement: 'medium'
    },
    {
      id: 'personal-story',
      name: 'Personal Story',
      category: 'post',
      description: 'Share personal experiences and lessons learned',
      prompt: 'Write a personal LinkedIn story that shares valuable lessons and connects with your audience.',
      tags: ['personal', 'story', 'lessons'],
      difficulty: 'intermediate',
      estimatedLength: '200-400 words',
      engagement: 'high'
    },
    {
      id: 'industry-analysis',
      name: 'Industry Analysis',
      category: 'article',
      description: 'Deep dive into industry trends and analysis',
      prompt: 'Create a comprehensive industry analysis article with data-driven insights.',
      tags: ['analysis', 'industry', 'data'],
      difficulty: 'advanced',
      estimatedLength: '800-1500 words',
      engagement: 'medium'
    },
    {
      id: 'how-to-guide',
      name: 'How-To Guide',
      category: 'carousel',
      description: 'Step-by-step guide in carousel format',
      prompt: 'Create a practical how-to guide broken down into carousel slides.',
      tags: ['guide', 'tutorial', 'practical'],
      difficulty: 'intermediate',
      estimatedLength: '5-10 slides',
      engagement: 'high'
    },
    {
      id: 'video-script',
      name: 'Video Script',
      category: 'video_script',
      description: 'Engaging script for LinkedIn video content',
      prompt: 'Write an engaging video script for LinkedIn that captures attention in the first 3 seconds.',
      tags: ['video', 'script', 'engaging'],
      difficulty: 'intermediate',
      estimatedLength: '30-90 seconds',
      engagement: 'high'
    }
  ];

  const generateContent = async () => {
    setLoading(true);
    setError(null);
    setGenerationProgress(0);
    
    try {
      const prompt = selectedTemplate ? 
        `${selectedTemplate.prompt}\n\nAdditional context: ${customPrompt}` : 
        customPrompt;

      if (!prompt.trim()) {
        throw new Error('Please provide a prompt or select a template');
      }

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/ai/generate-content', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          settings,
          template: selectedTemplate?.id
        })
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate content');
      }

      const data = await response.json();
      
      // Simulate generated content (replace with actual API response)
      const mockContent: GeneratedContent = {
        id: `content_${Date.now()}`,
        type: selectedTemplate?.category || 'post',
        content: data.content || generateMockContent(),
        title: data.title,
        hashtags: data.hashtags || generateHashtags(),
        estimatedEngagement: {
          likes: Math.floor(Math.random() * 500) + 50,
          comments: Math.floor(Math.random() * 50) + 5,
          shares: Math.floor(Math.random() * 25) + 2,
          views: Math.floor(Math.random() * 5000) + 500
        },
        optimizationScore: Math.floor(Math.random() * 30) + 70,
        suggestions: generateOptimizationSuggestions(),
        createdAt: new Date(),
        model: settings.model,
        settings: { ...settings }
      };

      setGeneratedContent(prev => [mockContent, ...prev]);
      setCurrentContent(mockContent);
      setActiveTab('review');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setLoading(false);
      setGenerationProgress(0);
    }
  };

  const generateMockContent = (): string => {
    const contents = [
      "🚀 The future of AI in business is here, and it's transformative.\n\nAfter working with enterprise clients for the past year, I've seen how AI isn't just changing individual tasks—it's reshaping entire business models.\n\nKey insights I've observed:\n• Automation isn't replacing humans; it's elevating human potential\n• Companies that embrace AI transparency build stronger customer trust\n• The most successful AI implementations start small and scale strategically\n\nWhat's your experience with AI in your industry? I'd love to hear your thoughts in the comments.\n\n#AI #Innovation #BusinessTransformation #FutureOfWork",
      
      "💡 Lessons learned from my biggest career mistake:\n\nEarly in my career, I said 'yes' to everything. I thought it would accelerate my growth.\n\nThe result? Burnout, decreased quality, and missed opportunities to truly excel.\n\nHere's what I learned about the power of strategic 'no':\n\n1. Saying no to good opportunities creates space for great ones\n2. Focus beats multitasking every time\n3. Your boundaries teach others how to value your time\n\nNow I ask: 'Does this align with my core goals?'\n\nIt's changed everything.\n\nWhat's the best 'no' you've ever said?",
      
      "📊 Data doesn't lie: Remote work productivity is UP 23% in our latest study.\n\nBut here's what the numbers don't tell you...\n\nThe secret isn't just flexible schedules or eliminating commutes.\n\nIt's about three critical factors:\n\n🎯 Clear objectives over micromanagement\n🤝 Intentional communication practices\n🏠 Proper home office setups\n\nCompanies that excel at remote work invest in these fundamentals.\n\nWhat's made the biggest difference in your remote work experience?"
    ];
    
    return contents[Math.floor(Math.random() * contents.length)];
  };

  const generateHashtags = (): string[] => {
    const hashtags = [
      '#LinkedIn', '#Professional', '#Career', '#Business', '#Innovation',
      '#Leadership', '#Technology', '#Networking', '#Growth', '#Success',
      '#Productivity', '#WorkLife', '#Industry', '#Strategy', '#Future'
    ];
    
    const count = Math.floor(Math.random() * 5) + 3;
    return hashtags.sort(() => 0.5 - Math.random()).slice(0, count);
  };

  const generateOptimizationSuggestions = (): string[] => {
    const suggestions = [
      'Consider adding a question to increase engagement',
      'Include more industry-specific keywords',
      'Add a call-to-action to drive comments',
      'Consider breaking long sentences into shorter ones',
      'Add relevant emojis to improve readability',
      'Include a personal story element',
      'Add data or statistics to support your points',
      'Consider using bullet points for better formatting'
    ];
    
    const count = Math.floor(Math.random() * 3) + 2;
    return suggestions.sort(() => 0.5 - Math.random()).slice(0, count);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const saveContent = (content: GeneratedContent) => {
    // Implement save functionality
    console.log('Saving content:', content);
  };

  const schedulePost = (content: GeneratedContent) => {
    // Implement scheduling functionality
    console.log('Scheduling post:', content);
  };

  return (
    <div className={cn('w-full max-w-7xl mx-auto space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            <span>AI Content Generation Studio</span>
            <Badge variant="secondary">Beta</Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="w-full">
            <div className="flex space-x-2 mb-6 border-b">
              {['create', 'review', 'optimize', 'schedule'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 capitalize ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Create Tab */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                {/* Template Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Choose a Template</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {contentTemplates.map((template) => (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className={cn(
                            'p-4 border rounded-lg cursor-pointer transition-all duration-200',
                            selectedTemplate?.id === template.id
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium">{template.name}</h3>
                              <Badge 
                                variant={template.engagement === 'high' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {template.engagement}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{template.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {template.tags.map(tag => (
                                <span 
                                  key={tag}
                                  className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="text-xs text-gray-500">
                              {template.estimatedLength} • {template.difficulty}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Prompt */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Custom Prompt</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <textarea
                      placeholder="Describe what you want to create, or add additional context to the selected template..."
                      value={customPrompt}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomPrompt(e.target.value)}
                      rows={4}
                      className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    
                    {/* Generation Settings */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium">Model</label>
                        <Select value={settings.model} onValueChange={(value: 'gpt-4' | 'gpt-3.5-turbo' | 'claude' | 'custom') => 
                          setSettings(prev => ({ ...prev, model: value }))
                        }>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                            <SelectItem value="claude">Claude</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Tone</label>
                        <Select value={settings.tone} onValueChange={(value: 'professional' | 'casual' | 'authoritative' | 'friendly' | 'humorous' | 'inspirational') => 
                          setSettings(prev => ({ ...prev, tone: value }))
                        }>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="authoritative">Authoritative</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="inspirational">Inspirational</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Length</label>
                        <Select value={settings.length} onValueChange={(value: 'short' | 'medium' | 'long') => 
                          setSettings(prev => ({ ...prev, length: value }))
                        }>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">Short</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="long">Long</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Audience</label>
                        <Select value={settings.audience} onValueChange={(value: 'executives' | 'professionals' | 'students' | 'entrepreneurs' | 'general') => 
                          setSettings(prev => ({ ...prev, audience: value }))
                        }>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="executives">Executives</SelectItem>
                            <SelectItem value="professionals">Professionals</SelectItem>
                            <SelectItem value="students">Students</SelectItem>
                            <SelectItem value="entrepreneurs">Entrepreneurs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {selectedTemplate ? 
                          `Using template: ${selectedTemplate.name}` : 
                          'Using custom prompt only'
                        }
                      </div>
                      <Button
                        onClick={generateContent}
                        disabled={loading || (!selectedTemplate && !customPrompt.trim())}
                        className="flex items-center space-x-2"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4" />
                            <span>Generate Content</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Progress Bar */}
                    {loading && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Generating content...</span>
                          <span>{generationProgress}%</span>
                        </div>
                        <Progress value={generationProgress} className="h-2" />
                      </div>
                    )}

                    {/* Error Display */}
                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Review Tab */}
            {activeTab === 'review' && (
              <div className="space-y-6">
                {currentContent ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Content Preview */}
                    <div className="lg:col-span-2">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Generated Content</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              {currentContent.model}
                            </Badge>
                            <Badge 
                              variant={currentContent.optimizationScore >= 80 ? 'default' : 'secondary'}
                            >
                              {currentContent.optimizationScore}% Optimized
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <div className="whitespace-pre-wrap text-sm">
                            {currentContent.content}
                          </div>
                          {currentContent.hashtags.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <div className="flex flex-wrap gap-1">
                                {currentContent.hashtags.map(hashtag => (
                                  <span 
                                    key={hashtag}
                                    className="text-blue-600 text-sm hover:underline cursor-pointer"
                                  >
                                    {hashtag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => copyToClipboard(currentContent.content)}
                            variant="outline"
                            size="sm"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                          <Button
                            onClick={() => saveContent(currentContent)}
                            variant="outline"
                            size="sm"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            onClick={() => schedulePost(currentContent)}
                            variant="outline"
                            size="sm"
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Schedule
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Analytics & Suggestions */}
                  <div className="space-y-6">
                    {/* Estimated Engagement */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Estimated Engagement</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {currentContent.estimatedEngagement.likes}
                            </div>
                            <div className="text-xs text-gray-600 flex items-center justify-center">
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              Likes
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {currentContent.estimatedEngagement.comments}
                            </div>
                            <div className="text-xs text-gray-600 flex items-center justify-center">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Comments
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {currentContent.estimatedEngagement.shares}
                            </div>
                            <div className="text-xs text-gray-600 flex items-center justify-center">
                              <Share2 className="h-3 w-3 mr-1" />
                              Shares
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                              {currentContent.estimatedEngagement.views}
                            </div>
                            <div className="text-xs text-gray-600 flex items-center justify-center">
                              <Eye className="h-3 w-3 mr-1" />
                              Views
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Optimization Suggestions */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Optimization Tips</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {currentContent.suggestions.map((suggestion, index) => (
                            <div key={index} className="flex items-start space-x-2">
                              <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                              <p className="text-sm text-gray-700">{suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Content Generated
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Generate content in the Create tab to review it here.
                    </p>
                    <Button onClick={() => setActiveTab('create')}>
                      Go to Create
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Optimize Tab */}
            {activeTab === 'optimize' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Content Optimization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Optimization Tools Coming Soon
                      </h3>
                      <p className="text-gray-600">
                        Advanced optimization features including A/B testing, 
                        sentiment analysis, and engagement prediction.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Content Scheduling</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Scheduling Feature Coming Soon
                      </h3>
                      <p className="text-gray-600">
                        Schedule your content for optimal posting times with 
                        our intelligent scheduling system.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Content History */}
      {generatedContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generatedContent.slice(0, 5).map((content) => (
                <div
                  key={content.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setCurrentContent(content);
                    setActiveTab('review');
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {content.content.substring(0, 100)}...
                      </p>
                      <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                        <span>{content.model}</span>
                        <span>•</span>
                        <span>{content.optimizationScore}% optimized</span>
                        <span>•</span>
                        <span>{content.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContentGenerationStudio;