"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileText,
  Plus,
  Edit,
  Trash2,
  Copy,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Star,
  Users,
  MessageSquare,
  Heart,
  Eye,
  Target,
  Sparkles,
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  MoreHorizontal,
  Zap,
  Award,
  Activity
} from "lucide-react";

import { MessageTemplate } from "@/types/automation";

interface EnhancedTemplateManagerProps {
  userId: string;
  templates: MessageTemplate[];
  onCreateTemplate: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTemplate: (templateId: string, updates: Partial<MessageTemplate>) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onAnalyzeTemplate: (templateId: string) => Promise<any>;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
}

interface TemplateAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  personalityScore: number;
  professionalismScore: number;
  engagementPotential: number;
  complianceRisk: 'low' | 'medium' | 'high';
  suggestions: string[];
  keywords: string[];
  readabilityScore: number;
}

export function EnhancedTemplateManager({
  userId,
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onAnalyzeTemplate,
  subscriptionTier
}: EnhancedTemplateManagerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('successRate');
  const [templateAnalysis, setTemplateAnalysis] = useState<Record<string, TemplateAnalysis>>({});
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  // New template form state
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    type: 'connection' as 'connection' | 'comment' | 'follow_up',
    variables: [] as string[]
  });

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = templates;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(template => template.type === filterType);
    }

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'successRate':
          return (b.successRate || 0) - (a.successRate || 0);
        case 'usageCount':
          return b.usageCount - a.usageCount;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'updatedAt':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchQuery, filterType, sortBy]);

  // Template statistics
  const templateStats = useMemo(() => {
    const stats = {
      total: templates.length,
      byType: {
        connection: 0,
        comment: 0,
        follow_up: 0
      },
      avgSuccessRate: 0,
      totalUsage: 0,
      topPerformer: null as MessageTemplate | null,
      lowPerformer: null as MessageTemplate | null
    };

    templates.forEach(template => {
      stats.byType[template.type]++;
      stats.totalUsage += template.usageCount;
      stats.avgSuccessRate += template.successRate || 0;
    });

    if (templates.length > 0) {
      stats.avgSuccessRate = Math.round(stats.avgSuccessRate / templates.length);
      
      // Find top and low performers
      const sorted = [...templates].sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
      stats.topPerformer = sorted[0] || null;
      stats.lowPerformer = sorted[sorted.length - 1] || null;
    }

    return stats;
  }, [templates]);

  // Handle template analysis
  const handleAnalyzeTemplate = useCallback(async (templateId: string) => {
    if (subscriptionTier === 'free') return;
    
    setAnalyzing(templateId);
    try {
      const analysis = await onAnalyzeTemplate(templateId);
      setTemplateAnalysis(prev => ({
        ...prev,
        [templateId]: analysis
      }));
    } catch (error) {
      console.error('Template analysis failed:', error);
    } finally {
      setAnalyzing(null);
    }
  }, [onAnalyzeTemplate, subscriptionTier]);

  // Handle template creation
  const handleCreateTemplate = useCallback(async () => {
    if (!newTemplate.name || !newTemplate.content) return;

    try {
      await onCreateTemplate({
        ...newTemplate,
        successRate: 0,
        usageCount: 0,
        isDefault: false
      });
      
      setNewTemplate({
        name: '',
        content: '',
        type: 'connection',
        variables: []
      });
      setCreatingTemplate(false);
    } catch (error) {
      console.error('Template creation failed:', error);
    }
  }, [newTemplate, onCreateTemplate]);

  // Handle template update
  const handleUpdateTemplate = useCallback(async () => {
    if (!editingTemplate) return;

    try {
      await onUpdateTemplate(editingTemplate.id, editingTemplate);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Template update failed:', error);
    }
  }, [editingTemplate, onUpdateTemplate]);

  // Handle template duplication
  const handleDuplicateTemplate = useCallback(async (template: MessageTemplate) => {
    try {
      await onCreateTemplate({
        name: `${template.name} (Copy)`,
        content: template.content,
        type: template.type,
        variables: [...template.variables],
        successRate: 0,
        usageCount: 0,
        isDefault: false
      });
    } catch (error) {
      console.error('Template duplication failed:', error);
    }
  }, [onCreateTemplate]);

  // Extract variables from template content
  const extractVariables = useCallback((content: string): string[] => {
    const matches = content.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }, []);

  // Get template type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'connection': return <Users className="h-4 w-4" />;
      case 'comment': return <MessageSquare className="h-4 w-4" />;
      case 'follow_up': return <Target className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Get success rate color
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    if (rate >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get analysis risk color
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{templateStats.total}</div>
                <div className="text-xs text-gray-600">Total Templates</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{templateStats.avgSuccessRate}%</div>
                <div className="text-xs text-gray-600">Avg Success Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{templateStats.totalUsage}</div>
                <div className="text-xs text-gray-600">Total Usage</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-lg font-bold">
                  {templateStats.topPerformer ? `${templateStats.topPerformer.successRate}%` : '-'}
                </div>
                <div className="text-xs text-gray-600">Best Performer</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performer Alert */}
      {templateStats.topPerformer && templateStats.topPerformer.successRate && templateStats.topPerformer.successRate > 90 && (
        <Alert className="border-green-200 bg-green-50">
          <Award className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <span className="font-medium">{templateStats.topPerformer.name}</span> is performing exceptionally well with a{' '}
            <span className="font-medium">{templateStats.topPerformer.successRate}% success rate</span>!
            Consider using it as a template for new messages.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Template Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Template Manager</span>
                <Badge variant="outline">{filteredAndSortedTemplates.length}</Badge>
              </CardTitle>
              <CardDescription>
                AI-powered template system with success analytics and optimization
              </CardDescription>
            </div>
            
            <Dialog open={creatingTemplate} onOpenChange={setCreatingTemplate}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a new message template with AI-powered optimization suggestions
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Professional Connection Request"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="template-type">Template Type</Label>
                    <Select
                      value={newTemplate.type}
                      onValueChange={(value) => setNewTemplate(prev => ({ ...prev, type: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connection">Connection Request</SelectItem>
                        <SelectItem value="comment">Comment</SelectItem>
                        <SelectItem value="follow_up">Follow-up Message</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="template-content">Message Content</Label>
                    <Textarea
                      id="template-content"
                      value={newTemplate.content}
                      onChange={(e) => {
                        const content = e.target.value;
                        setNewTemplate(prev => ({
                          ...prev,
                          content,
                          variables: extractVariables(content)
                        }));
                      }}
                      placeholder="Hi {firstName}, I noticed you work at {company}..."
                      rows={6}
                    />
                    <div className="text-sm text-gray-500 mt-2">
                      Use {'{'}variable{'}'} syntax for dynamic content. Variables will be extracted automatically.
                    </div>
                  </div>
                  
                  {newTemplate.variables.length > 0 && (
                    <div>
                      <Label>Detected Variables</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newTemplate.variables.map((variable, index) => (
                          <Badge key={index} variant="outline">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreatingTemplate(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTemplate}>
                      Create Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 flex-1 min-w-64">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="connection">Connection</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="successRate">Success Rate</SelectItem>
                  <SelectItem value="usageCount">Usage Count</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="updatedAt">Last Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Template Grid */}
          <div className="grid gap-4">
            {filteredAndSortedTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No templates match your current filters</p>
                <Button 
                  onClick={() => setCreatingTemplate(true)}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Template
                </Button>
              </div>
            ) : (
              filteredAndSortedTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          {getTypeIcon(template.type)}
                          <h3 className="font-semibold text-lg">{template.name}</h3>
                          {template.isDefault && (
                            <Badge variant="secondary">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          <Badge variant="outline">
                            {template.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-4 line-clamp-3">
                          {template.content}
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="flex items-center space-x-1">
                            <BarChart3 className="h-4 w-4 text-gray-400" />
                            <span className={`font-medium ${getSuccessRateColor(template.successRate || 0)}`}>
                              {template.successRate || 0}% success
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Activity className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {template.usageCount} uses
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {new Date(template.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        {template.variables.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs text-gray-500 mb-1">Variables:</div>
                            <div className="flex flex-wrap gap-1">
                              {template.variables.map((variable, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {variable}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* AI Analysis Results */}
                        {templateAnalysis[template.id] && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                              <Brain className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-800">AI Analysis</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <div className="text-gray-600">Engagement Potential</div>
                                <div className="font-medium">
                                  {templateAnalysis[template.id].engagementPotential}%
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600">Compliance Risk</div>
                                <Badge className={`text-xs ${getRiskColor(templateAnalysis[template.id].complianceRisk)}`}>
                                  {templateAnalysis[template.id].complianceRisk}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-gray-600">Professionalism</div>
                                <div className="font-medium">
                                  {templateAnalysis[template.id].professionalismScore}%
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600">Readability</div>
                                <div className="font-medium">
                                  {templateAnalysis[template.id].readabilityScore}%
                                </div>
                              </div>
                            </div>
                            {templateAnalysis[template.id].suggestions.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs text-gray-600 mb-1">Suggestions:</div>
                                <ul className="text-xs text-blue-700 space-y-1">
                                  {templateAnalysis[template.id].suggestions.slice(0, 2).map((suggestion, index) => (
                                    <li key={index}>• {suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4">
                        {subscriptionTier !== 'free' && (
                          <Button
                            onClick={() => handleAnalyzeTemplate(template.id)}
                            size="sm"
                            variant="outline"
                            disabled={analyzing === template.id}
                          >
                            {analyzing === template.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Brain className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => setEditingTemplate(template)}
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          onClick={() => handleDuplicateTemplate(template)}
                          size="sm"
                          variant="outline"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          onClick={() => onDeleteTemplate(template.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update your template content and settings
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-template-name">Template Name</Label>
                <Input
                  id="edit-template-name"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-template-content">Message Content</Label>
                <Textarea
                  id="edit-template-content"
                  value={editingTemplate.content}
                  onChange={(e) => {
                    const content = e.target.value;
                    setEditingTemplate(prev => prev ? {
                      ...prev,
                      content,
                      variables: extractVariables(content)
                    } : null);
                  }}
                  rows={6}
                />
              </div>
              
              {editingTemplate.variables.length > 0 && (
                <div>
                  <Label>Variables</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editingTemplate.variables.map((variable, index) => (
                      <Badge key={index} variant="outline">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateTemplate}>
                  Update Template
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Subscription Upgrade */}
      {subscriptionTier === 'free' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-lg text-blue-700">
              <Zap className="h-5 w-5" />
              <span>Upgrade for AI-Powered Templates</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-blue-600 space-y-2">
              <p>Premium features include:</p>
              <ul className="space-y-1 ml-4">
                <li>• AI-powered template analysis and optimization</li>
                <li>• Success rate predictions and improvements</li>
                <li>• Advanced personalization variables</li>
                <li>• Template A/B testing capabilities</li>
                <li>• Compliance risk assessment</li>
                <li>• Smart template suggestions</li>
              </ul>
              <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">
                Upgrade to Premium
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}