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

interface TemplateAnalytics {
  id: string;
  name: string;
  totalUses: number;
  successRate: number;
  averageResponseTime: number;
  clickThroughRate: number;
  lastUsed: Date;
  trend: 'up' | 'down' | 'stable';
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
  const [activeTab, setActiveTab] = useState<'connection' | 'comment' | 'analytics'>('connection');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    content: '',
    type: 'connection',
    variables: [],
    tags: [],
    isActive: true,
    description: ''
  });

  // Filter templates based on search and active tab
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = !searchQuery || 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = activeTab === 'analytics' || template.type === activeTab;
      
      return matchesSearch && matchesType;
    });
  }, [templates, searchQuery, activeTab]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await onCreateTemplate(formData);
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    
    try {
      setLoading(true);
      setError(null);
      await onUpdateTemplate(selectedTemplate.id, formData);
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      type: template.type,
      variables: template.variables || [],
      tags: template.tags || [],
      isActive: template.isActive,
      description: template.description || '',
      id: template.id
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await onDeleteTemplate(templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const handleDuplicateTemplate = async (template: MessageTemplate) => {
    const duplicatedTemplate = {
      ...template,
      name: `${template.name} (Copy)`,
      id: undefined
    };
    
    try {
      await onCreateTemplate(duplicatedTemplate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate template');
    }
  };

  const handleAnalyzeTemplate = async (template: MessageTemplate) => {
    try {
      setLoading(true);
      await onAnalyzeTemplate(template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze template');
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

  const resetForm = () => {
    setFormData({
      name: '',
      content: '',
      type: 'connection',
      variables: [],
      tags: [],
      isActive: true,
      description: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Template Manager</h2>
          <p className="text-muted-foreground">
            Create and manage reusable message templates for your automation campaigns
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Template Type Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'connection' | 'comment' | 'analytics')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger value="comment" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Comment</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          {/* Search and Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{template.name}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
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
                          Analyze
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
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.content}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{template.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Used {template.usageCount || 0} times
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="comment" className="space-y-4">
          {/* Same structure as connection tab but filtered for comment templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{template.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.content}</p>
                  <Badge variant="outline">{template.type}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Performance</CardTitle>
              <CardDescription>Analytics and performance metrics for your templates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics data will be displayed here when available.</p>
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
        formData={formData}
        setFormData={setFormData}
        handleVariableToggle={handleVariableToggle}
        loading={loading}
        error={error}
      />

      {/* Edit Template Dialog */}
      <TemplateFormDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="Edit Template"
        description="Update your message template."
        onSubmit={handleUpdateTemplate}
        formData={formData}
        setFormData={setFormData}
        handleVariableToggle={handleVariableToggle}
        loading={loading}
        error={error}
      />
    </div>
  );
}

interface TemplateFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSubmit: (e: React.FormEvent) => void;
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  handleVariableToggle: (variable: string) => void;
  loading: boolean;
  error: string | null;
}

const TemplateFormDialog = ({ 
  isOpen, 
  onOpenChange, 
  title, 
  description, 
  onSubmit,
  formData,
  setFormData,
  handleVariableToggle,
  loading,
  error
}: TemplateFormDialogProps) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {error && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter template name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Template Type</Label>
          <Select value={formData.type} onValueChange={(value: 'connection' | 'comment' | 'follow_up') => setFormData(prev => ({ ...prev, type: value }))}>
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

        <div className="space-y-2">
          <Label htmlFor="content">Template Content</Label>
          <Textarea
            id="content"
            rows={4}
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Write your template message..."
            required
          />
          <p className="text-xs text-muted-foreground">
            {formData.content.length}/300 characters
          </p>
        </div>

        <div className="space-y-3">
          <Label>Available Variables</Label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
            {DEFAULT_VARIABLES.map(variable => (
              <label key={variable} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.variables.includes(variable)}
                  onChange={() => handleVariableToggle(variable)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{`{${variable}}`}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : null}
            {title.includes('Edit') ? 'Update' : 'Create'} Template
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);