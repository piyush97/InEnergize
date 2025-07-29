"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Plus,
  Edit,
  Trash2,
  Copy,
  MessageSquare,
  Users,
  UserPlus,
  Star,
  TrendingUp,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Eye,
  BarChart3,
  FileText,
  MoreVertical,
  Sparkles
} from "lucide-react";

import {
  TemplateManagerProps,
  MessageTemplate
} from "@/types/automation";

interface TemplateFormData {
  name: string;
  content: string;
  type: 'connection' | 'comment' | 'follow_up';
  variables: string[];
  tags: string[];
  isActive: boolean;
  description: string;
  id?: string;
}

const DEFAULT_VARIABLES = [
  'firstName',
  'lastName',
  'company',
  'position',
  'industry',
  'location',
  'mutualConnections'
];

export function TemplateManager({
  userId,
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onAnalyzeTemplate
}: TemplateManagerProps) {
  const [activeTab, setActiveTab] = useState<'connection' | 'comment'>('connection');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [templateAnalytics, setTemplateAnalytics] = useState<TemplateAnalytics | null>(null);
  
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    content: '',
    type: activeTab,
    variables: [],
    tags: [],
    isActive: true,
    description: ''
  });

  const [previewData, setPreviewData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    company: 'Tech Corp',
    position: 'Software Engineer',
    industry: 'Technology',
    location: 'San Francisco, CA'
  });

  // Filter templates based on search query and filters
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesType = template.type === activeTab;
      
      const matchesFilter = filterType === 'all' || 
                           (filterType === 'active' && template.isActive) ||
                           (filterType === 'draft' && !template.isActive) ||
                           (filterType === 'archived' && template.isArchived);
      
      return matchesSearch && matchesType && matchesFilter;
    });
  }, [templates, searchQuery, activeTab, filterType]);

  // Calculate template statistics
  const templateStats = useMemo(() => {
    const typeTemplates = templates.filter(t => t.type === activeTab);
    return {
      total: typeTemplates.length,
      active: typeTemplates.filter(t => t.isActive).length,
      draft: typeTemplates.filter(t => !t.isActive).length,
      avgSuccessRate: typeTemplates.length > 0 
        ? typeTemplates.reduce((acc, t) => acc + (t.analytics?.successRate || 0), 0) / typeTemplates.length 
        : 0,
      topPerforming: typeTemplates
        .filter(t => t.analytics?.successRate !== undefined)
        .sort((a, b) => (b.analytics?.successRate || 0) - (a.analytics?.successRate || 0))
        .slice(0, 3)
    };
  }, [templates, activeTab]);

  const resetForm = () => {
    setFormData({
      name: '',
      content: '',
      type: activeTab,
      variables: [],
      tags: [],
      isActive: true,
      description: ''
    });
  };

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      setError('Name and content are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onCreateTemplate({
        ...formData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate || !formData.name.trim() || !formData.content.trim()) {
      setError('Name and content are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onUpdateTemplate(selectedTemplate.id, {
        ...formData,
        updatedAt: new Date()
      });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setLoading(true);
    try {
      await onDeleteTemplate(templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({ ...template });
    setIsEditDialogOpen(true);
  };

  const handleDuplicateTemplate = async (template: Template) => {
    setFormData({
      ...template,
      name: `${template.name} (Copy)`,
      id: undefined
    });
    setIsCreateDialogOpen(true);
  };

  const handleGetAIOptimization = async (template: Template) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/automation/templates/ai-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          type: template.type,
          content: template.content,
          context: {
            industry: 'Technology', // This could come from user profile
            targetAudience: 'professionals',
            goals: ['increase_response_rate', 'maintain_compliance']
          }
        })
      });

      if (!response.ok) throw new Error('Failed to get AI optimization');
      
      const data = await response.json();
      setAiSuggestions(data.suggestions);
      setIsAIDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI optimization');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeTemplate = async (template: Template) => {
    setLoading(true);
    setError(null);
    
    try {
      const analytics = await onAnalyzeTemplate(template.id);
      setTemplateAnalytics(analytics);
      setSelectedTemplate(template);
      setIsAnalyticsDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleVariableToggle = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.includes(variable)
        ? prev.variables.filter(v => v !== variable)
        : [...prev.variables, variable]
    }));
  };

  const renderTemplatePreview = (content: string) => {
    let preview = content;
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return preview;
  };

  const getTypeIcon = (type: Template['type']) => {
    switch (type) {
      case 'connection':
        return <Users className="h-4 w-4" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: Template['type']) => {
    const config = {
      connection: { label: 'Connection', className: 'bg-blue-100 text-blue-800' },
      comment: { label: 'Comment', className: 'bg-green-100 text-green-800' }
    };
    return (
      <Badge className={config[type].className}>
        {getTypeIcon(type)}
        <span className="ml-1">{config[type].label}</span>
      </Badge>
    );
  };

  const getPerformanceBadge = (successRate?: number) => {
    if (successRate === undefined) return null;
    
    const config = successRate >= 70 
      ? { label: 'High Performing', className: 'bg-green-100 text-green-800' }
      : successRate >= 40
      ? { label: 'Average', className: 'bg-yellow-100 text-yellow-800' }
      : { label: 'Needs Optimization', className: 'bg-red-100 text-red-800' };
    
    return (
      <Badge className={config.className}>
        <TrendingUp className="h-3 w-3 mr-1" />
        {config.label} ({successRate.toFixed(1)}%)
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Template Manager</h2>
            <p className="text-gray-600">Create and manage your automation templates</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Template Type Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'connection' | 'comment')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connection" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Connection</span>
              <Badge variant="secondary">{templateStats.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="comment" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Comment</span>
              <Badge variant="secondary">{templates.filter(t => t.type === 'comment').length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{templateStats.total}</div>
                <p className="text-xs text-gray-500">Total Templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{templateStats.active}</div>
                <p className="text-xs text-gray-500">Active Templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{templateStats.draft}</div>
                <p className="text-xs text-gray-500">Draft Templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-purple-600">
                  {templateStats.avgSuccessRate.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500">Avg Success Rate</p>
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="draft">Drafts Only</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="group hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {template.description || 'No description'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAnalyzeTemplate(template)}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleGetAIOptimization(template)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Optimize
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                {/* Template Tags */}
                <div className="flex flex-wrap gap-1">
                  {getTypeBadge(template.type)}
                  {getPerformanceBadge(template.analytics?.successRate)}
                  <Badge variant={template.isActive ? "default" : "secondary"}>
                    {template.isActive ? "Active" : "Draft"}
                  </Badge>
                </div>

                {/* Template Content Preview */}
                <div className="p-3 bg-gray-50 rounded text-sm text-gray-700 line-clamp-3">
                  {renderTemplatePreview(template.content)}
                </div>

                {/* Template Variables */}
                {template.variables.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.slice(0, 3).map((variable) => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {variable}
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.variables.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Analytics Summary */}
                {template.analytics && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                    <div>
                      <span className="text-gray-500">Used:</span>
                      <span className="ml-1 font-medium">{template.analytics.usageCount}x</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Success:</span>
                      <span className="ml-1 font-medium">
                        {template.analytics.successRate?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || filterType !== 'all' 
              ? 'Try adjusting your search or filters'
              : `Create your first ${activeTab} template to get started`
            }
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create/Edit Dialog would go here - keeping existing implementation for now */}
      
    </div>
  );
};

  const TemplateFormDialog = ({ 
    isOpen, 
    onOpenChange, 
    title, 
    description, 
    onSubmit 
  }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    onSubmit: (e: React.FormEvent) => void;
  }) => (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="Enter template name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Template Type</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connection">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Connection Request</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="comment">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>Comment</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="follow_up">
                    <div className="flex items-center space-x-2">
                      <UserPlus className="h-4 w-4" />
                      <span>Follow-up Message</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Template Content</Label>
            <Textarea
              id="content"
              placeholder="Write your template message..."
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="min-h-[120px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{'}{'}variableName{'}{'}}'} for dynamic content. {formData.content.length}/500 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Available Variables</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {DEFAULT_VARIABLES.map(variable => (
                <label key={variable} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.variables.includes(variable)}
                    onChange={() => handleVariableToggle(variable)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{variable}</span>
                </label>
              ))}
            </div>
          </div>

          {formData.content && formData.variables.length > 0 && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-3 bg-gray-50 border rounded-lg">
                <p className="text-sm">
                  {renderTemplatePreview(formData.content, formData.variables)}
                </p>
              </div>
            </div>
          )}

          {error && (
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : null}
              {selectedTemplate ? 'Update' : 'Create'} Template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Template Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templateStats.total}</div>
            <p className="text-xs text-muted-foreground">Active templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{templateStats.connection}</div>
            <p className="text-xs text-muted-foreground">Connection templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{templateStats.comment}</div>
            <p className="text-xs text-muted-foreground">Comment templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templateStats.avgSuccessRate}%</div>
            <p className="text-xs text-muted-foreground">Average success</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templateStats.totalUsage}</div>
            <p className="text-xs text-muted-foreground">Total uses</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="manage">Manage Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Message Templates</CardTitle>
                  <CardDescription>
                    Create and manage reusable message templates for automation
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="connection">Connections</SelectItem>
                    <SelectItem value="comment">Comments</SelectItem>
                    <SelectItem value="follow_up">Follow-ups</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Templates List */}
              <div className="space-y-4">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No templates found</p>
                    <p className="text-sm">Create your first template to get started</p>
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <div key={template.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {getTypeIcon(template.type)}
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium">{template.name}</h3>
                              {template.isDefault && (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  <Star className="h-3 w-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                              <span>Used {template.usageCount} times</span>
                              {template.successRate !== undefined && (
                                <>
                                  <span>•</span>
                                  <span>{Math.round(template.successRate)}% success rate</span>
                                </>
                              )}
                              <span>•</span>
                              <span>Created {template.createdAt.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {getTypeBadge(template.type)}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm">
                          {template.variables.length > 0 
                            ? renderTemplatePreview(template.content, template.variables)
                            : template.content
                          }
                        </p>
                      </div>

                      {template.variables.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">Variables:</span>
                          {template.variables.map(variable => (
                            <Badge key={variable} variant="outline" className="text-xs">
                              {variable}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                          Last updated: {template.updatedAt.toLocaleDateString()}
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicateTemplate(template)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Performance Analytics</CardTitle>
              <CardDescription>
                Analyze the effectiveness of your message templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Top Performing Templates */}
                <div>
                  <h3 className="font-medium mb-4 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Top Performing Templates
                  </h3>
                  <div className="space-y-3">
                    {templates
                      .filter(t => t.usageCount > 0)
                      .sort((a, b) => (b.successRate || 0) - (a.successRate || 0))
                      .slice(0, 5)
                      .map(template => (
                        <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getTypeIcon(template.type)}
                            <div>
                              <div className="font-medium">{template.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {template.usageCount} uses • {getTypeBadge(template.type)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {Math.round(template.successRate || 0)}%
                            </div>
                            <div className="text-xs text-muted-foreground">Success Rate</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Usage Statistics */}
                <div>
                  <h3 className="font-medium mb-4 flex items-center">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Usage Statistics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {templates.filter(t => t.type === 'connection').reduce((sum, t) => sum + t.usageCount, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Connection Template Uses</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {templates.filter(t => t.type === 'comment').reduce((sum, t) => sum + t.usageCount, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Comment Template Uses</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {templates.filter(t => t.type === 'follow_up').reduce((sum, t) => sum + t.usageCount, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Follow-up Template Uses</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <TemplateFormDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title="Create New Template"
        description="Create a reusable message template for your automation campaigns."
        onSubmit={handleCreateTemplate}
      />

      {/* Edit Template Dialog */}
      <TemplateFormDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="Edit Template"
        description="Update your message template."
        onSubmit={handleUpdateTemplate}
      />
    </div>
  );
}