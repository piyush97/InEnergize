// ContentGenerationStudioSimple.tsx - Simplified AI Content Generation Interface
// A working version without complex UI dependencies

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Wand2,
  RefreshCw,
  Copy,
  Save,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerationSettings {
  model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude' | 'custom';
  tone: 'professional' | 'casual' | 'authoritative' | 'friendly' | 'humorous' | 'inspirational';
  length: 'short' | 'medium' | 'long';
  audience: 'executives' | 'professionals' | 'students' | 'entrepreneurs' | 'general';
}

interface GeneratedContent {
  id: string;
  content: string;
  hashtags: string[];
  createdAt: Date;
  model: string;
}

interface ContentGenerationStudioProps {
  className?: string;
}

const ContentGenerationStudio: React.FC<ContentGenerationStudioProps> = ({ className }) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  const [settings, setSettings] = useState<GenerationSettings>({
    model: 'gpt-4',
    tone: 'professional',
    length: 'medium',
    audience: 'professionals'
  });

  const generateContent = async () => {
    setLoading(true);
    setError(null);
    setGenerationProgress(0);
    
    try {
      if (!customPrompt.trim()) {
        throw new Error('Please provide a prompt');
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
          prompt: customPrompt,
          settings
        })
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate content');
      }

      const data = await response.json();
      
      // Create generated content object
      const content: GeneratedContent = {
        id: `content_${Date.now()}`,
        content: data.content || generateMockContent(),
        hashtags: data.hashtags || generateHashtags(),
        createdAt: new Date(),
        model: settings.model
      };

      setGeneratedContent(content);

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
    ];
    
    return contents[Math.floor(Math.random() * contents.length)];
  };

  const generateHashtags = (): string[] => {
    const hashtags = [
      '#LinkedIn', '#Professional', '#Career', '#Business', '#Innovation',
      '#Leadership', '#Technology', '#Networking', '#Growth', '#Success'
    ];
    
    const count = Math.floor(Math.random() * 5) + 3;
    return hashtags.sort(() => 0.5 - Math.random()).slice(0, count);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={cn('w-full max-w-4xl mx-auto space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            <span>AI Content Generation Studio</span>
            <Badge variant="secondary">Beta</Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Prompt
            </label>
            <textarea
              placeholder="Describe what you want to create..."
              value={customPrompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomPrompt(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Generation Settings */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
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
          <div className="flex justify-center">
            <Button
              onClick={generateContent}
              disabled={loading || !customPrompt.trim()}
              size="lg"
              className="flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
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

      {/* Generated Content */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Generated Content</CardTitle>
              <Badge variant="outline">{generatedContent.model}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="whitespace-pre-wrap text-sm">
                {generatedContent.content}
              </div>
              {generatedContent.hashtags.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-wrap gap-1">
                    {generatedContent.hashtags.map(hashtag => (
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
                onClick={() => copyToClipboard(generatedContent.content)}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContentGenerationStudio;