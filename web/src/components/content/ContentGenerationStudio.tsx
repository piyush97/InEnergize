// ContentGenerationStudio.tsx - AI-Powered LinkedIn Content Generation Interface
// Multi-variant content generation with LinkedIn best practices and compliance

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Sparkles, 
  Target, 
  Wand2, 
  Copy, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  Brain,
  Briefcase,
  Hash,
  Eye,
  BarChart3,
  RefreshCw,
  Send,
  Loader2
} from 'lucide-react';

// Content types available for generation
const CONTENT_TYPES = {
  post: { name: 'Post', icon: Briefcase, charLimit: 3000 },
  article: { name: 'Article', icon: Brain, charLimit: 125000 },
  carousel: { name: 'Carousel', icon: Eye, maxSlides: 10 },
  poll: { name: 'Poll', icon: BarChart3, maxOptions: 4 }
};

// Industry templates for better targeting
const INDUSTRY_TEMPLATES = [
  { value: 'tech', label: 'Technology' },
  { value: 'sales', label: 'Sales & Business Development' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'consulting', label: 'Consulting' }
];

// Content tone options
const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-oriented' },
  { value: 'conversational', label: 'Conversational', description: 'Friendly and approachable' },
  { value: 'thought-leader', label: 'Thought Leader', description: 'Authoritative and insightful' },
  { value: 'inspirational', label: 'Inspirational', description: 'Motivating and uplifting' },
  { value: 'educational', label: 'Educational', description: 'Teaching and informative' }
];

// Hook formulas for engagement
const HOOK_FORMULAS = [
  { value: 'aida', label: 'AIDA', description: 'Attention, Interest, Desire, Action' },
  { value: 'pas', label: 'PAS', description: 'Problem, Agitate, Solution' },
  { value: 'bab', label: 'BAB', description: 'Before, After, Bridge' },
  { value: 'star', label: 'STAR', description: 'Situation, Task, Action, Result' },
  { value: 'question', label: 'Question Hook', description: 'Start with an engaging question' },
  { value: 'statistic', label: 'Statistical Hook', description: 'Lead with compelling data' }
];

interface ContentVariant {
  id: string;
  content: string;
  tone: string;
  hookFormula: string;
  engagementScore: number;
  viralPotential: number;
  readabilityScore: number;
  hashtags: string[];
  characterCount: number;
  estimatedReach: number;
}

interface GenerationRequest {
  contentType: keyof typeof CONTENT_TYPES;
  topic: string;
  industry: string;
  tone: string;
  hookFormula: string;
  targetAudience: string;
  keywords: string[];
  includeHashtags: boolean;
  variantCount: number;
}

export const ContentGenerationStudio: React.FC = () => {
  const [request, setRequest] = useState<GenerationRequest>({
    contentType: 'post',
    topic: '',
    industry: 'tech',
    tone: 'professional',
    hookFormula: 'aida',
    targetAudience: '',
    keywords: [],
    includeHashtags: true,
    variantCount: 3
  });

  const [variants, setVariants] = useState<ContentVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState('');

  const handleGenerate = async () => {
    if (!request.topic.trim()) {
      setError('Please enter a topic for content generation');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/ai/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();
      setVariants(data.variants);
      if (data.variants.length > 0) {
        setSelectedVariant(data.variants[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
      // Mock data for development
      const mockVariants: ContentVariant[] = Array.from({ length: request.variantCount }, (_, i) => ({
        id: `variant-${i + 1}`,
        content: generateMockContent(request, i),
        tone: request.tone,
        hookFormula: request.hookFormula,
        engagementScore: Math.floor(Math.random() * 30) + 70,
        viralPotential: Math.floor(Math.random() * 40) + 40,
        readabilityScore: Math.floor(Math.random() * 20) + 75,
        hashtags: generateMockHashtags(request.industry),
        characterCount: 800 + Math.floor(Math.random() * 400),
        estimatedReach: Math.floor(Math.random() * 5000) + 2000
      }));
      setVariants(mockVariants);
      if (mockVariants.length > 0) {
        setSelectedVariant(mockVariants[0].id);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeywordAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      setRequest(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const handleKeywordRemove = (keyword: string) => {
    setRequest(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    // Show toast notification
  };

  const handleScheduleContent = (variantId: string) => {
    // Navigate to scheduling with selected variant
    console.log('Schedule variant:', variantId);
  };

  const getEngagementColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getViralIcon = (potential: number) => {
    if (potential >= 70) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (potential >= 50) return <TrendingUp className="h-4 w-4 text-yellow-500" />;
    return <TrendingUp className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-blue-600" />
            AI Content Generation Studio
          </h1>
          <p className="text-gray-600 mt-1">
            Create engaging LinkedIn content with AI-powered assistance
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Brain className="h-3 w-3" />
          GPT-4 Powered
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generation Settings */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Generation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Content Type */}
              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select
                  value={request.contentType}
                  onValueChange={(value) => setRequest(prev => ({ ...prev, contentType: value as keyof typeof CONTENT_TYPES }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTENT_TYPES).map(([key, type]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Topic */}
              <div className="space-y-2">
                <Label>Topic or Theme</Label>
                <Textarea
                  placeholder="What would you like to write about?"
                  value={request.topic}
                  onChange={(e) => setRequest(prev => ({ ...prev, topic: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Industry */}
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select
                  value={request.industry}
                  onValueChange={(value) => setRequest(prev => ({ ...prev, industry: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_TEMPLATES.map(industry => (
                      <SelectItem key={industry.value} value={industry.value}>
                        {industry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <Label>Tone of Voice</Label>
                <Select
                  value={request.tone}
                  onValueChange={(value) => setRequest(prev => ({ ...prev, tone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map(tone => (
                      <SelectItem key={tone.value} value={tone.value}>
                        <div>
                          <div className="font-medium">{tone.label}</div>
                          <div className="text-xs text-gray-500">{tone.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hook Formula */}
              <div className="space-y-2">
                <Label>Hook Formula</Label>
                <Select
                  value={request.hookFormula}
                  onValueChange={(value) => setRequest(prev => ({ ...prev, hookFormula: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOOK_FORMULAS.map(hook => (
                      <SelectItem key={hook.value} value={hook.value}>
                        <div>
                          <div className="font-medium">{hook.label}</div>
                          <div className="text-xs text-gray-500">{hook.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Textarea
                  placeholder="Who is your ideal reader? (e.g., CTOs, HR managers, entrepreneurs)"
                  value={request.targetAudience}
                  onChange={(e) => setRequest(prev => ({ ...prev, targetAudience: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label>Keywords</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {request.keywords.map(keyword => (
                    <Badge 
                      key={keyword} 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleKeywordRemove(keyword)}
                    >
                      {keyword} ×
                    </Badge>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add keywords (press Enter)"
                  className="w-full px-3 py-2 border rounded-md"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordAdd}
                />
              </div>

              {/* Variant Count */}
              <div className="space-y-2">
                <Label>Number of Variants</Label>
                <Select
                  value={String(request.variantCount)}
                  onValueChange={(value) => setRequest(prev => ({ ...prev, variantCount: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(num => (
                      <SelectItem key={num} value={String(num)}>
                        {num} variant{num > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button 
                className="w-full" 
                onClick={handleGenerate}
                disabled={isGenerating || !request.topic.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* LinkedIn Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                LinkedIn Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Keep posts under 1,300 characters for best engagement</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Use 3-5 relevant hashtags maximum</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Include a clear call-to-action</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Post during peak hours (Tue-Thu, 9-10 AM)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Use storytelling to increase engagement</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Generated Variants */}
        <div className="lg:col-span-2">
          {variants.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generated Variants
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleGenerate}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedVariant || undefined} onValueChange={setSelectedVariant}>
                  <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${variants.length}, 1fr)` }}>
                    {variants.map((variant, index) => (
                      <TabsTrigger key={variant.id} value={variant.id}>
                        Variant {index + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {variants.map(variant => (
                    <TabsContent key={variant.id} value={variant.id} className="space-y-4 mt-4">
                      {/* Metrics Bar */}
                      <div className="grid grid-cols-4 gap-4 pb-4 border-b">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getEngagementColor(variant.engagementScore)}`}>
                            {variant.engagementScore}%
                          </div>
                          <div className="text-xs text-gray-500">Engagement Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold flex items-center justify-center gap-1">
                            {variant.viralPotential}%
                            {getViralIcon(variant.viralPotential)}
                          </div>
                          <div className="text-xs text-gray-500">Viral Potential</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{variant.readabilityScore}</div>
                          <div className="text-xs text-gray-500">Readability</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{variant.estimatedReach.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">Est. Reach</div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="whitespace-pre-wrap">{variant.content}</p>
                        </div>

                        {/* Character Count */}
                        {'charLimit' in CONTENT_TYPES[request.contentType] && (
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(variant.characterCount / (CONTENT_TYPES[request.contentType] as any).charLimit) * 100} 
                              className="flex-1"
                            />
                            <span className="text-sm text-gray-500">
                              {variant.characterCount} / {(CONTENT_TYPES[request.contentType] as any).charLimit}
                            </span>
                          </div>
                        )}

                        {/* Hashtags */}
                        {variant.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {variant.hashtags.map(tag => (
                              <Badge key={tag} variant="outline">
                                <Hash className="h-3 w-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            onClick={() => handleCopyContent(variant.content)}
                            className="flex-1"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Content
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleScheduleContent(variant.id)}
                            className="flex-1"
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Schedule Post
                          </Button>
                          <Button className="flex-1">
                            <Send className="h-4 w-4 mr-2" />
                            Post Now
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-16">
                <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No content generated yet</h3>
                <p className="text-gray-500 mb-6">
                  Configure your settings and click "Generate Content" to create AI-powered LinkedIn posts
                </p>
                <Button onClick={handleGenerate} disabled={isGenerating || !request.topic.trim()}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Your First Post
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// Mock content generation for development
function generateMockContent(request: GenerationRequest, variantIndex: number): string {
  const hooks = {
    aida: [
      "🚀 Did you know that 73% of professionals miss out on career opportunities due to poor LinkedIn optimization?",
      "Here's what separates top performers from the rest...",
      "The secret to standing out in your industry isn't what you think."
    ],
    pas: [
      "Struggling to get noticed on LinkedIn? You're not alone.",
      "Most professionals make these 3 critical mistakes on their profiles.",
      "Your LinkedIn profile might be costing you opportunities."
    ],
    bab: [
      "Remember when LinkedIn was just an online resume?",
      "I used to think the same way until I discovered...",
      "Before I optimized my LinkedIn strategy, I was invisible."
    ]
  };

  const endings = [
    "\n\nWhat's your biggest LinkedIn challenge? Share below! 👇",
    "\n\nFollow me for more LinkedIn optimization tips! 🔔",
    "\n\nDM me 'OPTIMIZE' to get my free LinkedIn checklist! 📩",
    "\n\nWhat strategies have worked for you? Let's discuss! 💬"
  ];

  const selectedHooks = hooks[request.hookFormula as keyof typeof hooks] || hooks.aida;
  const hook = selectedHooks[variantIndex % selectedHooks.length];
  
  const body = `\n\n${request.topic}\n\nIn the ${request.industry} industry, this is especially important because...

✅ Key Point 1: Leverage data and metrics
✅ Key Point 2: Tell compelling stories
✅ Key Point 3: Engage authentically with your network

The key is consistency and value creation.`;

  const ending = endings[variantIndex % endings.length];

  return hook + body + ending;
}

function generateMockHashtags(industry: string): string[] {
  const industryHashtags: Record<string, string[]> = {
    tech: ['TechLeadership', 'Innovation', 'DigitalTransformation', 'TechTrends', 'FutureOfWork'],
    sales: ['SalesStrategy', 'B2BSales', 'SalesLeadership', 'RevenueGrowth', 'SalesEnablement'],
    hr: ['HRTech', 'TalentAcquisition', 'EmployeeEngagement', 'FutureOfHR', 'PeopleFirst'],
    finance: ['FinTech', 'FinancialPlanning', 'InvestmentStrategy', 'WealthManagement', 'FinanceLeaders'],
    marketing: ['MarketingStrategy', 'DigitalMarketing', 'ContentMarketing', 'BrandBuilding', 'MarketingROI']
  };

  return industryHashtags[industry] || ['LinkedIn', 'ProfessionalGrowth', 'CareerDevelopment'];
}

export default ContentGenerationStudio;